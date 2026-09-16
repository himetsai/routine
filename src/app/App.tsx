import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Overview } from "./components/Overview";
import { RoutineCard } from "./components/RoutineCard";
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

function Dashboard() {
  const owner = useOwner();
  const { data, error, isPending } = useSnapshotQuery(owner);
  const idx = useIndex(data);
  const today = useToday(data?.settings.dayCutoffHour);

  useEffect(() => {
    if (owner) void flush();
  }, [owner]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end px-1">
        <SignIn owner={owner} />
      </div>
      {idx ? (
        <>
          <Today idx={idx} today={today} owner={owner} />
          <Overview idx={idx} today={today} />
          {idx.routines
            .filter((r) => idx.exists(r, today))
            .map((r) => (
              <RoutineCard key={r.id} idx={idx} routine={r} today={today} />
            ))}
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
