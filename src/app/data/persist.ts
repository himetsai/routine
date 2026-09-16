import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";
import { del, get, set } from "idb-keyval";

const KEY = "routine:query-cache";

/** TanStack Query cache in IndexedDB, so the last known state paints before the network answers. */
export const idbPersister: Persister = {
  persistClient: (client: PersistedClient) => set(KEY, client),
  restoreClient: () => get<PersistedClient>(KEY),
  removeClient: () => del(KEY),
};
