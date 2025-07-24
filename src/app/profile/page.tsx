'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { auth } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { getUserProfile, createUserProfile, updateUserProfile } from '@/lib/firestoreUtils';
import DiscordIntegration from '@/components/DiscordIntegration';

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

export default function ProfilePage() {
  const [user] = useAuthState(auth);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [leagueIGN, setLeagueIGN] = useState('');
  const [hashtag, setHashtag] = useState('');
  const [primaryRole, setPrimaryRole] = useState('');
  const [secondaryRole, setSecondaryRole] = useState('');
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });
  const [activeTab, setActiveTab] = useState('profile');

  const roleOptions = ["Top", "Jungle", "Mid", "ADC", "Support"];
  const [lanes, setLanes] = useState<string[]>([]);

  useEffect(() => {
    const fetchProfileAndSetSession = async () => {
      if (user) {
        // Set session cookie
        try {
          const idToken = await user.getIdToken();
          await fetch('/api/auth/session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ idToken }),
          });
        } catch (error) {
          console.error('Error setting session:', error);
        }

        // Fetch user profile
        const userProfile = await getUserProfile(user.uid);
        if (userProfile) {
          setProfile(userProfile);
          setLeagueIGN(userProfile.leagueIGN || '');
          setHashtag(userProfile.hashtag || '');
          setPrimaryRole(userProfile.primaryRole || '');
          setSecondaryRole(userProfile.secondaryRole || '');
        } else {
          // Create a basic profile if one doesn't exist
          const newProfile: UserProfile = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
          };
          await createUserProfile(newProfile);
          setProfile(newProfile);
        }
      }
      setLoading(false);
    };
    fetchProfileAndSetSession();
  }, [user]);

  const handleSaveProfile = async () => {
    if (user && profile) {
      const idToken = await user.getIdToken();
      const updatedData: Partial<UserProfile> & { lanes?: string[] } = {
        leagueIGN,
        hashtag,
        primaryRole,
        secondaryRole,
        lanes: [primaryRole.toLowerCase(), secondaryRole.toLowerCase()].filter(Boolean),
      };

      try {
        await fetch('/api/profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify(updatedData),
        });

        setProfile({ ...profile, ...updatedData });

        // Notify discord channel of profile update
        try {
          await fetch('/api/bot', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ displayName: profile.displayName || 'A player' }),
          });
        } catch (botError) {
          console.error('Failed to send Discord notification:', botError);
        }

        setToast({ show: true, message: 'Profile updated successfully!', type: 'success' });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
      } catch (error) {
        console.error('Error updating profile:', error);
        setToast({ show: true, message: 'Error updating profile.', type: 'error' });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
      }
    }
  };

  // Update local state when profile changes (e.g., after Discord linking)
  useEffect(() => {
    if (profile) {
      setLeagueIGN(profile.leagueIGN || '');
      setHashtag(profile.hashtag || '');
      setPrimaryRole(profile.primaryRole || '');
      setSecondaryRole(profile.secondaryRole || '');
    }
  }, [profile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <motion.div 
          className="loading loading-spinner loading-lg text-primary"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
        <motion.p 
          className="ml-4 text-2xl text-primary font-bold"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          Loading your profile...
        </motion.p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <motion.div 
          className="card bg-base-200 shadow-2xl border border-primary/50"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="card-body text-center">
            <h2 className="card-title text-primary text-2xl">Access Denied</h2>
            <p className="text-base-content/70">Please log in to view your profile.</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-base-100 via-base-200 to-base-300 relative overflow-hidden`}>
      {/* Animated Background Elements */}
      <motion.div 
        className="absolute inset-0 opacity-10"
        animate={{ 
          background: [
            'radial-gradient(circle at 20% 50%, #FF6B35 0%, transparent 50%)',
            'radial-gradient(circle at 80% 50%, #FF8C42 0%, transparent 50%)',
            'radial-gradient(circle at 50% 20%, #E55A2B 0%, transparent 50%)'
          ]
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      
      {/* Floating Particles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 bg-primary/30 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [-20, 20, -20],
            x: [-10, 10, -10],
            opacity: [0.3, 0.8, 0.3]
          }}
          transition={{
            duration: 4 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 2
          }}
        />
      ))}

      {/* Toast Notification */}
      <AnimatePresence>
        {toast.show && (
          <motion.div 
            className="toast toast-top toast-center z-50"
            initial={{ opacity: 0, y: -50, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <motion.div 
              className={`alert alert-${toast.type} shadow-2xl border border-${toast.type}/50`}
              animate={{ boxShadow: ['0 0 20px rgba(255, 107, 53, 0.3)', '0 0 40px rgba(255, 107, 53, 0.6)', '0 0 20px rgba(255, 107, 53, 0.3)'] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <span className="font-bold">{toast.message}</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 p-4 min-h-screen flex flex-col">
        {/* Header */}
        <motion.div 
          className="text-center mb-8"
          initial={{ opacity: 0, y: -100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, type: "spring", stiffness: 100 }}
        >
          <motion.h1 
            className="text-6xl md:text-8xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent mb-4"
            animate={{ 
              backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
            }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            style={{ backgroundSize: '200% 200%' }}
          >
            PROFILE
          </motion.h1>
          <motion.div 
            className="w-32 h-1 bg-gradient-to-r from-primary to-secondary mx-auto rounded-full"
            animate={{ scaleX: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.div>

        {/* Main Content */}
        <div className="flex-1 max-w-7xl mx-auto w-full">
          {/* Navigation Tabs */}
          <motion.div 
            className="flex justify-center mb-8"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            <div className="tabs tabs-boxed bg-base-200/80 backdrop-blur-sm shadow-2xl border border-primary/20">
              {[ 
                { key: 'profile', label: 'Profile' },
                { key: 'preferences', label: 'Preferences' },
                { key: 'integrations', label: 'Integrations' }
              ].map((tab) => (
                <motion.a
                  key={tab.key}
                  role="tab"
                  className={`tab tab-lg font-bold transition-all duration-300 ${
                    activeTab === tab.key 
                      ? 'tab-active text-primary-content bg-primary shadow-lg' 
                      : 'hover:text-primary hover:bg-primary/10'
                  }`}
                  onClick={() => setActiveTab(tab.key)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  animate={activeTab === tab.key ? { 
                    boxShadow: ['0 0 20px rgba(255, 107, 53, 0.5)', '0 0 30px rgba(255, 107, 53, 0.8)', '0 0 20px rgba(255, 107, 53, 0.5)'] 
                  } : {}}
                  transition={{ duration: 1.5, repeat: activeTab === tab.key ? Infinity : 0 }}
                >
                  {tab.label}
                </motion.a>
              ))}
            </div>
          </motion.div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            {activeTab === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, x: -100, rotateY: -90 }}
                animate={{ opacity: 1, x: 0, rotateY: 0 }}
                exit={{ opacity: 0, x: 100, rotateY: 90 }}
                transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-8"
              >
                {/* Profile Avatar Card */}
                <motion.div 
                  className="lg:col-span-1"
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div className="card bg-base-200/80 backdrop-blur-sm shadow-2xl border border-primary/30 h-full">
                    <div className="card-body items-center text-center">
                      <motion.div 
                        className="avatar mb-6"
                        animate={{ 
                          boxShadow: [
                            '0 0 30px rgba(255, 107, 53, 0.3)',
                            '0 0 50px rgba(255, 140, 66, 0.5)',
                            '0 0 30px rgba(255, 107, 53, 0.3)'
                          ]
                        }}
                        transition={{ duration: 3, repeat: Infinity }}
                      >
                        <div className="w-32 h-32 rounded-full ring ring-primary ring-offset-base-100 ring-offset-4">
                          {profile?.photoURL ? (
                            <Image 
                              src={profile.photoURL} 
                              alt="Profile" 
                              width={128} 
                              height={128} 
                              className="rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center text-4xl font-bold text-primary-content">
                              {profile?.displayName?.charAt(0) || '?'}
                            </div>
                          )}
                        </div>
                      </motion.div>
                      <motion.h2 
                        className="text-3xl font-bold text-primary mb-2"
                        animate={{ textShadow: ['0 0 10px rgba(255, 107, 53, 0.5)', '0 0 20px rgba(255, 107, 53, 0.8)', '0 0 10px rgba(255, 107, 53, 0.5)'] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        {profile?.displayName || 'Anonymous Player'}
                      </motion.h2>
                      <p className="text-base-content/70 text-lg">{profile?.email || 'No email provided'}</p>
                      <div className="badge badge-primary badge-lg mt-4 font-bold">Masterwork Player</div>
                    </div>
                  </div>
                </motion.div>

                {/* Stats Cards */}
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { title: 'Level', value: '42', icon: '⚡', color: 'primary' },
                    { title: 'Battles Won', value: '127', icon: '🏆', color: 'secondary' },
                    { title: 'Rank', value: '#3', icon: '👑', color: 'accent' },
                    { title: 'Win Rate', value: '73%', icon: '📊', color: 'info' }
                  ].map((stat, index) => (
                    <motion.div
                      key={stat.title}
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 * index, duration: 0.6 }}
                      whileHover={{ scale: 1.05, rotateY: 5 }}
                      className="card bg-base-200/80 backdrop-blur-sm shadow-xl border border-primary/20 hover:border-primary/50 transition-all duration-300"
                    >
                      <div className="card-body">
                        <div className="stat">
                          <div className="stat-figure text-4xl">{stat.icon}</div>
                          <div className="stat-title text-base-content/70">{stat.title}</div>
                          <motion.div 
                            className={`stat-value text-${stat.color} text-4xl font-bold`}
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 2, repeat: Infinity, delay: index * 0.5 }}
                          >
                            {stat.value}
                          </motion.div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'integrations' && (
              <motion.div
                key="integrations"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <DiscordIntegration profile={profile} />
              </motion.div>
            )}

            {activeTab === 'preferences' && (
              <motion.div
                key="preferences"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="card bg-base-200/80 backdrop-blur-sm shadow-2xl border border-primary/30"
              >
                <div className="card-body">
                  <h2 className="card-title text-2xl text-primary mb-4">Role Preferences</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="form-control w-full">
                      <label className="label">
                        <span className="label-text text-base-content/80">Primary Role</span>
                      </label>
                      <select 
                        className="select select-primary w-full bg-base-100/50" 
                        value={primaryRole}
                        onChange={(e) => setPrimaryRole(e.target.value)}
                      >
                        <option disabled value="">Select Primary Role</option>
                        {roleOptions.map(role => (
                          <option key={`primary-${role}`} value={role}>{role}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-control w-full">
                      <label className="label">
                        <span className="label-text text-base-content/80">Secondary Role</span>
                      </label>
                      <select 
                        className="select select-secondary w-full bg-base-100/50" 
                        value={secondaryRole}
                        onChange={(e) => setSecondaryRole(e.target.value)}
                      >
                        <option disabled value="">Select Secondary Role</option>
                        {roleOptions.map(role => (
                          <option key={`secondary-${role}`} value={role}>{role}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Save Button */}
          <motion.div 
            className="flex justify-center mt-12"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.8 }}
          >
            <motion.button
              onClick={handleSaveProfile}
              className="btn btn-primary btn-lg px-12 text-xl font-bold shadow-2xl"
              whileHover={{ 
                scale: 1.1, 
                boxShadow: '0 0 40px rgba(255, 107, 53, 0.6)',
                textShadow: '0 0 10px rgba(255, 255, 255, 0.8)'
              }}
              whileTap={{ scale: 0.95 }}
              animate={{
                backgroundImage: [
                  'linear-gradient(45deg, #FF6B35, #FF8C42)',
                  'linear-gradient(45deg, #FF8C42, #E55A2B)',
                  'linear-gradient(45deg, #E55A2B, #FF6B35)'
                ]
              }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <span className="mr-3">🔥</span>
              FORGE CHANGES
              <span className="ml-3">⚒️</span>
            </motion.button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}