import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useCallback, useEffect, useState } from "react";
import { registerSW } from "virtual:pwa-register";
import type { Routine } from "../engine";
import { Overview } from "./components/Overview";
import { RoutineCard } from "./components/RoutineCard";
import { RoutineSheet } from "./components/RoutineSheet";
import { SettingsSheet } from "./components/SettingsSheet";
import { SignIn } from "./components/SignIn";
import { SummaryCard } from "./components/SummaryCard";
import { Toasts } from "./components/Toasts";
import { Today } from "./components/Today";
import { bindOutbox, flush, outbox, usePending } from "./data/outbox";
import { useOwner } from "./data/owner";
import { idbPersister } from "./data/persist";
import { toast } from "./data/toast";
import { useCelebrations } from "./data/useCelebrations";
import { useOnline } from "./data/useOnline";
import { useIndex, useSnapshotQuery, useToday } from "./data/useSnapshot";

const MONTH = 30 * 24 * 60 * 60 * 1000;

function makeQueryClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true, gcTime: MONTH } },
  });
  bindOutbox(client);
  return client;
}

export default function App() {
  const [queryClient] = useState(makeQueryClient);

  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh: () => toast("A new version is ready", "info", { ms: 0, action: { label: "reload", onClick: () => void updateSW(true) } }),
    });
  }, []);

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: idbPersister, maxAge: MONTH }}>
      <Dashboard />
      <Toasts />
    </PersistQueryClientProvider>
  );
}

type SheetState = { kind: "closed" } | { kind: "routine"; routine: Routine | null } | { kind: "settings" };

function Dashboard() {
  const owner = useOwner();
  const online = useOnline();
  const pending = usePending();
  const { data, error, isPending } = useSnapshotQuery(owner);
  const idx = useIndex(data);
  const today = useToday(data?.settings.dayCutoffHour);
  const [sheet, setSheet] = useState<SheetState>({ kind: "closed" });
  const close = useCallback(() => setSheet({ kind: "closed" }), []);
  useCelebrations(idx, today, owner);

  // Restore the unsent queue, then deliver whenever we can: on sign-in, on
  // reconnect, and whenever the app comes back to the foreground.
  useEffect(() => {
    let cancelled = false;
    void outbox.hydrate().then(() => {
      if (!cancelled && owner) void flush();
    });
    return () => {
      cancelled = true;
    };
  }, [owner]);
  useEffect(() => {
    if (!owner) return;
    const kick = () => document.visibilityState === "visible" && void flush();
    window.addEventListener("online", kick);
    document.addEventListener("visibilitychange", kick);
    return () => {
      window.removeEventListener("online", kick);
      document.removeEventListener("visibilitychange", kick);
    };
  }, [owner]);

  // Keep the sheet's routine fresh after edits.
  const sheetRoutine = sheet.kind === "routine" && sheet.routine ? (idx?.routine(sheet.routine.id) ?? sheet.routine) : null;
  const openRoutine = (routine: Routine) => setSheet({ kind: "routine", routine });

  return (
    <div className="space-y-3">
      <div className="flex h-7 items-center gap-4 px-1 text-sm">
        {!online ? (
          <span className="rounded-md bg-fg/5 px-1.5 py-0.5 text-xs font-medium text-muted">offline{pending.length ? ` · ${pending.length} to sync` : ""}</span>
        ) : pending.length ? (
          <span className="rounded-md bg-fg/5 px-1.5 py-0.5 text-xs font-medium text-muted">syncing…</span>
        ) : null}
        <span className="ml-auto flex items-center gap-4">
          {owner && idx ? (
            <button type="button" onClick={() => setSheet({ kind: "settings" })} className="link">
              Settings
            </button>
          ) : null}
          <SignIn owner={owner} />
        </span>
      </div>
      {idx ? (
        <>
          {owner ? <SummaryCard idx={idx} today={today} /> : null}
          <Today idx={idx} today={today} owner={owner} onOpen={openRoutine} onCreate={() => setSheet({ kind: "routine", routine: null })} />
          <Overview idx={idx} today={today} />
          {idx.routines
            .filter((r) => idx.exists(r, today))
            .map((r) => (
              <RoutineCard key={r.id} idx={idx} routine={r} today={today} onOpen={owner ? openRoutine : undefined} />
            ))}
          {owner ? (
            <>
              <RoutineSheet idx={idx} today={today} routine={sheetRoutine} open={sheet.kind === "routine"} onClose={close} />
              <SettingsSheet idx={idx} today={today} open={sheet.kind === "settings"} onClose={close} />
            </>
          ) : null}
        </>
      ) : error ? (
        <section className="card p-5 text-sm text-muted">Couldn't load. {String(error.message)}</section>
      ) : isPending ? (
        <section className="card p-5">
          <div className="h-6 w-20 animate-pulse rounded bg-fg/10" />
          <div className="mt-4 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-fg/5" />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
