import { expect, test, type Page } from '@playwright/test';
import { createSeedData } from '../../src/data/seed';

/**
 * Runs in local mode (playwright.config.ts) and against the PHP API
 * (playwright.api.config.ts, port 5175). In API mode each test signs in with a
 * real account and starts from fresh demo data loaded through the API.
 */
const apiMode = () => test.info().project.use.baseURL?.includes(':5175') ?? false;

test.beforeEach(async ({ request }) => {
  if (!apiMode()) return;
  const headers = { 'X-Requested-With': 'zainab-crm' };
  const login = await request.post('/api/auth/login', { headers, data: { email: 'e2e@test.example', password: 'Workflow-pass-2026' } });
  expect(login.ok()).toBe(true);
  const reset = await request.post('/api/admin/replace-data', { headers, data: createSeedData(new Date()) });
  expect(reset.status()).toBe(204);
});

async function signIn(page: Page) {
  await page.goto('/login');
  if (apiMode()) {
    await page.getByLabel('Email').fill('e2e@test.example');
    await page.getByLabel('Password').fill('Workflow-pass-2026');
  } else {
    await page.getByRole('button', { name: 'Fill in demo details' }).click();
  }
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('.today-band')).toBeVisible();
}

/** Reads a dashboard metric tile's number. */
async function metric(page: Page, label: string): Promise<string> {
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  const tile = page.locator('.metric', { hasText: label });
  return (await tile.locator('.stat-value').innerText()).split('\n')[0].trim();
}

const toNumber = (s: string) => Number(s.replace(/[^0-9.]/g, ''));

test('sign-in rejects wrong credentials and accepts the demo ones', async ({ page }) => {
  test.skip(apiMode(), 'Covered by the role tests in API mode');
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel('Email').fill('someone@example.com');
  await page.getByLabel('Password').fill('nope');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('don’t match');
  await page.getByRole('button', { name: 'Fill in demo details' }).click();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('.today-band')).toBeVisible();
});

test('create a lead (with validation), then edit it', async ({ page }) => {
  await signIn(page);
  const newLeadsBefore = toNumber(await metric(page, 'New leads'));

  await page.getByRole('button', { name: 'New lead' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Add lead' }).click();
  await expect(dialog.getByText('Enter the full name')).toBeVisible();
  await expect(dialog.getByText('Phone number looks too short or too long')).toBeVisible();

  await dialog.getByLabel('Full name').fill('Mariela Testa');
  await dialog.getByLabel('Phone / WhatsApp').fill('+58 414 555 0999');
  await dialog.getByLabel('Email').fill('mariela@example.com');
  await dialog.getByLabel('Instagram').fill('mariela.test');
  await dialog.getByLabel('Service interested in').selectOption({ label: 'Party / Event Henna' });
  await dialog.getByLabel('Number of people').fill('8');
  await expect(dialog.getByLabel('Estimated value (USD)')).toHaveValue('120');
  await dialog.getByLabel('Event type').selectOption('birthday');
  await dialog.getByRole('button', { name: 'Add lead' }).click();

  await expect(page).toHaveURL(/\/leads\/C-\d+/);
  await expect(page.getByRole('heading', { name: 'Mariela Testa' })).toBeVisible();
  await expect(page.getByText('@mariela.test')).toBeVisible();
  await expect(page.locator('.timeline')).toContainText('Lead added from Instagram');

  // Edit
  await page.getByRole('button', { name: 'Edit' }).click();
  const edit = page.getByRole('dialog');
  await edit.getByLabel('Full name').fill('Mariela Testa Rojas');
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: 'Mariela Testa Rojas' })).toBeVisible();

  expect(toNumber(await metric(page, 'New leads'))).toBe(newLeadsBefore + 1);
});

