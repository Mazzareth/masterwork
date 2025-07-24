'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useIOSPointer } from '@/contexts/IOSPointerContext';

export default function PointerDemoPage() {
  const { isEnabled, setIsEnabled } = useIOSPointer();
  const [selectedOption, setSelectedOption] = useState('option1');
  const [inputValue, setInputValue] = useState('');

  return (
      <div className={`min-h-screen bg-base-100 p-4 lg:p-8 ${!isEnabled ? 'ios-pointer-disabled' : ''}`}>
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl lg:text-6xl font-bold text-primary mb-4">
              🎯 iOS Pointer 2.0
            </h1>
            <p className="text-lg text-base-content/70 mb-6">
              A new kind of pointer: it expands to encase interactive elements.
            </p>

            {/* Toggle Switch */}
            <div className="flex items-center justify-center gap-4">
              <span className="text-sm">Standard Cursor</span>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
              />
              <span className="text-sm">iOS Pointer</span>
            </div>
          </motion.div>

          {/* Demo Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Buttons Section */}
            <motion.div
              className="card bg-base-200 shadow-xl"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="card-body">
                <h2 className="card-title text-secondary mb-6">
                  <span className="text-2xl">🔘</span>
                  Button Interactions
                </h2>

                <div className="space-y-4">
                  <button className="btn btn-primary btn-lg w-full">
                    <span className="text-xl">🚀</span>
                    Primary Action
                  </button>

                  <button className="btn btn-secondary btn-outline w-full">
                    <span className="text-xl">⚡</span>
                    Secondary Action
                  </button>

                  <button className="btn btn-accent btn-ghost w-full">
                    <span className="text-xl">✨</span>
                    Ghost Button
                  </button>

                  <div className="flex gap-2">
                    <button className="btn btn-circle btn-primary">
                      <span className="text-xl">❤️</span>
                    </button>
                    <button className="btn btn-circle btn-secondary">
                      <span className="text-xl">⭐</span>
                    </button>
                    <button className="btn btn-circle btn-accent">
                      <span className="text-xl">🔥</span>
                    </button>
                    <button className="btn btn-circle btn-info">
                      <span className="text-xl">💎</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Form Elements Section */}
            <motion.div
              className="card bg-base-200 shadow-xl"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="card-body">
                <h2 className="card-title text-accent mb-6">
                  <span className="text-2xl">📝</span>
                  Form Controls
                </h2>

                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Enter your username"
                    className="input input-bordered w-full"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                  />

                  <select
                    className="select select-bordered w-full"
                    value={selectedOption}
                    onChange={(e) => setSelectedOption(e.target.value)}
                  >
                    <option value="option1">🎮 Gaming Mode</option>
                    <option value="option2">⚔️ Combat Mode</option>
                    <option value="option3">🏆 Tournament Mode</option>
                  </select>

                  <textarea
                    className="textarea textarea-bordered w-full"
                    placeholder="Share your strategy..."
                    rows={3}
                  ></textarea>

                  <div className="flex items-center gap-2">
                    <input type="checkbox" className="checkbox checkbox-primary" />
                    <span className="text-sm">Enable notifications</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Navigation Links */}
            <motion.div
              className="card bg-base-200 shadow-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="card-body">
                <h2 className="card-title text-info mb-6">
                  <span className="text-2xl">🔗</span>
                  Navigation Links
                </h2>

                <div className="space-y-3">
                  <a href="#" className="link link-primary text-lg block hover:link-hover">
                    🏠 Home Dashboard
                  </a>
                  <a href="#" className="link link-secondary text-lg block hover:link-hover">
                    👤 Profile Settings
                  </a>
                  <a href="#" className="link link-accent text-lg block hover:link-hover">
                    🎯 Queue System
                  </a>
                  <a href="#" className="link link-info text-lg block hover:link-hover">
                    🏆 Leaderboards
                  </a>
                </div>
              </div>
            </motion.div>

            {/* Interactive Cards */}
            <motion.div
              className="card bg-base-200 shadow-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="card-body">
                <h2 className="card-title text-warning mb-6">
                  <span className="text-2xl">🎴</span>
                  Interactive Cards
                </h2>

                <div className="space-y-4">
                  <div className="card bg-base-300 shadow cursor-pointer hover:shadow-lg transition-all duration-300 interactive-element">
                    <div className="card-body p-4">
                      <h3 className="font-bold">🎮 Game Mode</h3>
                      <p className="text-sm text-base-content/70">Click to select</p>
                    </div>
                  </div>

                  <div className="card bg-base-300 shadow cursor-pointer hover:shadow-lg transition-all duration-300 interactive-element">
                    <div className="card-body p-4">
                      <h3 className="font-bold">⚔️ Battle Arena</h3>
                      <p className="text-sm text-base-content/70">Enter the battlefield</p>
                    </div>
                  </div>

                  <div className="card bg-base-300 shadow cursor-pointer hover:shadow-lg transition-all duration-300 interactive-element">
                    <div className="card-body p-4">
                      <h3 className="font-bold">🏆 Championships</h3>
                      <p className="text-sm text-base-content/70">Compete for glory</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Instructions */}
          <motion.div
            className="mt-12 card bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <div className="card-body text-center">
              <h3 className="card-title justify-center text-primary mb-4">
                <span className="text-2xl">🎯</span>
                How It Works
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                <div>
                  <div className="text-2xl mb-2">👻</div>
                  <h4 className="font-bold mb-1">Ghost Pointer</h4>
                  <p className="text-base-content/70">A subtle dot follows your every move.</p>
                </div>
                <div>
                  <div className="text-2xl mb-2">🖼️</div>
                  <h4 className="font-bold mb-1">Encasing Box</h4>
                  <p className="text-base-content/70">The main pointer expands to frame targets.</p>
                </div>
                <div>
                  <div className="text-2xl mb-2">✨</div>
                  <h4 className="font-bold mb-1">Snappy Feel</h4>
                  <p className="text-base-content/70">Smooth, responsive animations.</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Status Indicator */}
          <motion.div
            className="fixed bottom-4 right-4 z-50"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1 }}
          >
            <div
              className={`badge badge-lg ${isEnabled ? 'badge-success' : 'badge-neutral'} shadow-lg`}
            >
              <span className="text-lg mr-2">
                {isEnabled ? '🎯' : '🖱️'}
              </span>
              {isEnabled ? 'iOS Pointer Active' : 'Standard Cursor'}
            </div>
          </motion.div>
        </div>
      </div>
  );
}