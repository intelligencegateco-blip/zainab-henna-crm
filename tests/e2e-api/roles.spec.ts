import { expect, test, type Browser, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * Full stack: PHP API + SQLite + the real UI. Runs in order; each step builds on
 * the last (shared database).
 */
test.describe.configure({ mode: 'serial' });

const temp = () => JSON.parse(readFileSync('.tmp/e2e-api-users.json', 'utf8')) as Record<string, string>;
const issued: Record<string, string> = {};
const PASSWORDS = {
  admin: 'Admin-pass-2026',
  owner: 'Owner-pass-2026',
  editor: 'Editor-pass-2026',
  viewer: 'Viewer-pass-2026',
};

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/** Sign in and wait until the app has loaded. */
async function signedIn(page: Page, email: string, password: string) {
  await signIn(page, email, password);
  await expect(page.locator('.sidebar-user')).toContainText(email);
}

/** First sign-in with a temporary password: the app requires a new one. */
async function firstSignIn(page: Page, email: string, temporary: string, chosen: string) {
  await signIn(page, email, temporary);
  const dialog = page.getByRole('dialog', { name: 'Choose your own password' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Current password').fill(temporary);
  await dialog.getByLabel('New password', { exact: true }).fill(chosen);
  await dialog.getByLabel('Repeat new password').fill(chosen);
  await dialog.getByRole('button', { name: 'Save and continue' }).click();
  await expect(dialog).toBeHidden();
}

async function newPage(browser: Browser) {
  const ctx = await browser.newContext();
  return ctx.newPage();
}

test('admin: first sign-in, password change, load demo data', async ({ page }) => {
  await signIn(page, 'admin@test.example', 'wrong-password');
  await expect(page.getByRole('alert')).toContainText('don’t match');

  await firstSignIn(page, 'admin@test.example', temp().admin, PASSWORDS.admin);
  await expect(page.locator('.sidebar-user')).toContainText('Admin');


  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('tab', { name: 'Data' }).click();
  await page.getByRole('button', { name: 'Reset to demo data' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset to demo data' }).click();
  await expect(page.locator('.metric', { hasText: 'Total customers' }).locator('.stat-value')).toHaveText('13');
});

test('admin: add an editor and a viewer; can assign any role', async ({ page }) => {
  await signedIn(page, 'admin@test.example', PASSWORDS.admin);
  await page.goto('/settings?tab=users');
  await expect(page.getByTestId('user-admin@test.example')).toContainText('(you)');
  // Admin can't change their own role
  await expect(page.getByTestId('user-admin@test.example').getByRole('combobox')).toHaveCount(0);
  // Admin may assign Admin to others
  await expect(page.getByLabel('Role for Test Owner').locator('option')).toHaveText(['Admin', 'Owner', 'Edit / Write', 'View / Read-only']);

  for (const [name, email, role] of [
    ['Eddie Editor', 'editor@test.example', 'editor'],
    ['Vera Viewer', 'viewer@test.example', 'viewer'],
  ]) {
    await page.getByRole('button', { name: 'Add user' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add user' });
    await dialog.getByLabel('Name').fill(name);
    await dialog.getByLabel('Email').fill(email);
    await dialog.getByLabel('Role').selectOption(role);
    await dialog.getByRole('button', { name: 'Add user' }).click();
    const done = page.getByRole('dialog', { name: 'User added' });
    issued[role] = (await done.getByTestId('temporary-password').innerText()).trim();
    await done.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByTestId(`user-${email}`)).toContainText('Temporary password');
  }

  // Duplicate email is rejected
  await page.getByRole('button', { name: 'Add user' }).click();
  const dup = page.getByRole('dialog', { name: 'Add user' });
  await dup.getByLabel('Name').fill('Someone');
  await dup.getByLabel('Email').fill('EDITOR@test.example');
  await dup.getByRole('button', { name: 'Add user' }).click();
  await expect(dup.getByText('Already in use')).toBeVisible();
});

test('owner: manages users but cannot assign or touch Admins', async ({ browser }) => {
  const page = await newPage(browser);
  await firstSignIn(page, 'owner@test.example', temp().owner, PASSWORDS.owner);
  await expect(page.locator('.sidebar-user')).toContainText('Owner');
  await page.goto('/settings?tab=users');

  const adminRow = page.getByTestId('user-admin@test.example');
  await expect(adminRow).toContainText('Admin');
  await expect(adminRow.getByRole('combobox')).toHaveCount(0);
  await expect(adminRow.getByRole('button', { name: /Actions for/ })).toHaveCount(0);

  const viewerRole = page.getByLabel('Role for Vera Viewer');
  await expect(viewerRole.locator('option')).toHaveText(['Owner', 'Edit / Write', 'View / Read-only']);

  await page.getByRole('button', { name: 'Add user' }).click();
  await expect(page.getByRole('dialog').getByLabel('Role').locator('option')).toHaveText(['Owner', 'Edit / Write', 'View / Read-only']);
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

  // Owners can edit business settings
  await page.getByRole('tab', { name: 'Business' }).click();
  await expect(page.getByLabel('Exchange rate (Bs per $1)')).toBeEnabled();
});

test('viewer: sees data, cannot change anything', async ({ browser }) => {
  const page = await newPage(browser);
  await firstSignIn(page, 'viewer@test.example', issued.viewer, PASSWORDS.viewer);
  await expect(page.getByText('You have view-only access')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New lead' })).toHaveCount(0);
  await expect(page.locator('.metric', { hasText: 'Total customers' }).locator('.stat-value')).toHaveText('13');

  await page.getByRole('link', { name: /^Leads & customers/ }).click();
  await page.locator('tbody tr').first().getByRole('button', { name: /Actions for/ }).click();
  await expect(page.getByRole('menuitem')).toHaveText(['View profile']);
  await page.keyboard.press('Escape');

  await page.goto('/leads/C-1005');
  await expect(page.getByRole('heading', { name: 'Gabriela Torres' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0);
  await expect(page.getByLabel('Pipeline stage')).toBeDisabled();
  await expect(page.getByText('Log a conversation')).toHaveCount(0);

  await page.getByRole('link', { name: /^Pipeline/ }).click();
  await expect(page.locator('.kanban-card').first()).toBeVisible();
  await expect(page.locator('.kanban-move')).toHaveCount(0);

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Users' })).toHaveCount(0);
  await expect(page.getByLabel('Exchange rate (Bs per $1)')).toBeDisabled();
});

test('editor: changes CRM data that everyone sees; no user management', async ({ browser, page }) => {
  const editor = await newPage(browser);
  await firstSignIn(editor, 'editor@test.example', issued.editor, PASSWORDS.editor);
  await editor.getByRole('button', { name: 'New lead' }).click();
  const dialog = editor.getByRole('dialog');
  await dialog.getByLabel('Full name').fill('Shared Lead Test');
  await dialog.getByLabel('Phone / WhatsApp').fill('+58 414 555 0444');
  await dialog.getByRole('button', { name: 'Add lead' }).click();
  await expect(editor.getByRole('heading', { name: 'Shared Lead Test' })).toBeVisible();

  await editor.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(editor.getByRole('tab', { name: 'Users' })).toHaveCount(0);
  await expect(editor.getByRole('tab', { name: 'Data' })).toHaveCount(0);
  await expect(editor.getByLabel('Exchange rate (Bs per $1)')).toBeDisabled();

  // The admin, in another browser, sees the editor's lead (shared database)
  await signedIn(page, 'admin@test.example', PASSWORDS.admin);
  await page.getByLabel('Search everything').fill('Shared Lead');
  await expect(page.getByRole('option', { name: /Shared Lead Test/ })).toBeVisible();
});

test('admin: role change, disable and reset password take effect', async ({ browser, page }) => {
  const viewer = await newPage(browser);
  await signedIn(viewer, 'viewer@test.example', PASSWORDS.viewer);
  await expect(viewer.getByText('You have view-only access')).toBeVisible();

  await signedIn(page, 'admin@test.example', PASSWORDS.admin);
  await page.goto('/settings?tab=users');
  await page.getByLabel('Role for Vera Viewer').selectOption('editor');
  await expect(page.getByText('Vera Viewer is now Edit / Write')).toBeVisible();

  // Viewer's next page load picks up the new role
  await viewer.reload();
  await expect(viewer.getByRole('button', { name: 'New lead' })).toBeVisible();

  // Disable: the open session ends
  await page.getByTestId('user-viewer@test.example').getByRole('button', { name: /Actions for/ }).click();
  await page.getByRole('menuitem', { name: 'Disable sign-in' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Disable sign-in' }).click();
  await expect(page.getByTestId('user-viewer@test.example')).toContainText('Disabled');
  await viewer.reload();
  await expect(viewer).toHaveURL(/\/login/);

  // Reset password issues a new temporary password
  await page.getByTestId('user-editor@test.example').getByRole('button', { name: /Actions for/ }).click();
  await page.getByRole('menuitem', { name: 'Reset password' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset password' }).click();
  const fresh = (await page.getByTestId('temporary-password').innerText()).trim();
  expect(fresh).toMatch(/^[A-Za-z0-9]{4}(-[A-Za-z0-9]{4}){3}$/);
  await page.getByRole('button', { name: 'Done' }).click();

  const editor = await newPage(browser);
  await signIn(editor, 'editor@test.example', PASSWORDS.editor);
  await expect(editor.getByRole('alert')).toContainText('don’t match');
  await firstSignIn(editor, 'editor@test.example', fresh, 'Editor-pass-2027');
  await expect(editor.locator('.sidebar-user')).toContainText('Edit / Write');
});
