import { motion } from "motion/react";

interface Props {
  checked: boolean;
  disabled?: boolean;
  color: string;
  label: string;
  onToggle: (next: boolean) => void;
}

/**
 * The check-off control. The visible circle sits under a transparent, native
 * `<input type="checkbox" switch>` that receives the actual tap — on iOS that
 * is what fires the Taptic Engine. The wrapper clips the oversized switch so
 * the hit area matches the circle.
 */
export function CheckButton({ checked, disabled, color, label, onToggle }: Props) {
  return (
    <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full">
      <motion.span
        aria-hidden
        className="flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] border-border transition-colors duration-200"
        style={{ borderColor: checked ? color : undefined, backgroundColor: checked ? color : "transparent" }}
        animate={{ scale: checked ? [1, 1.2, 1] : 1 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        <motion.svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="white"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <motion.path d="M5 12.5l4.5 4.5L19 7.5" />
        </motion.svg>
      </motion.span>
      {disabled ? null : (
        <input
          type="checkbox"
          {...{ switch: "" }}
          checked={checked}
          aria-label={label}
          onChange={(e) => onToggle(e.currentTarget.checked)}
          className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 scale-[1.6] cursor-pointer opacity-0"
        />
      )}
    </span>
  );
}
