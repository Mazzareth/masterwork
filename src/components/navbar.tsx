'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';

interface Team {
  id: string;
  name: string;
}

const mockTeams: Team[] = [
  { id: '1', name: 'Fire Dragons' },
  { id: '2', name: 'Steel Wolves' }
];

export default function Navbar() {
  const [showTeamsDropdown, setShowTeamsDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [userTeams] = useState<Team[]>(mockTeams); // Mock user teams
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();

  // Reset dropdown state when navigating to a new page
  useEffect(() => {
    setShowTeamsDropdown(false);
    setShowUserDropdown(false);
  }, [pathname]);

  const handleSignOut = async () => {
    try {
      await logout();
      setShowUserDropdown(false);
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  return (
    <div className="navbar bg-base-100/80 backdrop-blur-sm border-b border-base-300/50 shadow-lg sticky top-0 z-50">
      <div className="navbar-start">
        <div className="dropdown">
          <div tabIndex={0} role="button" className="btn btn-ghost lg:hidden">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h8m-8 6h16" />
            </svg>
          </div>
          <ul
            tabIndex={0}
            className="menu menu-sm dropdown-content bg-base-200 rounded-box z-[1] mt-3 w-52 p-2 shadow">
            <li><Link href="/hub">Hub</Link></li>
            <li><Link href="/queue">Queue</Link></li>
            <li>
              <a>My Teams</a>
              <ul className="p-2">
                {userTeams.length > 0 ? (
                  userTeams.map((team) => (
                    <li key={team.id}>
                      <Link href={`/teams/${team.id}`}>{team.name}</Link>
                    </li>
                  ))
                ) : (
                  <li>
                    <a>No teams yet</a>
                  </li>
                )}
              </ul>
            </li>
            <li><Link href="/leaderboard">Leaderboard</Link></li>
          </ul>
        </div>
        <Link href="/" className="btn btn-ghost text-2xl font-bold text-primary">
          Masterwork
        </Link>
      </div>
      <div className="navbar-center hidden lg:flex">
        <ul className="menu menu-horizontal px-1">
          <li><Link href="/hub">Hub</Link></li>
          <li><Link href="/queue">Queue</Link></li>
          <li>
            <details>
              <summary>My Teams</summary>
              <ul className="p-2 bg-base-200 rounded-t-none">
                {userTeams.length > 0 ? (
                  userTeams.map((team) => (
                    <li key={team.id}>
                      <Link href={`/teams/${team.id}`}>{team.name}</Link>
                    </li>
                  ))
                ) : (
                  <li>
                    <a>No teams yet</a>
                  </li>
                )}
              </ul>
            </details>
          </li>
          <li><Link href="/leaderboard">Leaderboard</Link></li>
        </ul>
      </div>
      <div className="navbar-end">
        {loading ? (
          <span className="loading loading-spinner"></span>
        ) : user ? (
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar">
              {user.photoURL ? (
                <div className="w-10 rounded-full">
                  <img
                    alt={user.displayName || 'User'}
                    src={user.photoURL}
                  />
                </div>
              ) : (
                <div className="avatar placeholder">
                  <div className="bg-neutral text-neutral-content w-10 rounded-full">
                    <span className="text-xl">{user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}</span>
                  </div>
                </div>
              )}
            </div>
            <ul
              tabIndex={0}
              className="menu menu-sm dropdown-content bg-base-200 rounded-box z-[1] mt-3 w-52 p-2 shadow">
              <li className="menu-title">
                <p className="text-base-content">{user.displayName || 'User'}</p>
                <p className="text-xs text-base-content/70">{user.email}</p>
              </li>
              <li><Link href="/profile">Profile</Link></li>
              <li><Link href="/settings">Settings</Link></li>
              <li><a onClick={handleSignOut}>Sign Out</a></li>
            </ul>
          </div>
        ) : (
          <Link href="/login" className="btn btn-primary btn-sm">
            Sign In
          </Link>
        )}
      </div>
    </div>
  );
}