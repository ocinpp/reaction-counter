"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

interface GestureCounterProps {
  count: number;
  icon: ReactNode;
  bgColor: string;
}

export default function GestureCounter({
  count,
  icon,
  bgColor,
}: GestureCounterProps) {
  return (
    <motion.div
      className={`${bgColor} rounded-full px-6 py-3 flex items-center gap-2 shadow-lg backdrop-blur-sm`}
      initial={{ scale: 1 }}
      animate={{
        scale: [1, 1.2, 1],
        /* delay 1 second so that it is shown after the thank you page is finished */
        transition: { duration: 1, delay: 1 },
      }}
      key={count} // This forces the animation to run on count change
    >
      <span className="text-white">{icon}</span>
      <motion.span
        className="text-white text-2xl font-bold"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        key={count}
      >
        {count}
      </motion.span>
    </motion.div>
  );
}
