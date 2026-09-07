// src/hooks/useSyncStatus.ts
// Live onboarding-sync state for the non-blocking landing: polls GET /me (never
// GET /diagnostic -- fetching that while 'ready' marks the reveal as seen) while
// anything is still in flight, and stops once every institution's backfill is done
// and the diagnostic is viewed. Drives the SyncChip and the reveal invite.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, Me, SyncItem } from '../api/client';

const POLL_MS = 5000;
// Past this with a backfill still incomplete, the chip switches to the honest
// "this bank is slow" copy instead of implying progress that isn't visible.
const STALL_MS = 10 * 60 * 1000;

export type SyncStatus = {
  items: SyncItem[];
  diagnosticState: Me['onboarding']['diagnosticState'];
  /** A backfill has been incomplete for longer than STALL_MS. */
  stalled: boolean;
  /** Anything worth showing a chip for. */
  active: boolean;
  refetch: () => void;
};

export function useSyncStatus(): SyncStatus {
  const [items, setItems] = useState<SyncItem[]>([]);
  const [diagnosticState, setDiagnosticState] =
    useState<Me['onboarding']['diagnosticState']>('done');
  const [stalled, setStalled] = useState(false);
  const startedAt = useRef(Date.now());

  const load = useCallback(async () => {
    try {
      const me = await api.getMe();
      setItems(me.onboarding.items ?? []);
      setDiagnosticState(me.onboarding.diagnosticState);
      const incomplete = (me.onboarding.items ?? []).some((i) => !i.historicalUpdateComplete);
      setStalled(incomplete && Date.now() - startedAt.current > STALL_MS);
    } catch {
      // Transient fetch failures keep the last known state; the next tick retries.
    }
  }, []);

  const syncing = items.some((i) => !i.historicalUpdateComplete);
  const active = syncing || diagnosticState === 'pending' || diagnosticState === 'ready';

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(t);
  }, [active, load]);

  return { items, diagnosticState, stalled, active, refetch: () => void load() };
}
