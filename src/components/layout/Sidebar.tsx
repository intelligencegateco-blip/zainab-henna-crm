import { BarChart3, CalendarDays, Columns3, LayoutDashboard, LogOut, Palette, Settings, Users } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { todayISO } from '../../lib/format';
import { ROLE_LABEL } from '../../lib/permissions';
import { useAuth } from '../../state/AuthContext';
import { useCrm } from '../../state/CrmContext';
import { Brushstroke } from '../ui/Ornament';

export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/leads', label: 'Leads & customers', icon: Users },
  { to: '/pipeline', label: 'Pipeline', icon: Columns3 },
  { to: '/bookings', label: 'Bookings', icon: CalendarDays },
  { to: '/services', label: 'Services', icon: Palette },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
];

export function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const { user, signOut } = useAuth();
  const { data } = useCrm();
  const today = todayISO();
  const dueFollowUps = data?.followUps.filter((f) => !f.completedAt && f.dueDate <= today).length ?? 0;
  const newInquiries = data?.contacts.filter((c) => !c.archived && c.stage === 'new_inquiry').length ?? 0;
  const counts: Record<string, number> = { '/leads': dueFollowUps, '/pipeline': newInquiries };
  const countLabel: Record<string, string> = { '/leads': 'follow-ups due', '/pipeline': 'new inquiries' };

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Main navigation">
      <div className="sidebar-brand">
        <img src="/brand/zainab-logo.png" alt="Zainab Henna logo" width={52} height={52} />
        <div>
          <span className="brand-name">{data?.settings.businessName ?? 'Zainab Henna'}</span>
          <span className="brand-sub">Studio manager</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} onClick={onNavigate} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Icon aria-hidden />
            <span>{label}</span>
            {counts[to] > 0 && (
              <span className="nav-count" aria-label={`${counts[to]} ${countLabel[to]}`}>
                {counts[to]}
              </span>
            )}
            <Brushstroke className="nav-stroke" width={64} />
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-foot">
        <NavLink to="/settings" onClick={onNavigate} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Settings aria-hidden />
          <span>Settings</span>
          <Brushstroke className="nav-stroke" width={64} />
        </NavLink>
        <div className="sidebar-user">
          <span className="sidebar-user-name">
            {user?.name ?? 'Zainab'}
            {user && <span className="sidebar-role">{ROLE_LABEL[user.role]}</span>}
          </span>
          <span className="sidebar-user-email">{user?.email}</span>
          <button className="nav-item signout" onClick={() => void signOut()}>
            <LogOut aria-hidden />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
