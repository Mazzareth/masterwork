'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// Mock data for recent activity
const mockActivity = [
  { id: 1, player: 'ShadowBlade', action: 'won a ranked match', champion: 'Yasuo', time: '2m ago', type: 'victory' },
  { id: 2, player: 'MysticMage', action: 'achieved a pentakill', champion: 'Azir', time: '5m ago', type: 'achievement' },
  { id: 3, player: 'IronWill', action: 'joined Team Phoenix', champion: null, time: '12m ago', type: 'team' },
  { id: 4, player: 'StormRider', action: 'reached Diamond rank', champion: null, time: '18m ago', type: 'rank' },
  { id: 5, player: 'VoidWalker', action: 'completed 10-game win streak', champion: 'Kassadin', time: '25m ago', type: 'streak' },
  { id: 6, player: 'CrimsonFury', action: 'defeated Team Legends', champion: 'Darius', time: '32m ago', type: 'victory' },
];

// Mock data for ongoing games
const mockOngoingGames = [
  {
    id: 1,
    team1: { name: 'Team Phoenix', players: ['ShadowBlade', 'MysticMage', 'IronWill', 'StormRider', 'VoidWalker'] },
    team2: { name: 'Team Legends', players: ['CrimsonFury', 'FrostBite', 'ThunderStrike', 'BlazeFire', 'NightShade'] },
    duration: '23:45',
    status: 'In Progress'
  },
  {
    id: 2,
    team1: { name: 'Team Valor', players: ['DragonSlayer', 'PhoenixRise', 'SteelGuard', 'WindWalker', 'FlameHeart'] },
    team2: { name: 'Team Honor', players: ['IceBreaker', 'StormCaller', 'ShadowHunter', 'LightBringer', 'DarkMage'] },
    duration: '15:32',
    status: 'In Progress'
  }
];



// Mock data for community stats with rotating fun facts
const mockFunStats = [
  { label: 'Most Played Champion', value: 'Yasuo', icon: '⚔️' },
  { label: 'Player with Most Losses', value: 'FeedMaster69', icon: '💀' },
  { label: 'Longest Win Streak', value: '23 Games', icon: '🔥' },
  { label: 'Most Pentakills Today', value: 'ShadowBlade (3)', icon: '⭐' },
  { label: 'Fastest Game', value: '12:34', icon: '⚡' },
  { label: 'Most AFK Player', value: 'GonePlayer', icon: '👻' },
  { label: 'Champion Never Picked', value: 'Azir', icon: '🦅' },
  { label: 'Most Toxic Player', value: '[REDACTED]', icon: '🤐' }
];

const mockCommunityStats = {
  totalPlayers: 1247,
  activeGames: 23,
  completedToday: 156,
  avgGameTime: '28:34'
};

