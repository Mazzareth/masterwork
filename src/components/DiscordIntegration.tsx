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
    <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
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


    </div>
  );
}