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
  primaryRole?: string;
  secondaryRole?: string;
}

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const docRef = doc(db, 'users', uid);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return docSnap.data() as UserProfile;
  } else {
    return null;
  }
};

export const createUserProfile = async (userProfile: UserProfile): Promise<void> => {
  const docRef = doc(db, 'users', userProfile.uid);
  await setDoc(docRef, userProfile, { merge: true });
};

export const updateUserProfile = async (uid: string, data: Partial<UserProfile>): Promise<void> => {
  const docRef = doc(db, 'users', uid);
  await setDoc(docRef, data, { merge: true });
};