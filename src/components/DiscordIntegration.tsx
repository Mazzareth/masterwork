'use client';

import { motion } from 'framer-motion';

export default function DiscordIntegration() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="mockup-window border-2 border-primary/50 bg-base-300/80 backdrop-blur-sm shadow-2xl"
    >
      <div className="flex flex-col justify-center p-8 bg-base-200">
        <h2 className="text-3xl font-bold text-primary mb-4 text-center">Discord Integration</h2>
        <p className="text-base-content/80 mb-6 text-center max-w-md mx-auto">
          Your Discord integration is active. Profile updates will be announced in our server.
        </p>
      </div>
    </motion.div>
  );
}