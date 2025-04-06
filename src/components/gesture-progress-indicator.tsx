"use client";

import { motion } from "motion/react";

interface GestureProgressIndicatorProps {
  gesture: "up" | "down";
  progress: number;
}

export default function GestureProgressIndicator({
  gesture,
  progress,
}: GestureProgressIndicatorProps) {
  const color = gesture === "up" ? "#10B981" : "#EF4444";
  const icon = gesture === "up" ? "👍" : "👎";

  return (
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
      <div className="relative flex items-center justify-center">
        {/* Background circle */}
        <div
          className="absolute w-24 h-24 rounded-full bg-black/50"
          style={{ width: "100px", height: "100px" }}
        />

        {/* Progress circle */}
        <svg width="120" height="120" viewBox="0 0 120 120">
          <motion.circle
            cx="60"
            cy="60"
            r="52"
            fill="none" // Make the circle transparent to show the background
            stroke={color}
            strokeWidth="8"
            strokeDasharray="339.292"
            strokeDashoffset={339.292 * (1 - progress)}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
            initial={{ strokeDashoffset: 339.292 }}
            animate={{ strokeDashoffset: 339.292 * (1 - progress) }}
            transition={{ duration: 0.05, ease: "linear" }}
          />
        </svg>

        {/* Icon */}
        <div className="absolute text-4xl">{icon}</div>
      </div>
    </div>
  );
}
