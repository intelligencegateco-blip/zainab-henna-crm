import { Menu, Plus } from 'lucide-react';
import { Suspense, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LeadFormModal } from '../../features/leads/LeadFormModal';
import { ChangePasswordForm } from '../../features/settings/ChangePasswordForm';
import { useAuth, usePermissions } from '../../state/AuthContext';
import { useCrm } from '../../state/CrmContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ErrorState, PageSkeleton } from '../ui/States';
import { GlobalSearch } from './GlobalSearch';
import { Sidebar } from './Sidebar';

export function AppShell() {
  const { status, error, retry } = useCrm();
  const [navOpen, setNavOpen] = useState(false);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { canWrite } = usePermissions();

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Sidebar open={navOpen} onNavigate={() => setNavOpen(false)} />
      {navOpen && <div className="sidebar-scrim" onClick={() => setNavOpen(false)} aria-hidden />}

      <div className="main-col">
        <header className="topbar">
          <Button variant="ghost" iconOnly icon={<Menu />} className="menu-toggle" onClick={() => setNavOpen(true)} aria-expanded={navOpen}>
            Open menu
          </Button>
          <img className="topbar-logo" src="/brand/zainab-logo.png" alt="Zainab Henna" width={36} height={36} />
          <GlobalSearch />
          {canWrite && <Button variant="primary" icon={<Plus />} onClick={() => setNewLeadOpen(true)} disabled={status !== 'ready'} className="topbar-new" aria-label="New lead">
            <span className="label-long">New lead</span>
          </Button>}
        </header>

        <main id="main" tabIndex={-1}>
          {user && !user.mustChangePassword && user.role === 'viewer' && (
            <p className="role-notice">You have view-only access. Ask an Admin or Owner if you need to make changes.</p>
          )}
          {status === 'loading' && <PageSkeleton />}
          {status === 'error' && (
            <div className="page">
              <ErrorState
                message={`${error ?? 'The data source did not respond.'} Your data is safe; nothing was changed.`}
                onRetry={() => void retry()}
              />
            </div>
          )}
          {status === 'ready' && (
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          )}
        </main>
      </div>

      {user?.mustChangePassword && (
        <Modal
          open
          locked
          onClose={() => undefined}
          title="Choose your own password"
          description="You signed in with a temporary password. Set a new one to continue."
          footer={
            <Button variant="ghost" onClick={() => void signOut()}>
              Sign out
            </Button>
          }
        >
          <ChangePasswordForm submitLabel="Save and continue" />
        </Modal>
      )}

      {newLeadOpen && (
        <LeadFormModal
          open
          onClose={() => setNewLeadOpen(false)}
          onSaved={(contact) => navigate(`/leads/${contact.id}`)}
        />
      )}
    </div>
  );
}
