'use client';

import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { getUserProfile, createUserProfile, updateUserProfile } from '@/lib/firestoreUtils';

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
      const updatedData: Partial<UserProfile> = {
        leagueIGN,
        hashtag,
        primaryRole,
        secondaryRole,
      };
      try {
        await updateUserProfile(user.uid, updatedData);
        setProfile({ ...profile, ...updatedData });
        setToast({ show: true, message: 'Profile updated successfully!', type: 'success' });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
      } catch (error) {
        console.error('Error updating profile:', error);
        setToast({ show: true, message: 'Error updating profile.', type: 'error' });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
      }
    }
  };

  if (loading) {
    return <div className="max-w-7xl mx-auto px-4 py-8 text-molten">Loading profile...</div>;
  }

  if (!user) {
    return <div className="max-w-7xl mx-auto px-4 py-8 text-molten">Please log in to view your profile.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      {toast.show && (
        <div className="toast toast-top toast-center z-50">
          <div className={`alert alert-${toast.type}`}>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
      <div className="card bg-base-200 shadow-xl">
        <div className="card-body">
          <h1 className="card-title text-3xl">User Profile</h1>
          <div className="divider"></div>

          <div role="tablist" className="tabs tabs-lifted">
            <a role="tab" className={`tab ${activeTab === 'profile' ? 'tab-active' : ''}`} onClick={() => setActiveTab('profile')}>Profile</a>
            <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-box p-6">
              <div className="flex items-center space-x-4">
                {profile?.photoURL && (
                    <div className="avatar">
                        <div className="w-24 rounded-full">
                            <img src={profile.photoURL} alt="Profile" />
                        </div>
                    </div>
                )}
                <div>
                    <div className="mb-2">
                        <span className="font-bold text-secondary">Display Name:</span>
                        <p className="text-lg">{profile?.displayName || 'N/A'}</p>
                    </div>
                    <div>
                        <span className="font-bold text-secondary">Email:</span>
                        <p className="text-lg">{profile?.email || 'N/A'}</p>
                    </div>
                </div>
              </div>
            </div>

            <a role="tab" className={`tab ${activeTab === 'integrations' ? 'tab-active' : ''}`} onClick={() => setActiveTab('integrations')}>Integrations</a>
            <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-box p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                      <h3 className="text-xl font-semibold mb-2">League of Legends</h3>
                      <div className="flex space-x-4">
                          <div className="form-control w-full">
                              <label className="label">
                                  <span className="label-text">IGN:</span>
                              </label>
                              <input
                                  type="text"
                                  id="leagueIGN"
                                  placeholder="Crows B4 Hoes"
                                  className="input input-bordered w-full"
                                  value={leagueIGN}
                                  onChange={(e) => setLeagueIGN(e.target.value)}
                              />
                          </div>
                          <div className="form-control w-full">
                              <label className="label">
                                  <span className="label-text">Hashtag:</span>
                              </label>
                              <input
                                  type="text"
                                  id="hashtag"
                                  placeholder="#NA1"
                                  className="input input-bordered w-full"
                                  value={hashtag}
                                  onChange={(e) => setHashtag(e.target.value)}
                              />
                          </div>
                      </div>
                  </div>
                  <div>
                      <h3 className="text-xl font-semibold mb-2">Discord</h3>
                      {profile?.discordProfile ? (
                        <div className="flex items-center space-x-4 p-2 bg-base-300 rounded-lg">
                          <div className="avatar">
                            <div className="w-12 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                              <img src={`https://cdn.discordapp.com/avatars/${profile.discordProfile.id}/${profile.discordProfile.avatar}.png`} alt="Discord Avatar" />
                            </div>
                          </div>
                          <div>
                            <p className="font-bold text-lg">{profile.discordProfile.username}</p>
                          </div>
                          <button className="btn btn-error btn-sm ml-auto">Unlink</button>
                        </div>
                      ) : (
                        <a href="/api/auth/discord" className="btn btn-primary">
                          Link to Discord
                        </a>
                      )}
                  </div>
              </div>
            </div>

            <a role="tab" className={`tab ${activeTab === 'preferences' ? 'tab-active' : ''}`} onClick={() => setActiveTab('preferences')}>Preferences</a>
            <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-box p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Role Preferences</h3>
                  <div className="form-control w-full mb-4">
                      <label className="label">
                          <span className="label-text">Primary Role:</span>
                      </label>
                      <select className="select select-bordered w-full" value={primaryRole} onChange={(e) => setPrimaryRole(e.target.value)}>
                          <option disabled value="">Select a role</option>
                          {roleOptions.map(role => <option key={role} value={role}>{role}</option>)}
                      </select>
                  </div>
                  <div className="form-control w-full">
                      <label className="label">
                          <span className="label-text">Secondary Role:</span>
                      </label>
                      <select className="select select-bordered w-full" value={secondaryRole} onChange={(e) => setSecondaryRole(e.target.value)}>
                          <option disabled value="">Select a role</option>
                          {roleOptions.filter(r => r !== primaryRole).map(role => <option key={role} value={role}>{role}</option>)}
                      </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card-actions justify-end mt-4">
            <button
                onClick={handleSaveProfile}
                className="btn btn-primary"
                disabled={!primaryRole || !secondaryRole || !leagueIGN || !hashtag}
            >
                Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}