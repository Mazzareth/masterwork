'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import Image from 'next/image';

interface DiscordProfile {
  id: string;
  username: string;
  avatar: string;
}

interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  discordProfile?: DiscordProfile;
  leagueIGN?: string;
  hashtag?: string;
  primaryRole?: string;
  secondaryRole?: string;
}

export default function DiscordIntegration({ profile }: { profile: UserProfile | null }) {
  const [leagueIGN, setLeagueIGN] = useState(profile?.leagueIGN || '');
  const [hashtag, setHashtag] = useState(profile?.hashtag || '');
  const [isLinking, setIsLinking] = useState(false);

  // Sync local state with profile data
  useEffect(() => {
    setLeagueIGN(profile?.leagueIGN || '');
    setHashtag(profile?.hashtag || '');
  }, [profile?.leagueIGN, profile?.hashtag]);

  const handleDiscordLink = async () => {
    setIsLinking(true);
    try {
      window.location.href = '/api/auth/discord';
    } catch (error) {
      console.error('Error linking Discord:', error);
      setIsLinking(false);
    }
  };

  const getDiscordAvatarUrl = (avatar: string, id: string) => {
    if (avatar) {
      return `https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=128`;
    }
    return `https://cdn.discordapp.com/embed/avatars/${parseInt(id) % 5}.png`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Discord Integration Section */}
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="card bg-base-200/80 backdrop-blur-sm shadow-2xl border border-primary/30"
      >
        <div className="card-body">
          <motion.h2 
            className="card-title text-2xl font-bold text-primary mb-6 flex items-center gap-3"
            animate={{ 
              textShadow: ['0 0 10px rgba(114, 137, 218, 0.5)', '0 0 20px rgba(114, 137, 218, 0.8)', '0 0 10px rgba(114, 137, 218, 0.5)'] 
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="text-3xl">🎮</span>
            Discord Integration
          </motion.h2>
          
          {profile?.discordProfile ? (
            <motion.div 
              className="space-y-4"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
            >
              <div className="alert alert-success shadow-lg">
                <span className="text-2xl">✅</span>
                <div>
                  <h3 className="font-bold text-lg">Discord Connected!</h3>
                  <div className="text-sm opacity-75">Your account is successfully linked</div>
                </div>
              </div>
              
              <div className="flex items-center gap-4 p-4 bg-base-300/50 rounded-box border border-primary/20">
                <motion.div 
                  className="avatar"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div className="w-16 h-16 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                    <Image
                      src={getDiscordAvatarUrl(profile.discordProfile.avatar, profile.discordProfile.id)}
                      alt="Discord Avatar"
                      width={64}
                      height={64}
                      className="rounded-full"
                    />
                  </div>
                </motion.div>
                <div className="flex-1">
                  <p className="font-bold text-lg text-primary">{profile.discordProfile.username}</p>
                  <p className="text-sm text-base-content/60">ID: {profile.discordProfile.id}</p>
                  <div className="badge badge-primary badge-sm mt-2">Verified</div>
                </div>
              </div>
              
              <div className="text-center">
                <p className="text-xs text-base-content/50">
                  🔔 Profile updates will be announced in our Discord server
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              className="text-center space-y-6"
              initial={{ opacity: 0.7 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="text-6xl mb-4">🔗</div>
              <div>
                <h3 className="text-xl font-bold text-base-content mb-2">Connect Your Discord</h3>
                <p className="text-base-content/70 mb-6">
                  Link your Discord account to join the Masterwork community and receive notifications about your matches!
                </p>
              </div>
              
              <motion.button
                onClick={handleDiscordLink}
                disabled={isLinking}
                className="btn btn-primary btn-lg gap-3 shadow-xl"
                whileHover={{ 
                  scale: 1.05,
                  boxShadow: '0 0 30px rgba(114, 137, 218, 0.6)'
                }}
                whileTap={{ scale: 0.95 }}
                animate={{
                  backgroundImage: [
                    'linear-gradient(45deg, #7289DA, #5865F2)',
                    'linear-gradient(45deg, #5865F2, #4752C4)',
                    'linear-gradient(45deg, #4752C4, #7289DA)'
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                {isLinking ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Connecting...
                  </>
                ) : (
                  <>
                    <span className="text-xl">🎮</span>
                    Link Discord Account
                  </>
                )}
              </motion.button>
              
              <div className="text-xs text-base-content/50 space-y-1">
                <p>🔒 Secure OAuth2 authentication</p>
                <p>📊 Track your game statistics</p>
                <p>🏆 Join tournaments and events</p>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* League of Legends Section */}
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="card bg-base-200/80 backdrop-blur-sm shadow-2xl border border-secondary/30"
      >
        <div className="card-body">
          <motion.h2 
            className="card-title text-2xl font-bold text-secondary mb-6 flex items-center gap-3"
            animate={{ 
              textShadow: ['0 0 10px rgba(200, 155, 60, 0.5)', '0 0 20px rgba(200, 155, 60, 0.8)', '0 0 10px rgba(200, 155, 60, 0.5)'] 
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="text-3xl">⚔️</span>
            League of Legends
          </motion.h2>
          
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* IGN Input */}
              <motion.div 
                className="form-control"
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <label className="label">
                  <span className="label-text font-bold text-secondary flex items-center gap-2">
                    <span className="text-lg">🎯</span>
                    Summoner Name (IGN)
                  </span>
                </label>
                <motion.input
                  type="text"
                  placeholder="Enter your IGN"
                  className="input input-bordered input-secondary w-full focus:ring-2 focus:ring-secondary/50"
                  value={leagueIGN}
                  onChange={(e) => setLeagueIGN(e.target.value)}
                  whileFocus={{ 
                    boxShadow: '0 0 20px rgba(200, 155, 60, 0.3)',
                    borderColor: 'rgb(200, 155, 60)'
                  }}
                />
              </motion.div>
              
              {/* Hashtag Input */}
              <motion.div 
                className="form-control"
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <label className="label">
                  <span className="label-text font-bold text-secondary flex items-center gap-2">
                    <span className="text-lg">#️⃣</span>
                    Tag Line
                  </span>
                </label>
                <motion.input
                  type="text"
                  placeholder="#TAG"
                  className="input input-bordered input-secondary w-full focus:ring-2 focus:ring-secondary/50"
                  value={hashtag}
                  onChange={(e) => setHashtag(e.target.value)}
                  whileFocus={{ 
                    boxShadow: '0 0 20px rgba(200, 155, 60, 0.3)',
                    borderColor: 'rgb(200, 155, 60)'
                  }}
                />
              </motion.div>
            </div>
            
            {/* Preview Card */}
            {(leagueIGN || hashtag) && (
              <motion.div 
                className="alert alert-info shadow-lg"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 200 }}
              >
                <span className="text-2xl">🎮</span>
                <div>
                  <h3 className="font-bold">Summoner Preview</h3>
                  <div className="text-sm">
                    {leagueIGN && hashtag ? (
                      <span className="font-mono text-lg">{leagueIGN}#{hashtag}</span>
                    ) : leagueIGN ? (
                      <span className="font-mono text-lg">{leagueIGN}<span className="opacity-50">#TAG</span></span>
                    ) : (
                      <span className="font-mono text-lg opacity-50">IGN#{hashtag}</span>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
            
            {/* Info Section */}
            <div className="bg-base-300/50 rounded-box p-4 border border-secondary/20">
              <h4 className="font-bold text-secondary mb-2 flex items-center gap-2">
                <span className="text-lg">ℹ️</span>
                How to find your Riot ID
              </h4>
              <div className="text-sm text-base-content/70 space-y-1">
                <p>• Open League of Legends client</p>
                <p>• Look at the top right corner</p>
                <p>• Your Riot ID format: <span className="font-mono bg-base-100 px-1 rounded">Name#TAG</span></p>
                <p>• Example: <span className="font-mono bg-base-100 px-1 rounded text-secondary">Faker#KR1</span></p>
              </div>
            </div>
            
            {/* Coming Soon Features */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: '📊', title: 'Rank Tracking', desc: 'Auto-sync your rank' },
                { icon: '🏆', title: 'Match History', desc: 'View recent games' },
                { icon: '📈', title: 'Statistics', desc: 'Performance analytics' },
                { icon: '🎯', title: 'Champion Stats', desc: 'Main champion data' }
              ].map((feature, index) => (
                <motion.div
                  key={feature.title}
                  className="bg-base-300/30 rounded-box p-3 text-center border border-secondary/10"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 * index, duration: 0.3 }}
                  whileHover={{ scale: 1.05, backgroundColor: 'rgba(200, 155, 60, 0.1)' }}
                >
                  <div className="text-2xl mb-1">{feature.icon}</div>
                  <div className="text-xs font-bold text-secondary">{feature.title}</div>
                  <div className="text-xs text-base-content/60">{feature.desc}</div>
                  <div className="badge badge-secondary badge-xs mt-1">Soon</div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}