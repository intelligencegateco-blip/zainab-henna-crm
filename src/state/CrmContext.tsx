import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { errorMessage } from '../lib/format';
import { buildContactViews, type ContactView } from '../lib/selectors';
import { ValidationError } from '../lib/validation';
import { crmService, type CrmService } from '../services';
import type { CrmSnapshot } from '../types/models';
import { useToast } from './ToastContext';

type Status = 'loading' | 'ready' | 'error';

interface CrmApi {
  status: Status;
  error: string | null;
  data: CrmSnapshot | null;
  /** Contacts with derived status, totals and next follow-up. */
  views: ContactView[];
  reload: () => Promise<void>;
  /** Show the loading state again and re-fetch (after a load error). */
  retry: () => Promise<void>;
  /**
   * Run a write through the service, refresh data, and show a toast.
   * Re-throws so forms can show field errors and stay open.
   */
  run: <T>(action: (service: CrmService) => Promise<T>, successMessage?: string) => Promise<T>;
}

const CrmContext = createContext<CrmApi | null>(null);

export function CrmProvider({ children, service = crmService }: { children: ReactNode; service?: CrmService }) {
  const toast = useToast();
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CrmSnapshot | null>(null);
  const hasData = useRef(false);

  const reload = useCallback(async () => {
    try {
      const snapshot = await service.repository.getSnapshot();
      setData(snapshot);
      hasData.current = true;
      setError(null);
      setStatus('ready');
    } catch (err) {
      setError(errorMessage(err));
      if (!hasData.current) setStatus('error');
      else toast.error(`Couldn’t refresh data. ${errorMessage(err)}`);
    }
  }, [service, toast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = useCallback(
    async <T,>(action: (s: CrmService) => Promise<T>, successMessage?: string): Promise<T> => {
      try {
        const result = await action(service);
        await reload();
        if (successMessage) toast.success(successMessage);
        return result;
      } catch (err) {
        // Field-level problems are shown inline by the form.
        if (!(err instanceof ValidationError)) toast.error(errorMessage(err));
        await reload();
        throw err;
      }
    },
    [service, reload, toast],
  );

  const retry = useCallback(async () => {
    setStatus('loading');
    await reload();
  }, [reload]);

  const views = useMemo(() => (data ? buildContactViews(data) : []), [data]);

  const value = useMemo(
    () => ({ status, error, data, views, reload, retry, run }),
    [status, error, data, views, reload, retry, run],
  );
  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}

export function useCrm(): CrmApi {
  const ctx = useContext(CrmContext);
  if (!ctx) throw new Error('useCrm must be used inside CrmProvider');
  return ctx;
}

/** For pages that only render once data is loaded (AppShell guarantees it). */
export function useCrmData() {
  const { data, ...rest } = useCrm();
  if (!data) throw new Error('CRM data not loaded yet');
  return { data, ...rest };
}
