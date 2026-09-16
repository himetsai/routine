import { DATABASE_AUTH_TOKEN, DATABASE_URL } from "astro:env/server";
import { makeDb } from "./client";

export const db = makeDb(DATABASE_URL, DATABASE_AUTH_TOKEN);
