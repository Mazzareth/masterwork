'use client';

import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LoginPage() {
  const { user, signInWithGoogle, loading, signInAsGuest } = useAuth();
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      router.push('/');
    }
  }, [user, loading, router]);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Sign in failed:', error);
    } finally {
      setIsSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="coal-container-main py-8">
        <div className="forge-flex forge-flex-col forge-items-center forge-justify-center min-h-[60vh]">
          <div className="ember-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="coal-container-main py-8">
      <div className="coal-card max-w-md mx-auto">
        <div className="coal-card-header text-center">
          <h1 className="forge-title-large mb-2">Welcome to Masterwork</h1>
          <p className="forge-text-secondary">
            Join the ultimate League of Legends community experience
          </p>
        </div>
        <div className="coal-card-body">
          <div className="space-y-6">
            <button
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              className="forge-btn forge-btn-primary w-full forge-flex forge-items-center forge-justify-center space-x-3"
            >
              {isSigningIn ? (
                <>
                  <div className="ember-spinner w-5 h-5"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>
            <button
              onClick={signInAsGuest}
              className="forge-btn forge-btn-secondary w-full"
            >
              Dev Sign in
            </button>
            <p className="forge-text-secondary text-center text-sm">
              The above button works for logging in and signing up!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}