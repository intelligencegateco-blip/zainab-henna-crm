import { lazy, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { EmptyState } from './components/ui/States';
import { LoginPage } from './features/auth/LoginPage';
import { AuthProvider, useAuth } from './state/AuthContext';
import { CrmProvider } from './state/CrmContext';
import { ToastProvider } from './state/ToastContext';

// Each page loads on demand, so the first screen downloads less.
const AnalyticsPage = lazy(() => import('./features/analytics/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const BookingsPage = lazy(() => import('./features/bookings/BookingsPage').then((m) => ({ default: m.BookingsPage })));
const CustomerProfilePage = lazy(() => import('./features/customers/CustomerProfilePage').then((m) => ({ default: m.CustomerProfilePage })));
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const LeadsPage = lazy(() => import('./features/leads/LeadsPage').then((m) => ({ default: m.LeadsPage })));
const PipelinePage = lazy(() => import('./features/pipeline/PipelinePage').then((m) => ({ default: m.PipelinePage })));
const ServicesPage = lazy(() => import('./features/services/ServicesPage').then((m) => ({ default: m.ServicesPage })));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));

function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <CrmProvider>{children}</CrmProvider>;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="leads" element={<LeadsPage />} />
              <Route path="leads/:id" element={<CustomerProfilePage />} />
              <Route path="pipeline" element={<PipelinePage />} />
              <Route path="bookings" element={<BookingsPage />} />
              <Route path="services" element={<ServicesPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route
                path="*"
                element={
                  <div className="page">
                    <EmptyState title="Page not found" message="That address doesn’t match any page. Use the menu to find your way." />
                  </div>
                }
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
