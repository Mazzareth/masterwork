'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

// Mock data
const mockLeaderboard = [
  { rank: 1, name: 'ForgeMaster', lp: 2000, avatar: '/file.svg' },
  // Add more up to 10 or so
];

export default function LeaderboardPage() {
  return (
    <div className="min-h-screen bg-base-100 p-4 flex flex-col items-center">
      <motion.h1 className="text-5xl font-bold text-primary mb-8" initial={{ scale: 0.5 }} animate={{ scale: 1 }}>
        Forge Leaderboard
      </motion.h1>
      {/* Top 3 Podium */}
      <div className="flex justify-center gap-4 mb-8">
        {mockLeaderboard.slice(0,3).map((player, idx) => (
          <motion.div 
            key={player.rank} 
            className={`card bg-base-200 shadow-xl ${idx === 0 ? 'order-2 mt-0' : idx === 1 ? 'order-1 mt-8' : 'order-3 mt-16'} w-64`}
            initial={{ y: 100 }} animate={{ y: 0 }} transition={{ delay: idx * 0.2 }}
          >
            <figure className="px-10 pt-10">
              <Image src={player.avatar} alt={player.name} className="rounded-xl" width={100} height={100} />
            </figure>
            <div className="card-body items-center text-center">
              <h2 className="card-title text-accent">#{player.rank} {player.name}</h2>
              <p>{player.lp} LP</p>
            </div>
          </motion.div>
        ))}
      </div>
      {/* Full Leaderboard Table */}
      <div className="overflow-x-auto w-full max-w-4xl">
        <table className="table table-zebra">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>LP</th>
            </tr>
          </thead>
          <tbody>
            {mockLeaderboard.map(player => (
              <motion.tr key={player.rank} whileHover={{ backgroundColor: '#FF6B35' }}>
                <th>{player.rank}</th>
                <td>{player.name}</td>
                <td>{player.lp}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}