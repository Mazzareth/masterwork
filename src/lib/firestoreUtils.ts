import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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
  puuid?: string;
  primaryRole?: string;
  secondaryRole?: string;
}

/**
 * @description Retrieves a user profile from Firestore.
 * @param {string} uid - The user's unique ID.
 * @returns {Promise<UserProfile | null>} The user's profile, or null if it doesn't exist.
 */
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const docRef = doc(db, 'users', uid);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return docSnap.data() as UserProfile;
  } else {
    return null;
  }
};

/**
 * @description Creates a new user profile in Firestore.
 * @param {UserProfile} userProfile - The user profile object.
 * @returns {Promise<void>}
 */
export const createUserProfile = async (userProfile: UserProfile): Promise<void> => {
  const docRef = doc(db, 'users', userProfile.uid);
  await setDoc(docRef, userProfile, { merge: true });
};

/**
 * @description Updates a user profile in Firestore.
 * @param {string} uid - The user's unique ID.
 * @param {Partial<UserProfile>} data - The data to update.
 * @returns {Promise<void>}
 */
export const updateUserProfile = async (uid: string, data: Partial<UserProfile>): Promise<void> => {
  const docRef = doc(db, 'users', uid);
  await setDoc(docRef, data, { merge: true });
};