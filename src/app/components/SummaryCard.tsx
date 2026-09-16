import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { addDays, dayOfWeek, dayReport, weekReport, type Index, type ISODate } from "../../engine";

const KEY = "routine:lastSeen";

interface Props {
  idx: Index;
  today: ISODate;
}

/** "Yesterday: …" — shown once, on the first open after the day rolls over. */
export function SummaryCard({ idx, today }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const last = localStorage.getItem(KEY);
    if (last && last < today) setShow(true);
    localStorage.setItem(KEY, today);
  }, [today]);

  if (!show) return null;
  const yesterday = addDays(today, -1);
  const report = dayReport(idx, yesterday, today);
  const weeklyDone = report.weekly.filter((w) => idx.mark(w.routine.id, yesterday) === "done").map((w) => w.routine.emoji);
  const lastWeek = dayOfWeek(yesterday) === 6 ? weekReport(idx, yesterday, today) : null;
  if (report.due === 0 && weeklyDone.length === 0 && !lastWeek) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`card flex items-center justify-between gap-4 px-5 py-3 ${report.perfect ? "ring-2 ring-good/40" : ""}`}
    >
      <p className="text-sm">
        <span className="font-bold">Yesterday</span>
        <span className="text-secondary">
          {report.due > 0 ? ` · ${report.done}/${report.due} daily` : ""}
          {report.perfect ? " · perfect day" : ""}
          {weeklyDone.length ? ` · ${weeklyDone.join(" ")}` : ""}
          {lastWeek?.letter ? ` · last week: ${lastWeek.letter}${lastWeek.perfect ? " ♥" : ""}` : ""}
        </span>
      </p>
      <button type="button" onClick={() => setShow(false)} aria-label="Dismiss" className="text-secondary/50 hover:text-primary">
        ✕
      </button>
    </motion.section>
  );
}
