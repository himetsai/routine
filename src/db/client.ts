import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

export function makeDb(url: string, authToken?: string) {
  return drizzle(createClient({ url, authToken: authToken || undefined }), { schema });
}

export type Db = ReturnType<typeof makeDb>;
