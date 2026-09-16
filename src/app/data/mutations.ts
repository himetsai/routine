import { actions } from "astro:actions";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { SNAPSHOT_KEY } from "./outbox";
import { toast } from "./toast";

type Actions = typeof actions;
type Input<K extends keyof Actions> = Parameters<Actions[K]>[0];

/**
 * Non-event writes (routines, pauses, settings) need the network; they call
 * the action, refetch the snapshot, and surface errors as toasts.
 */
export function useMutate() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async <K extends keyof Actions>(name: K, input: Input<K>): Promise<boolean> => {
      setBusy(true);
      try {
        const { error } = await (actions[name] as (i: Input<K>) => Promise<{ error?: { message: string } }>)(input);
        if (error) {
          toast(error.message, "error");
          return false;
        }
        await queryClient.invalidateQueries({ queryKey: SNAPSHOT_KEY });
        return true;
      } catch {
        toast("You're offline — this change needs a connection", "error");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [queryClient],
  );

  return { run, busy };
}
