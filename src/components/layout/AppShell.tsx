import { Menu, Plus } from 'lucide-react';
import { Suspense, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LeadFormModal } from '../../features/leads/LeadFormModal';
import { useCrm } from '../../state/CrmContext';
import { Button } from '../ui/Button';
import { ErrorState, PageSkeleton } from '../ui/States';
import { GlobalSearch } from './GlobalSearch';
import { Sidebar } from './Sidebar';

export function AppShell() {
  const { status, error, retry } = useCrm();
  const [navOpen, setNavOpen] = useState(false);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const navigate = useNavigate();

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
          <Button variant="primary" icon={<Plus />} onClick={() => setNewLeadOpen(true)} disabled={status !== 'ready'} className="topbar-new" aria-label="New lead">
            <span className="label-long">New lead</span>
          </Button>
        </header>

        <main id="main" tabIndex={-1}>
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
