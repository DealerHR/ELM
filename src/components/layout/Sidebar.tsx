import { ArrowLeftRight, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { DASHBOARD_ITEM, sectionsFor, type NavItem } from '../../lib/navigation';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  learnerMode: boolean;
  onToggleLearnerMode: () => void;
}

/**
 * Desktop navigation: a 56 px icon rail that widens to show labels while the
 * pointer is over it. Hidden on phones and tablets, where MobileNav takes over.
 */
export default function Sidebar({ activeView, onViewChange, learnerMode, onToggleLearnerMode }: SidebarProps) {
  const { userProfile, signOut } = useAuth();
  const role = userProfile?.role || 'employee';
  const isEmployee = role === 'employee';
  const sections = sectionsFor(role, learnerMode);

  const initials = userProfile?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  const Item = ({ item }: { item: NavItem }) => {
    const active = activeView === item.id;
    const Icon = item.icon;
    return (
      <button
        onClick={() => onViewChange(item.id)}
        title={item.label}
        aria-current={active ? 'page' : undefined}
        className={`w-full h-10 flex items-center gap-3 rounded-lg px-2 transition-colors ${
          active ? 'bg-stratefix-yellow text-stratefix-black' : 'text-gray-400 hover:bg-white/10 hover:text-white'
        }`}
      >
        <Icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.8} />
        <span className="text-sm font-medium whitespace-nowrap overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          {item.label}
        </span>
      </button>
    );
  };

  return (
    <aside
      className="group hidden lg:flex flex-col flex-shrink-0 h-screen bg-stratefix-black text-white w-14 hover:w-64 transition-[width] duration-200 ease-out overflow-hidden z-40"
      aria-label="Main navigation"
    >
      {/* Brand */}
      <div className="h-12 flex items-center gap-3 px-3 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-stratefix-yellow text-stratefix-black flex items-center justify-center text-xs font-bold flex-shrink-0">S</div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap overflow-hidden">
          <p className="text-sm font-semibold leading-tight">ELM Platform</p>
          <p className="text-xs text-stratefix-yellow leading-tight">Stratefix</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 space-y-0.5 [scrollbar-width:none]">
        <Item item={DASHBOARD_ITEM} />
        {sections.map(section => (
          <div key={section.id} className="pt-2">
            <div className="h-5 flex items-center px-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                {section.label}
              </span>
              <span className="w-6 h-px bg-white/15 group-hover:hidden" aria-hidden="true" />
            </div>
            <div className="space-y-0.5">
              {section.items.map(item => <Item key={item.id} item={item} />)}
            </div>
          </div>
        ))}
      </nav>

      <div className="flex-shrink-0 px-2 py-2 border-t border-white/10 space-y-0.5">
        {!isEmployee && (
          <button
            onClick={onToggleLearnerMode}
            title={learnerMode ? 'Back to admin view' : 'Switch to learner view'}
            className={`w-full h-10 flex items-center gap-3 rounded-lg px-2 transition-colors ${
              learnerMode ? 'text-stratefix-yellow hover:bg-white/10' : 'text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <ArrowLeftRight className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.8} />
            <span className="text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              {learnerMode ? 'Back to admin view' : 'Learner view'}
            </span>
          </button>
        )}
        <button
          onClick={() => onViewChange('user-profile')}
          title="My profile"
          className="w-full h-10 flex items-center gap-3 rounded-lg px-1.5 text-gray-300 hover:bg-white/10 transition-colors"
        >
          {userProfile?.avatar_url ? (
            <img src={userProfile.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
          ) : (
            <span className="w-7 h-7 rounded-full bg-stratefix-yellow text-stratefix-black text-xs font-bold flex items-center justify-center flex-shrink-0">{initials}</span>
          )}
          <span className="min-w-0 text-left opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <span className="block text-sm font-medium text-white truncate">{userProfile?.full_name}</span>
            <span className="block text-xs text-gray-400 capitalize truncate">{learnerMode && !isEmployee ? 'Learner view' : role.replace(/_/g, ' ')}</span>
          </span>
        </button>
        <button
          onClick={() => signOut()}
          title="Sign out"
          className="w-full h-10 flex items-center gap-3 rounded-lg px-2 text-gray-400 hover:bg-red-950/40 hover:text-red-300 transition-colors"
        >
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.8} />
          <span className="text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150">Sign out</span>
        </button>
      </div>
    </aside>
  );
}
