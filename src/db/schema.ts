import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const routines = sqliteTable("routines", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  emoji: text("emoji").notNull(),
  color: text("color").notNull(),
  importance: integer("importance").notNull(),
  sortOrder: integer("sort_order").notNull(),
  createdOn: text("created_on").notNull(),
  archivedOn: text("archived_on"),
});

export const schedules = sqliteTable(
  "routine_schedules",
  {
    id: text("id").primaryKey(),
    routineId: text("routine_id")
      .notNull()
      .references(() => routines.id),
    cadence: text("cadence", { enum: ["daily", "weekly"] }).notNull(),
    timesPerWeek: integer("times_per_week"),
    effectiveFrom: text("effective_from").notNull(),
  },
  (t) => [index("schedules_routine_idx").on(t.routineId, t.effectiveFrom)],
);

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    routineId: text("routine_id")
      .notNull()
      .references(() => routines.id),
    forDate: text("for_date").notNull(),
    kind: text("kind", { enum: ["done", "undone", "skip", "unskip"] }).notNull(),
    loggedAt: text("logged_at").notNull(),
    note: text("note"),
  },
  (t) => [index("events_routine_date_idx").on(t.routineId, t.forDate)],
);

export const pauses = sqliteTable("pauses", {
  id: text("id").primaryKey(),
  routineId: text("routine_id").references(() => routines.id),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  note: text("note"),
});

/** Single row, id = 1. */
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  dayCutoffHour: integer("day_cutoff_hour").notNull().default(4),
});

export const loginAttempts = sqliteTable("login_attempts", {
  ip: text("ip").primaryKey(),
  count: integer("count").notNull(),
  windowStart: text("window_start").notNull(),
});
