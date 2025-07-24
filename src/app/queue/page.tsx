'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Mock queue data with enhanced information
const mockQueues = [
  { 
    id: 'solo',
    type: 'Solo Queue', 
    description: 'Individual ranked matches',
    players: 45, 
    estTime: '2:15', 
    icon: '👤',
    difficulty: 'Competitive',
    avgRank: 'Gold II'
  },
  { 
    id: 'flex',
    type: 'Flex Queue', 
    description: 'Team-based ranked matches',
    players: 30, 
    estTime: '3:42', 
    icon: '👥',
    difficulty: 'Strategic',
    avgRank: 'Silver I'
  },
  { 
    id: 'draft',
    type: 'Draft Pick', 
    description: 'Casual draft matches',
    players: 67, 
    estTime: '1:28', 
    icon: '🎯',
    difficulty: 'Casual',
    avgRank: 'Mixed'
  }
];

// Mock recent matches for activity feed
const mockRecentMatches = [
  { player: 'ShadowBlade', result: 'Victory', duration: '28:34', champion: 'Yasuo' },
  { player: 'MysticMage', result: 'Defeat', duration: '31:12', champion: 'Azir' },
  { player: 'IronWill', result: 'Victory', duration: '25:45', champion: 'Garen' },
  { player: 'StormRider', result: 'Victory', duration: '33:21', champion: 'Jinx' },
];

// Mock queue tips
const queueTips = [
  { title: 'Champion Mastery', tip: 'Play champions you\'re comfortable with in ranked matches', icon: '⚔️' },
  { title: 'Ward Vision', tip: 'Vision control wins games - buy wards and place them strategically', icon: '👁️' },
  { title: 'Team Communication', tip: 'Use pings effectively to communicate with your team', icon: '💬' },
  { title: 'Objective Control', tip: 'Prioritize dragons, baron, and towers over kills', icon: '🏆' },
];

