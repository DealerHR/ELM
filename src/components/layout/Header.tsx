import { useAuth } from '../../contexts/AuthContext';
import NotificationBell from './NotificationBell';
import { pageTitle } from '../../lib/navigation';

interface HeaderProps {
  activeView: string;
  onNavigate?: (view: string) => void;
}

/** A 48 px bar: the current page's name on the left, notifications and profile on the right. */
export default function Header({ activeView, onNavigate }: HeaderProps) {
  const { userProfile, organization } = useAuth();
  const title = pageTitle(activeView);

  const initials = userProfile?.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

  return (
    <header className="h-12 flex-shrink-0 bg-white border-b border-gray-200 px-4 lg:px-5 flex items-center gap-3">
      <div className="min-w-0 flex items-baseline gap-2">
        {organization?.logo_url
          ? <img src={organization.logo_url} alt="" className="lg:hidden w-6 h-6 rounded object-contain flex-shrink-0" />
          : <span className="lg:hidden text-xs font-bold text-gray-900 truncate max-w-[90px]">{organization?.name || 'ELM'}</span>}
        <h2 className="text-base font-semibold text-gray-900 truncate">{title}</h2>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-1 flex-shrink-0">
        <NotificationBell />
        <button
          onClick={() => onNavigate?.('user-profile')}
          className="hidden lg:flex items-center gap-2 pl-1.5 pr-2.5 h-8 rounded-lg hover:bg-gray-100 transition-colors"
          title="My profile"
        >
          {userProfile?.avatar_url ? (
            <img src={userProfile.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
          ) : (
            <span className="w-6 h-6 rounded-full bg-stratefix-black text-stratefix-yellow flex items-center justify-center text-[11px] font-bold">{initials}</span>
          )}
          <span className="text-xs font-medium text-gray-700 max-w-[140px] truncate">{userProfile?.full_name}</span>
        </button>
      </div>
    </header>
  );
}