test('move a lead through the pipeline and convert it into a booking', async ({ page }) => {
  await signIn(page);
  const upcomingBefore = toNumber(await metric(page, 'Upcoming bookings'));
  const customersBefore = toNumber(await metric(page, 'Total customers'));

  await page.getByRole('link', { name: /^Pipeline/ }).click();
  const card = page.locator('.kanban-card', { hasText: 'Camila Fernández' });
  await card.getByLabel('Move Camila Fernández to stage').selectOption('quote_sent');
  await expect(page.locator('.stage-quote_sent .kanban-card', { hasText: 'Camila Fernández' })).toBeVisible();

  // Booking confirmed requires booking details
  await page
    .locator('.kanban-card', { hasText: 'Camila Fernández' })
    .getByLabel('Move Camila Fernández to stage')
    .selectOption('booking_confirmed');
  const dialog = page.getByRole('dialog', { name: 'Confirm the booking' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Start time').fill('11:30');
  await dialog.getByLabel('Location').fill('Chacao, Caracas');
  await dialog.getByRole('button', { name: 'Save booking' }).click();
  await expect(page.locator('.stage-booking_confirmed .kanban-card', { hasText: 'Camila Fernández' })).toBeVisible();

  // Drag and drop also works: drag Lucía from New inquiry to Contacted
  await page
    .locator('.kanban-card', { hasText: 'Lucía Herrera' })
    .dragTo(page.locator('.kanban-col.stage-contacted'));
  await expect(page.locator('.stage-contacted .kanban-card', { hasText: 'Lucía Herrera' })).toBeVisible();

  // Booking appears in Bookings
  await page.getByRole('link', { name: 'Bookings', exact: true }).click();
  await expect(page.locator('tbody tr', { hasText: 'Camila Fernández' })).toContainText('Confirmed');

  expect(toNumber(await metric(page, 'Upcoming bookings'))).toBe(upcomingBefore + 1);
  expect(toNumber(await metric(page, 'Total customers'))).toBe(customersBefore + 1);
});

test('create, edit and complete a booking; revenue updates', async ({ page }) => {
  await signIn(page);
  const revenueBefore = toNumber(await metric(page, 'Revenue'));
  const completedBefore = toNumber(await metric(page, 'Completed bookings'));

  await page.getByRole('link', { name: 'Bookings', exact: true }).click();
  await page.getByRole('button', { name: 'New booking' }).click();
  let dialog = page.getByRole('dialog', { name: 'New booking' });
  await dialog.getByLabel('Customer').selectOption({ label: 'Rosa Villalobos (+58 412-555-0150)' });
  await dialog.getByLabel('Service').selectOption({ label: 'Custom Henna Design' });
  await dialog.getByLabel('Date').fill('2026-12-12');
  await dialog.getByLabel('Location').fill('Studio, Chacao');
  await dialog.getByLabel('Price (USD)').fill('60');
  await dialog.getByLabel('Deposit received (USD)').fill('100');
  await dialog.getByRole('button', { name: 'Add booking' }).click();
  await expect(dialog.getByText('Deposit cannot exceed the price')).toBeVisible();
  await dialog.getByLabel('Deposit received (USD)').fill('20');
  await dialog.getByRole('button', { name: 'Add booking' }).click();
  await expect(dialog).toBeHidden();

  const row = page.locator('tbody tr', { hasText: 'Rosa Villalobos' });
  await expect(row).toContainText('$40');

  // Edit: change the price
  await row.click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Price (USD)').fill('70');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(row).toContainText('$50');

  // Complete via actions menu
  await row.getByRole('button', { name: /Actions for booking/ }).click();
  await page.getByRole('menuitem', { name: 'Mark completed' }).click();
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.getByLabel('Search bookings').fill('Rosa');
  await expect(page.locator('tbody tr', { hasText: 'Rosa Villalobos' })).toContainText('Completed');

  expect(toNumber(await metric(page, 'Completed bookings'))).toBe(completedBefore + 1);
  expect(toNumber(await metric(page, 'Revenue'))).toBe(revenueBefore + 70);
});

test('customer profile: history, notes, interactions and follow-ups', async ({ page }) => {
  await signIn(page);
  await page.goto('/leads/C-1005');
  await expect(page.getByRole('heading', { name: 'Gabriela Torres' })).toBeVisible();
  await expect(page.locator('.profile-stats')).toContainText('Total spent');

  await page.getByRole('tab', { name: /Bookings/ }).click();
  await expect(page.getByRole('heading', { name: 'Previous' })).toBeVisible();
  await expect(page.locator('.booking-rows li')).toHaveCount(4);

  await page.getByRole('tab', { name: /Communication/ }).click();
  await page.getByLabel('What happened').fill('Confirmed she wants a lotus design.');
  await page.getByRole('button', { name: 'Log interaction' }).click();
  await expect(page.locator('.timeline li').first()).toContainText('lotus design');

  await page.getByLabel('Notes', { exact: true }).fill('Prefers lotus motifs.');
  await page.getByRole('button', { name: 'Save notes' }).click();
  await expect(page.getByText('Notes saved')).toBeVisible();

  await page.getByRole('tab', { name: /Follow-ups/ }).click();
  await page.getByLabel('Reminder').fill('Send aftercare photo request');
  await page.getByRole('button', { name: 'Schedule follow-up' }).click();
  await expect(page.locator('.followup-list').first()).toContainText('Send aftercare photo request');
  await page.locator('.followup-list').first().getByRole('button', { name: 'Mark done' }).first().click();
  await expect(page.locator('.followup-list.done')).toContainText('Send aftercare photo request');

  // Reload keeps data (persistence)
  await page.reload();
  await expect(page.getByLabel('Notes', { exact: true })).toHaveValue('Prefers lotus motifs.');
});

test('search, filters, sorting, pagination and archive/delete with confirmation', async ({ page }) => {
  await signIn(page);
  await page.getByRole('link', { name: /^Leads & customers/ }).click();

  // Accent-insensitive search
  await page.getByLabel('Search leads').fill('gutierrez');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText('Mariana Gutiérrez');
  await page.getByRole('button', { name: 'Clear filters' }).click();

  // Phone search
  await page.getByLabel('Search leads').fill('0101');
  await expect(page.locator('tbody tr')).toContainText('Samira Haddad');
  await page.getByRole('button', { name: 'Clear filters' }).click();

  // Source filter
  await page.getByLabel('Source').selectOption('website');
  const rows = page.locator('tbody tr');
  expect(await rows.count()).toBeGreaterThan(0);
  for (const text of await rows.locator('td:nth-child(5)').allInnerTexts()) expect(text).toBe('Website');
  await page.getByRole('button', { name: 'Clear filters' }).click();

  // Pagination
  await expect(page.locator('.pagination')).toContainText('1–10 of 30');
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.locator('.pagination')).toContainText('11–20 of 30');

  // Sort by name
  await page.getByRole('button', { name: /^Name/ }).click();
  await expect(page.locator('tbody tr').first()).toContainText('Alejandra Ochoa');

  // Archive
  const row = page.locator('tbody tr', { hasText: 'Alejandra Ochoa' });
  await row.getByRole('button', { name: /Actions for/ }).click();
  await page.getByRole('menuitem', { name: 'Archive' }).click();
  await expect(page.getByText('Alejandra Ochoa archived')).toBeVisible();
  await page.getByRole('tab', { name: /Archived/ }).click();
  await expect(page.getByRole('tab', { name: /Archived/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('tbody tr')).toContainText('Alejandra Ochoa');

  // Delete asks for confirmation
  await page.locator('tbody tr', { hasText: 'Alejandra Ochoa' }).getByRole('button', { name: /Actions for/ }).click();
  await page.getByRole('menuitem', { name: 'Delete permanently' }).click();
  const confirm = page.getByRole('dialog', { name: /Delete Alejandra Ochoa/ });
  await confirm.getByRole('button', { name: 'Keep it' }).click();
  await expect(page.locator('tbody tr')).toContainText('Alejandra Ochoa');
  await page.locator('tbody tr', { hasText: 'Alejandra Ochoa' }).getByRole('button', { name: /Actions for/ }).click();
  await page.getByRole('menuitem', { name: 'Delete permanently' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete permanently' }).click();
  await expect(page.getByText('Nothing archived')).toBeVisible();

  // Global search
  await page.getByLabel('Search everything').fill('samira');
  await page.getByRole('option', { name: /Samira Haddad/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Samira Haddad' })).toBeVisible();
});

test('analytics responds to date filters; services and settings work', async ({ page }) => {
  await signIn(page);
  await page.getByRole('link', { name: 'Analytics', exact: true }).click();
  const total = page.locator('.stat', { hasText: 'Total leads' }).locator('.stat-value');
  const yearCount = toNumber(await total.innerText());
  await page.getByLabel('Analytics period').selectOption('last30');
  await expect.poll(async () => toNumber(await total.innerText())).toBeLessThan(yearCount);
  await page.getByLabel('Analytics period').selectOption('custom');
  await page.getByLabel('From', { exact: true }).fill('2026-09-01');
  await page.getByLabel('To', { exact: true }).fill('2026-09-30');
  await expect(page.getByText(/1 Sep 2026 to 30 Sep 2026/)).toBeVisible();
  // Table view of a chart
  await page.locator('.chart-card', { hasText: 'Leads by source' }).getByRole('button', { name: 'Table' }).click();
  await expect(page.locator('.chart-card', { hasText: 'Leads by source' }).locator('table')).toBeVisible();

  // Services: change a price and deactivate
  await page.getByRole('link', { name: 'Services', exact: true }).click();
  const item = page.locator('.price-list li', { hasText: 'Traditional Henna' });
  await item.getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('dialog').getByLabel('Base price (USD)').fill('40');
  await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
  await expect(item).toContainText('$40');
  await item.getByLabel('Offer this service').uncheck();
  await expect(item).toContainText('Inactive');

  // Settings: exchange rate drives bolívar display
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Exchange rate (Bs per $1)').fill('200');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByText('Settings saved')).toBeVisible();
  await page.getByRole('link', { name: 'Services', exact: true }).click();
  await expect(page.locator('.price-list li', { hasText: 'Traditional Henna' })).toContainText('Bs 8.000,00');
});

test('website inquiry arrives as a new lead with a follow-up', async ({ page }) => {
  await signIn(page);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Visitante Web');
  await page.getByLabel('Phone / WhatsApp').fill('+58 412 555 0777');
  await page.getByLabel('Message').fill('Henna for my sister’s wedding?');
  await page.getByRole('button', { name: 'Send test inquiry' }).click();
  await expect(page.getByRole('heading', { name: 'Visitante Web' })).toBeVisible();
  await expect(page.locator('.timeline')).toContainText('Website inquiry: Henna for my sister’s wedding?');
  await expect(page.locator('.profile-stats')).toContainText('Today');
});

test('mobile layout: navigation drawer works', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('link', { name: 'Bookings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bookings', level: 1 })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