export default function QueuePage() {
  const [isQueuing, setIsQueuing] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
  const [queueTime, setQueueTime] = useState(0);
  const [currentTip, setCurrentTip] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isQueuing) {
      interval = setInterval(() => {
        setQueueTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isQueuing]);

  useEffect(() => {
    const tipInterval = setInterval(() => {
      setCurrentTip(prev => (prev + 1) % queueTips.length);
    }, 4000);
    return () => clearInterval(tipInterval);
  }, []);

  const handleJoin = (queueId: string) => {
    setSelectedQueue(queueId);
    setIsQueuing(true);
    setQueueTime(0);
    // Simulate queue
    setTimeout(() => {
      setIsQueuing(false);
      setSelectedQueue(null);
    }, 8000);
  };

  const handleLeaveQueue = () => {
    setIsQueuing(false);
    setSelectedQueue(null);
    setQueueTime(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-base-100 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div 
          className="text-center mb-8"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl lg:text-6xl font-bold text-primary mb-4">
            QUEUE
          </h1>
          <p className="text-lg text-base-content/70">
            Find your next match and climb the ranks
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {!isQueuing ? (
            <motion.div
              key="queue-selection"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Queue Options */}
              <div className="lg:col-span-2 space-y-4">
                <motion.h2 
                  className="text-2xl font-bold text-secondary mb-6"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  🎮 Available Queues
                </motion.h2>
                
                <div className="grid gap-4">
                  {mockQueues.map((queue, idx) => (
                    <motion.div 
                      key={queue.id}
                      className="card bg-base-200 shadow-xl border border-primary/20 hover:border-primary/50 transition-all duration-300"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: idx * 0.1 }}
                      whileHover={{ scale: 1.02, y: -5 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="card-body">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="text-4xl">{queue.icon}</div>
                            <div>
                              <h3 className="card-title text-primary">{queue.type}</h3>
                              <p className="text-sm text-base-content/70">{queue.description}</p>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="badge badge-success badge-lg mb-2">
                              {queue.players} players
                            </div>
                            <div className="text-sm text-base-content/70">
                              Est. {queue.estTime}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between mt-4">
                          <div className="flex gap-2">
                            <div className="badge badge-outline">{queue.difficulty}</div>
                            <div className="badge badge-ghost">{queue.avgRank}</div>
                          </div>
                          
                          <motion.button 
                            className="btn btn-primary btn-lg"
                            onClick={() => handleJoin(queue.id)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <span className="text-xl">🚀</span>
                            Join Queue
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Recent Activity */}
                <motion.div 
                  className="card bg-base-200 shadow-xl"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="card-body">
                    <h3 className="card-title text-accent mb-4">
                      <span className="text-2xl">📊</span>
                      Recent Matches
                    </h3>
                    <div className="space-y-3">
                      {mockRecentMatches.map((match, idx) => (
                        <motion.div 
                          key={idx}
                          className="flex items-center justify-between p-2 bg-base-300 rounded-lg"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + idx * 0.1 }}
                        >
                          <div>
                            <div className="font-semibold text-sm">{match.player}</div>
                            <div className="text-xs text-base-content/60">{match.champion}</div>
                          </div>
                          <div className="text-right">
                            <div className={`badge badge-xs ${
                              match.result === 'Victory' ? 'badge-success' : 'badge-error'
                            }`}>
                              {match.result}
                            </div>
                            <div className="text-xs text-base-content/60">{match.duration}</div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>

                {/* Queue Tips */}
                <motion.div 
                  className="card bg-base-200 shadow-xl"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <div className="card-body">
                    <h3 className="card-title text-info mb-4">
                      <span className="text-2xl">💡</span>
                      Pro Tips
                    </h3>
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentTip}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.5 }}
                        className="text-center"
                      >
                        <div className="text-3xl mb-2">{queueTips[currentTip].icon}</div>
                        <h4 className="font-bold text-primary mb-2">{queueTips[currentTip].title}</h4>
                        <p className="text-sm text-base-content/70">{queueTips[currentTip].tip}</p>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="queue-active"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center justify-center min-h-[60vh]"
            >
              <div className="card bg-base-200 shadow-2xl border border-primary/30 max-w-md w-full">
                <div className="card-body text-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="text-6xl mb-4"
                  >
                    ⚔️
                  </motion.div>
                  
                  <h2 className="card-title justify-center text-primary mb-4">
                    Finding Your Match
                  </h2>
                  
                  <div className="space-y-4">
                    <div className="text-lg font-mono text-accent">
                      {formatTime(queueTime)}
                    </div>
                    
                    <motion.div 
                      className="w-full bg-base-300 rounded-full h-3 overflow-hidden"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                    >
                      <motion.div 
                        className="h-full bg-gradient-to-r from-primary to-secondary"
                        initial={{ width: '0%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 8, ease: "easeInOut" }}
                      />
                    </motion.div>
                    
                    <p className="text-base-content/70">
                      Searching for players in {mockQueues.find(q => q.id === selectedQueue)?.type}...
                    </p>
                    
                    <motion.button 
                      className="btn btn-error btn-outline"
                      onClick={handleLeaveQueue}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Leave Queue
                    </motion.button>
                  </div>
                </div>
              </div>
              
              {/* Queue Status */}
              <motion.div 
                className="mt-8 stats stats-horizontal shadow"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
              >
                <div className="stat">
                  <div className="stat-figure text-primary">
                    <span className="text-2xl">👥</span>
                  </div>
                  <div className="stat-title">Queue Position</div>
                  <div className="stat-value text-primary">#{Math.floor(queueTime / 10) + 1}</div>
                </div>
                
                <div className="stat">
                  <div className="stat-figure text-secondary">
                    <span className="text-2xl">⏱️</span>
                  </div>
                  <div className="stat-title">Avg Wait</div>
                  <div className="stat-value text-secondary">
                    {mockQueues.find(q => q.id === selectedQueue)?.estTime}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}