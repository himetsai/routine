import { AnimatePresence, motion } from "motion/react";
import { dismiss, useToasts } from "../data/toast";

export function Toasts() {
  const toasts = useToasts();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            className={`pointer-events-auto flex items-center gap-3 rounded-full px-4 py-2 text-sm font-bold shadow-md ${
              t.tone === "error" ? "bg-bad text-white" : "bg-primary text-background"
            }`}
          >
            <span>{t.message}</span>
            {t.action ? (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
                className="rounded-full bg-white/20 px-2.5 py-0.5 hover:bg-white/30"
              >
                {t.action.label}
              </button>
            ) : null}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
