import { LogOut, User, Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import NotificationBell from './NotificationBell';

interface HeaderProps {
  onNavigate?: (view: string) => void;
  onMenuOpen?: () => void;
}

export default function Header({ onNavigate, onMenuOpen }: HeaderProps) {
  const { signOut, userProfile } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const initials = userProfile?.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

  return (
    <header className="bg-white border-b border-gray-100 px-3 sm:px-5 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onMenuOpen}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition flex-shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-gray-900 truncate">
              Welcome back, {userProfile?.full_name?.split(' ')[0]}
            </h2>
            <p className="text-xs text-gray-400 hidden sm:block">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <NotificationBell />

          <button
            onClick={() => onNavigate?.('user-profile')}
            className="flex items-center gap-1.5 px-1.5 sm:px-2 py-1.5 rounded-xl hover:bg-gray-50 transition-colors group"
            title="My Profile"
          >
            {userProfile?.avatar_url ? (
              <img
                src={userProfile.avatar_url}
                alt={userProfile.full_name}
                className="w-7 h-7 rounded-full object-cover ring-2 ring-gray-200"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-stratefix-black text-stratefix-yellow flex items-center justify-center text-xs font-bold ring-2 ring-gray-200">
                {initials}
              </div>
            )}
            <User className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 transition-colors hidden sm:block" />
          </button>

          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
