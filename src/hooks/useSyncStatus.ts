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
// Analysis (backfill done, diagnostic still 'pending') normally lands in ~30s; past
// this it has almost certainly crashed server-side. The chip must say so -- a crashed
// write presented as normal progress is how a production bug stayed invisible.
const ANALYZE_STALL_MS = 3 * 60 * 1000;
// Consecutive /me failures before the chip says the connection is the problem
// instead of freezing a stale count or blaming the bank. Resets on success.
const UNREACHABLE_AFTER = 2;

export type SyncStatus = {
  items: SyncItem[];
  diagnosticState: Me['onboarding']['diagnosticState'];
  /** A backfill has been incomplete for longer than STALL_MS. */
  stalled: boolean;
  /** Backfill finished but the diagnostic has been 'pending' too long -- stuck. */
  analyzingStalled: boolean;
  /** The last UNREACHABLE_AFTER polls failed outright: no state landed at all. */
  unreachable: boolean;
  /** Anything worth showing a chip for. */
  active: boolean;
  refetch: () => void;
};

const sameItems = (a: SyncItem[], b: SyncItem[]): boolean =>
  a.length === b.length &&
  a.every(
    (x, i) =>
      x.institutionName === b[i].institutionName &&
      x.historicalUpdateComplete === b[i].historicalUpdateComplete &&
      x.transactionCount === b[i].transactionCount,
  );

export function useSyncStatus(): SyncStatus {
  const [items, setItems] = useState<SyncItem[]>([]);
  const [diagnosticState, setDiagnosticState] =
    useState<Me['onboarding']['diagnosticState']>('done');
  const [stalled, setStalled] = useState(false);
  const [analyzingStalled, setAnalyzingStalled] = useState(false);
  const [unreachable, setUnreachable] = useState(false);
  const startedAt = useRef(Date.now());
  const analyzingSince = useRef<number | null>(null);
  const failures = useRef(0);

  // Every setState below is a no-op when the value is unchanged (React bails
  // out on identical state; items keep their previous reference when equal), so
  // the 5s poll does not re-render MainTabs and both mounted screens for nothing.
  const load = useCallback(async () => {
    try {
      const me = await api.getMe();
      failures.current = 0;
      setUnreachable(false);
      const nextItems = me.onboarding.items ?? [];
      setItems((prev) => (sameItems(prev, nextItems) ? prev : nextItems));
      setDiagnosticState(me.onboarding.diagnosticState);
      const incomplete = nextItems.some((i) => !i.historicalUpdateComplete);
      setStalled(incomplete && Date.now() - startedAt.current > STALL_MS);
      const analyzing = !incomplete && me.onboarding.diagnosticState === 'pending';
      if (!analyzing) analyzingSince.current = null;
      else analyzingSince.current ??= Date.now();
      setAnalyzingStalled(
        analyzing && Date.now() - (analyzingSince.current ?? Date.now()) > ANALYZE_STALL_MS,
      );
    } catch {
      // The last known state stays up; the next tick retries. Past the threshold
      // the chip says the connection is the problem rather than blaming the bank.
      failures.current += 1;
      if (failures.current >= UNREACHABLE_AFTER) setUnreachable(true);
    }
  }, []);

  const refetch = useCallback(() => void load(), [load]);

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

  return { items, diagnosticState, stalled, analyzingStalled, unreachable, active, refetch };
}
