"use client";

import { motion } from "motion/react";
import { ThumbsUp, ThumbsDown } from "lucide-react";

interface ThankYouMessageProps {
  gesture: "up" | "down" | null;
}

export default function ThankYouMessage({ gesture }: ThankYouMessageProps) {
  const icon =
    gesture === "up" ? <ThumbsUp size={48} /> : <ThumbsDown size={48} />;
  const bgColor = gesture === "up" ? "bg-green-600" : "bg-red-600";
  const message =
    gesture === "up" ? "Thank You!" : "We Appreciate Your Feedback!";

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-30"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className={`${bgColor} rounded-full p-6 mb-4`}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        {icon}
      </motion.div>
      <motion.h2
        className="text-4xl mx-8 font-bold text-white"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {message}
      </motion.h2>
    </motion.div>
  );
}
