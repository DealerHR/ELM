import { useState } from 'react';
import { MoreHorizontal, X, ArrowLeftRight, LogOut, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { DASHBOARD_ITEM, itemsFor, sectionsFor, type NavItem } from '../../lib/navigation';

interface MobileNavProps {
  activeView: string;
  onViewChange: (view: string) => void;
  learnerMode: boolean;
  onToggleLearnerMode: () => void;
}

const MAX_TABS = 4; // plus "More"

/**
 * Phone and tablet navigation: a bottom tab bar with the role's most-used
 * screens and a "More" sheet for everything else. Hidden on desktop.
 */
export default function MobileNav({ activeView, onViewChange, learnerMode, onToggleLearnerMode }: MobileNavProps) {
  const { userProfile, signOut } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const role = userProfile?.role || 'employee';
  const isEmployee = role === 'employee';

  const all = itemsFor(role, learnerMode);
  const primary = [DASHBOARD_ITEM, ...all.filter(i => i.id !== 'dashboard' && i.mobilePrimary)].slice(0, MAX_TABS);
  const primaryIds = new Set(primary.map(i => i.id));
  const sections = sectionsFor(role, learnerMode);
  const activeInMore = !primaryIds.has(activeView);

  const go = (id: string) => { onViewChange(id); setMoreOpen(false); };

  const Tab = ({ item }: { item: NavItem }) => {
    const active = activeView === item.id;
    const Icon = item.icon;
    return (
      <button
        onClick={() => go(item.id)}
        aria-current={active ? 'page' : undefined}
        className={`flex-1 min-w-0 h-14 flex flex-col items-center justify-center gap-0.5 ${active ? 'text-stratefix-black' : 'text-gray-500'}`}
      >
        <span className={`w-10 h-6 rounded-full flex items-center justify-center ${active ? 'bg-stratefix-yellow' : ''}`}>
          <Icon className="w-5 h-5" strokeWidth={active ? 2.2 : 1.8} />
        </span>
        <span className={`text-[11px] leading-tight truncate max-w-full ${active ? 'font-semibold' : 'font-medium'}`}>{item.shortLabel || item.label}</span>
      </button>
    );
  };

  return (
    <>
      <nav
        aria-label="Main navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 flex items-stretch px-1 pb-[env(safe-area-inset-bottom)]"
      >
        {primary.map(item => <Tab key={item.id} item={item} />)}
        <button
          onClick={() => setMoreOpen(true)}
          aria-expanded={moreOpen}
          className={`flex-1 min-w-0 h-14 flex flex-col items-center justify-center gap-0.5 ${activeInMore ? 'text-stratefix-black' : 'text-gray-500'}`}
        >
          <span className={`w-10 h-6 rounded-full flex items-center justify-center ${activeInMore ? 'bg-stratefix-yellow' : ''}`}>
            <MoreHorizontal className="w-5 h-5" strokeWidth={activeInMore ? 2.2 : 1.8} />
          </span>
          <span className={`text-[11px] leading-tight ${activeInMore ? 'font-semibold' : 'font-medium'}`}>More</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <button aria-label="Close menu" className="absolute inset-0 bg-black/50" onClick={() => setMoreOpen(false)} />
          <div className="relative bg-white rounded-t-2xl max-h-[85vh] flex flex-col pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between px-4 h-12 border-b border-gray-100 flex-shrink-0">
              <span className="text-sm font-semibold text-gray-900">Menu</span>
              <button onClick={() => setMoreOpen(false)} aria-label="Close" className="w-10 h-10 -mr-2 flex items-center justify-center text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-2 py-2">
              {sections.map(section => {
                const rest = section.items.filter(i => !primaryIds.has(i.id));
                if (rest.length === 0) return null;
                return (
                  <div key={section.id} className="mb-2">
                    <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">{section.label}</p>
                    {rest.map(item => {
                      const Icon = item.icon;
                      const active = activeView === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => go(item.id)}
                          className={`w-full h-12 flex items-center gap-3 px-3 rounded-xl text-left ${active ? 'bg-yellow-50 text-stratefix-black font-semibold' : 'text-gray-700 active:bg-gray-100'}`}
                        >
                          <Icon className="w-5 h-5 text-gray-500" strokeWidth={1.8} />
                          <span className="text-sm">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}

              <div className="border-t border-gray-100 mt-1 pt-2">
                <button onClick={() => go('user-profile')} className="w-full h-12 flex items-center gap-3 px-3 rounded-xl text-left text-gray-700 active:bg-gray-100">
                  <User className="w-5 h-5 text-gray-500" strokeWidth={1.8} />
                  <span className="text-sm">My profile</span>
                  <span className="ml-auto text-xs text-gray-400 truncate max-w-[40%]">{userProfile?.full_name}</span>
                </button>
                {!isEmployee && (
                  <button onClick={() => { onToggleLearnerMode(); setMoreOpen(false); }} className="w-full h-12 flex items-center gap-3 px-3 rounded-xl text-left text-gray-700 active:bg-gray-100">
                    <ArrowLeftRight className="w-5 h-5 text-gray-500" strokeWidth={1.8} />
                    <span className="text-sm">{learnerMode ? 'Back to admin view' : 'Switch to learner view'}</span>
                  </button>
                )}
                <button onClick={() => signOut()} className="w-full h-12 flex items-center gap-3 px-3 rounded-xl text-left text-red-600 active:bg-red-50">
                  <LogOut className="w-5 h-5" strokeWidth={1.8} />
                  <span className="text-sm">Sign out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
