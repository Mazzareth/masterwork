"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth, googleProvider, db } from "../lib/firebase";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";

export type Permissions = {
  zzq: boolean;
  cc: boolean;
  inhouse: boolean;
};

export type UserProfile = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

type UserDoc = {
  profile: UserProfile;
  permissions: Permissions;
  createdAt?: any;
  updatedAt?: any;
};

type AuthContextType = {
  user: User | null;
  profile: UserProfile | null;
  permissions: Permissions | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
};

const defaultPermissions: Permissions = { zzq: true, cc: false, inhouse: false };

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  permissions: null,
  loading: true,
  // no-op defaults
  loginWithGoogle: async () => {},
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Local subscription handle for user doc
    let unsubDoc: (() => void) | null = null;
    // Watch auth state
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      // Tear down any existing user doc subscription when auth state changes
      if (unsubDoc) {
        try { unsubDoc(); } catch (_) {}
        unsubDoc = null;
      }
      setUser(u);
      if (!u) {
        setProfile(null);
        setPermissions(null);
        setLoading(false);
        return;
      }

      const userRef = doc(db, "users", u.uid);
      const snap = await getDoc(userRef);

      const baseProfile: UserProfile = {
        uid: u.uid,
        email: u.email,
        displayName: u.displayName,
        photoURL: u.photoURL,
      };

      // Bootstrap or migrate user document ensuring permissions are present
      if (!snap.exists()) {
        const newDoc: UserDoc = {
          profile: baseProfile,
          permissions: defaultPermissions, // Default access: ZZQ only
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(userRef, newDoc);
      } else {
        // Merge profile refresh and, if missing, permissions in a single write
        const data = snap.data() as Partial<UserDoc>;
        const updatePayload: Partial<UserDoc> & { updatedAt: any } = {
          profile: baseProfile,
          updatedAt: serverTimestamp(),
        };
        if (!data.permissions) {
          updatePayload.permissions = defaultPermissions;
        }
        await setDoc(userRef, updatePayload, { merge: true });
      }

      // Live subscribe to user document for permission changes
      if (unsubDoc) {
        try { unsubDoc(); } catch (_) {}
      }
      unsubDoc = onSnapshot(
        userRef,
        (docSnap) => {
          const data = docSnap.data() as UserDoc | undefined;
          setProfile(data?.profile ?? baseProfile);
          setPermissions(data?.permissions ?? defaultPermissions);
          setLoading(false);
        },
        (err) => {
          console.error("User document subscription error:", err);
          setLoading(false);
        }
      );

      // subscription created; cleanup happens on auth change and effect teardown.
    });

    return () => {
      unsubAuth();
      if (unsubDoc) {
        try { unsubDoc(); } catch (_) {}
      }
    };
  }, []);

  const loginWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      profile,
      permissions,
      loading,
      loginWithGoogle,
      logout,
    }),
    [user, profile, permissions, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);