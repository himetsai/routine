import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import type { Routine } from "../engine";
import { Overview } from "./components/Overview";
import { RoutineCard } from "./components/RoutineCard";
import { RoutineSheet } from "./components/RoutineSheet";
import { SettingsSheet } from "./components/SettingsSheet";
import { SignIn } from "./components/SignIn";
import { Toasts } from "./components/Toasts";
import { Today } from "./components/Today";
import { bindOutbox, flush } from "./data/outbox";
import { useOwner } from "./data/owner";
import { useIndex, useSnapshotQuery, useToday } from "./data/useSnapshot";

function makeQueryClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } },
  });
  bindOutbox(client);
  return client;
}

export default function App() {
  const [queryClient] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
      <Toasts />
    </QueryClientProvider>
  );
}

type SheetState = { kind: "closed" } | { kind: "routine"; routine: Routine | null } | { kind: "settings" };

function Dashboard() {
  const owner = useOwner();
  const { data, error, isPending } = useSnapshotQuery(owner);
  const idx = useIndex(data);
  const today = useToday(data?.settings.dayCutoffHour);
  const [sheet, setSheet] = useState<SheetState>({ kind: "closed" });
  const close = useCallback(() => setSheet({ kind: "closed" }), []);

  useEffect(() => {
    if (owner) void flush();
  }, [owner]);

  // Keep the sheet's routine fresh after edits.
  const sheetRoutine = sheet.kind === "routine" && sheet.routine ? (idx?.routine(sheet.routine.id) ?? sheet.routine) : null;
  const openRoutine = (routine: Routine) => setSheet({ kind: "routine", routine });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-3 px-1">
        {owner && idx ? (
          <button type="button" onClick={() => setSheet({ kind: "settings" })} className="text-xs text-secondary/60 hover:text-secondary">
            settings
          </button>
        ) : null}
        <SignIn owner={owner} />
      </div>
      {idx ? (
        <>
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
        <section className="card p-6 text-secondary">Couldn't load. {String(error.message)}</section>
      ) : isPending ? (
        <section className="card p-6">
          <div className="h-7 w-24 animate-pulse rounded bg-primary/10" />
          <div className="mt-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-xl bg-primary/5" />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