export default function HubPage() {
  const [currentFunStat, setCurrentFunStat] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFunStat((prev) => (prev + 1) % mockFunStats.length);
    }, 3000); // Rotate every 3 seconds
    return () => clearInterval(interval);
  }, []);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'victory': return '🏆';
      case 'achievement': return '⭐';
      case 'team': return '👥';
      case 'rank': return '📈';
      case 'streak': return '🔥';
      default: return '⚡';
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'victory': return 'badge-success';
      case 'achievement': return 'badge-warning';
      case 'team': return 'badge-info';
      case 'rank': return 'badge-secondary';
      case 'streak': return 'badge-error';
      default: return 'badge-neutral';
    }
  };

  return (
    <div className="min-h-screen bg-base-100 p-4">
      {/* Header */}
      <motion.div 
        className="text-center mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-4xl font-bold text-primary mb-2">HUB</h1>
        <p className="text-base-content/70">Community Activity & Live Games</p>
      </motion.div>

      {/* Community Stats Overview */}
       <motion.div 
         className="stats stats-vertical lg:stats-horizontal shadow mb-6 w-full"
         initial={{ opacity: 0, scale: 0.9 }}
         animate={{ opacity: 1, scale: 1 }}
         transition={{ duration: 0.5, delay: 0.2 }}
       >
         <div className="stat">
           <div className="stat-figure text-primary">
             <span className="text-3xl">👥</span>
           </div>
           <div className="stat-title">Active Players</div>
           <div className="stat-value text-primary">{mockCommunityStats.totalPlayers.toLocaleString()}</div>
           <div className="stat-desc">Online now</div>
         </div>
         
         <div className="stat">
           <div className="stat-figure text-secondary">
             <span className="text-3xl">🔴</span>
           </div>
           <div className="stat-title">Live Games</div>
           <div className="stat-value text-secondary">{mockCommunityStats.activeGames}</div>
           <div className="stat-desc">In progress</div>
         </div>
         
         <div className="stat">
           <div className="stat-figure text-accent">
             <span className="text-3xl">🏆</span>
           </div>
           <div className="stat-title">Games Today</div>
           <div className="stat-value text-accent">{mockCommunityStats.completedToday}</div>
           <div className="stat-desc">Completed</div>
         </div>
         
         <motion.div 
           className="stat cursor-pointer"
           key={currentFunStat}
           initial={{ opacity: 0, scale: 0.8 }}
           animate={{ opacity: 1, scale: 1 }}
           transition={{ duration: 0.5 }}
         >
           <div className="stat-figure text-info">
             <span className="text-3xl">{mockFunStats[currentFunStat].icon}</span>
           </div>
           <div className="stat-title">{mockFunStats[currentFunStat].label}</div>
           <div className="stat-value text-info text-sm lg:text-2xl">{mockFunStats[currentFunStat].value}</div>
           <div className="stat-desc">Fun fact!</div>
         </motion.div>
       </motion.div>

      {/* Main Content - Two Column Layout */}
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
         {/* Recent Activity Feed */}
         <motion.div 
           initial={{ opacity: 0, x: -20 }}
           animate={{ opacity: 1, x: 0 }}
           transition={{ duration: 0.5, delay: 0.3 }}
         >
           <div className="card bg-base-200 shadow-xl h-full">
             <div className="card-body">
               <h2 className="card-title text-primary mb-4">
                 <span className="text-2xl">📈</span>
                 Recent Activity
               </h2>
               <div className="space-y-3 max-h-80 overflow-y-auto">
                 {mockActivity.map((activity, index) => (
                   <motion.div 
                     key={activity.id}
                     className="alert alert-outline"
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ duration: 0.3, delay: index * 0.1 }}
                   >
                     <span className="text-2xl">{getActivityIcon(activity.type)}</span>
                     <div className="flex-1">
                       <div className="flex items-center gap-2">
                         <span className="font-semibold text-primary">{activity.player}</span>
                         <span className={`badge ${getActivityColor(activity.type)} badge-sm`}>
                           {activity.type}
                         </span>
                       </div>
                       <div className="text-sm opacity-70">
                         {activity.action}
                         {activity.champion && (
                           <span className="text-accent ml-1">with {activity.champion}</span>
                         )}
                       </div>
                     </div>
                     <div className="text-xs opacity-50">{activity.time}</div>
                   </motion.div>
                 ))}
               </div>
             </div>
           </div>
         </motion.div>

         {/* Quick Actions */}
         <motion.div 
           initial={{ opacity: 0, x: 20 }}
           animate={{ opacity: 1, x: 0 }}
           transition={{ duration: 0.5, delay: 0.4 }}
         >
           <div className="card bg-base-200 shadow-xl h-full">
             <div className="card-body">
               <h2 className="card-title text-accent mb-6">
                 <span className="text-2xl">⚡</span>
                 Quick Actions
               </h2>
               <div className="space-y-4">
                 <motion.button 
                   className="btn btn-primary btn-block btn-lg"
                   whileHover={{ scale: 1.02 }}
                   whileTap={{ scale: 0.98 }}
                 >
                   <span className="text-2xl">🎮</span>
                   Join Queue
                 </motion.button>
                 <motion.button 
                   className="btn btn-secondary btn-block btn-lg"
                   whileHover={{ scale: 1.02 }}
                   whileTap={{ scale: 0.98 }}
                 >
                   <span className="text-2xl">👥</span>
                   Find Team
                 </motion.button>
                 <motion.button 
                   className="btn btn-accent btn-block btn-lg"
                   whileHover={{ scale: 1.02 }}
                   whileTap={{ scale: 0.98 }}
                 >
                   <span className="text-2xl">📊</span>
                   View Leaderboard
                 </motion.button>
                 <motion.button 
                   className="btn btn-info btn-block btn-lg"
                   whileHover={{ scale: 1.02 }}
                   whileTap={{ scale: 0.98 }}
                 >
                   <span className="text-2xl">⚔️</span>
                   Challenge Team
                 </motion.button>
               </div>
               
               {/* Mini Stats */}
               <div className="divider">Server Status</div>
               <div className="grid grid-cols-2 gap-2">
                 <div className="stat bg-base-300 rounded-lg p-3">
                   <div className="stat-title text-xs">Avg Game Time</div>
                   <div className="stat-value text-sm">{mockCommunityStats.avgGameTime}</div>
                 </div>
                 <div className="stat bg-base-300 rounded-lg p-3">
                   <div className="stat-title text-xs">Queue Time</div>
                   <div className="stat-value text-sm text-success">~2:30</div>
                 </div>
               </div>
             </div>
           </div>
         </motion.div>
       </div>

      {/* Live Games Section - Fixed Height, No Scrolling */}
       <motion.div 
         initial={{ opacity: 0, y: 20 }}
         animate={{ opacity: 1, y: 0 }}
         transition={{ duration: 0.5, delay: 0.5 }}
       >
         <div className="card bg-base-200 shadow-xl">
           <div className="card-body">
             <h2 className="card-title text-info mb-4">
               <span className="text-2xl">🔴</span>
               Live Games
               <div className="badge badge-error badge-sm animate-pulse ml-2">
                 {mockOngoingGames.length} Active
               </div>
             </h2>
             
             <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
               {mockOngoingGames.map((game, index) => (
                 <motion.div 
                   key={game.id}
                   className="card bg-base-300 shadow-lg border border-primary/20"
                   initial={{ opacity: 0, scale: 0.9 }}
                   animate={{ opacity: 1, scale: 1 }}
                   transition={{ duration: 0.3, delay: index * 0.2 }}
                   whileHover={{ scale: 1.01, borderColor: 'rgb(255 107 53 / 0.5)' }}
                 >
                   <div className="card-body p-4">
                     <div className="flex justify-between items-center mb-3">
                       <div className="badge badge-error animate-pulse">
                         🔴 LIVE
                       </div>
                       <div className="font-mono text-lg font-bold text-primary">
                         {game.duration}
                       </div>
                     </div>
                     
                     <div className="space-y-3">
                       {/* Team 1 */}
                       <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/10 p-3 rounded-lg border border-blue-500/20">
                         <h4 className="font-bold text-blue-400 mb-2 text-sm">{game.team1.name}</h4>
                         <div className="flex flex-wrap gap-1">
                           {game.team1.players.slice(0, 3).map((player, playerIndex) => (
                             <span key={playerIndex} className="badge badge-blue badge-xs">
                               {player}
                             </span>
                           ))}
                           {game.team1.players.length > 3 && (
                             <span className="badge badge-ghost badge-xs">+{game.team1.players.length - 3}</span>
                           )}
                         </div>
                       </div>
                       
                       {/* VS Divider */}
                       <div className="text-center">
                         <span className="badge badge-neutral">VS</span>
                       </div>
                       
                       {/* Team 2 */}
                       <div className="bg-gradient-to-r from-red-500/10 to-red-600/10 p-3 rounded-lg border border-red-500/20">
                         <h4 className="font-bold text-red-400 mb-2 text-sm">{game.team2.name}</h4>
                         <div className="flex flex-wrap gap-1">
                           {game.team2.players.slice(0, 3).map((player, playerIndex) => (
                             <span key={playerIndex} className="badge badge-error badge-xs">
                               {player}
                             </span>
                           ))}
                           {game.team2.players.length > 3 && (
                             <span className="badge badge-ghost badge-xs">+{game.team2.players.length - 3}</span>
                           )}
                         </div>
                       </div>
                     </div>
                     
                     <div className="card-actions justify-between mt-3">
                       <div className="text-xs opacity-60">Game #{game.id}</div>
                       <button className="btn btn-primary btn-xs">
                         👁️ Spectate
                       </button>
                     </div>
                   </div>
                 </motion.div>
               ))}
             </div>
             
             {mockOngoingGames.length === 0 && (
               <div className="text-center py-8 opacity-60">
                 <span className="text-4xl mb-2 block">😴</span>
                 <p>No live games right now</p>
                 <p className="text-sm">Check back later or start a match!</p>
               </div>
             )}
           </div>
         </div>
       </motion.div>
    </div>
  );
}