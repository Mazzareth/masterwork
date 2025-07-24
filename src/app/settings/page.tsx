'use client';

import { motion } from 'framer-motion';

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-base-100 p-4 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl lg:text-5xl font-bold text-primary mb-4">Settings</h1>
          <p className="text-lg text-base-content/70">Manage your application settings.</p>
        </motion.div>

        <motion.div
          className="card bg-base-200 shadow-xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="card-body">
            <h2 className="card-title text-secondary mb-6">
              <span className="text-2xl">⚙️</span>
              General Settings
            </h2>
            <p className="text-base-content/70">Future settings will be implemented here.</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}