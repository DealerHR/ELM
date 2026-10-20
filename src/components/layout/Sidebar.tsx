import {
  LayoutDashboard, Users, UserCheck, GraduationCap as LearnerIcon,
  Target, FolderOpen, Settings, Building, Briefcase, Network, Award,
  BookOpen, TrendingUp, Shield, ChevronDown, ChevronRight, FileText,
  BookMarked, Megaphone, Link2, LogOut,
  LayoutGrid, ArrowLeftRight, X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useState, useEffect } from 'react';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  learnerMode: boolean;
  onToggleLearnerMode: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

interface MenuSection {
  id: string;
  label: string;
  items: MenuItem[];
}

interface MenuItem {
  id: string;
  label: string;
  icon: any;
  roles: string[];
}

const managerMenuSections: MenuSection[] = [
  {
    id: 'platform',
    label: 'Platform Admin',
    items: [
      { id: 'organizations', label: 'Organizations', icon: Building, roles: ['platform_admin'] },
      { id: 'super-admin', label: 'Super Admin', icon: Shield, roles: ['platform_admin'] },
    ]
  },
  {
    id: 'master',
    label: 'Master Data',
    items: [
      { id: 'departments', label: 'Departments', icon: Network, roles: ['admin', 'hr'] },
      { id: 'designations', label: 'Designations', icon: Briefcase, roles: ['admin', 'hr'] },
      { id: 'employees', label: 'Employees', icon: Users, roles: ['admin', 'hr', 'manager'] },
    ]
  },
  {
    id: 'recruitment',
    label: 'Recruitment',
    items: [
      { id: 'candidates', label: 'Candidates', icon: UserCheck, roles: ['admin', 'hr'] },
      { id: 'assessments', label: 'Assessment Builder', icon: Award, roles: ['admin', 'hr'] },
      { id: 'growth-profile-guide', label: 'Growth Profile Guide', icon: FileText, roles: ['admin', 'hr'] },
    ]
  },
  {
    id: 'learning',
    label: 'Learning & Development',
    items: [
      { id: 'skill-builder', label: 'Skill Builder', icon: Award, roles: ['admin', 'l_d_manager'] },
      { id: 'course-builder', label: 'Course Builder', icon: BookOpen, roles: ['admin', 'l_d_manager'] },
      { id: 'learning-path-builder', label: 'Learning Path Builder', icon: Network, roles: ['admin', 'l_d_manager'] },
      { id: 'assign-learning', label: 'Assign Learning', icon: BookMarked, roles: ['admin', 'l_d_manager'] },
      { id: 'course-access-requests', label: 'Access Requests', icon: FileText, roles: ['admin', 'l_d_manager'] },
      { id: 'courses', label: 'Course Catalog', icon: BookOpen, roles: ['admin', 'l_d_manager'] },
      { id: 'skill-mapping', label: 'Skill Mapping', icon: Target, roles: ['admin', 'l_d_manager'] },
    ]
  },
  {
    id: 'team',
    label: 'Team Management',
    items: [
      { id: 'okrs', label: 'Team OKRs', icon: Target, roles: ['manager'] },
      { id: 'reviews', label: 'Performance Reviews', icon: TrendingUp, roles: ['manager'] },
    ]
  },
  {
    id: 'performance',
    label: 'Performance',
    items: [
      { id: 'reviews', label: 'Reviews', icon: TrendingUp, roles: ['admin', 'hr'] },
    ]
  },
  {
    id: 'communications',
    label: 'Communications',
    items: [
      { id: 'messages', label: 'Announcements', icon: Megaphone, roles: ['admin', 'l_d_manager', 'hr'] },
      { id: 'pinned-resources', label: 'Quick Links', icon: Link2, roles: ['admin', 'l_d_manager'] },
    ]
  },
  {
    id: 'resources',
    label: 'Resources',
    items: [
      { id: 'repository', label: 'Repository', icon: FolderOpen, roles: ['admin', 'l_d_manager', 'hr'] },
    ]
  },
  {
    id: 'admin',
    label: 'Administration',
    items: [
      { id: 'user-management', label: 'User Management', icon: Shield, roles: ['admin'] },
      { id: 'settings', label: 'Settings', icon: Settings, roles: ['admin', 'hr'] },
    ]
  }
];

const learnerMenuSections: MenuSection[] = [
  {
    id: 'mylearning',
    label: 'Learning',
    items: [
      { id: 'my-learning', label: 'My Learning', icon: BookOpen, roles: ['admin', 'hr', 'l_d_manager', 'manager', 'employee'] },
      { id: 'courses', label: 'Course Catalog', icon: BookMarked, roles: ['admin', 'hr', 'l_d_manager', 'manager', 'employee'] },
      { id: 'skill-mapping', label: 'Skill Mapping', icon: Target, roles: ['admin', 'hr', 'l_d_manager', 'manager', 'employee'] },
    ]
  },
  {
    id: 'myperf',
    label: 'Performance',
    items: [
      { id: 'okrs', label: 'OKRs', icon: Target, roles: ['admin', 'hr', 'l_d_manager', 'manager', 'employee'] },
      { id: 'reviews', label: 'Reviews', icon: TrendingUp, roles: ['admin', 'hr', 'l_d_manager', 'manager', 'employee'] },
    ]
  },
  {
    id: 'myresources',
    label: 'Resources',
    items: [
      { id: 'repository', label: 'Repository', icon: FolderOpen, roles: ['admin', 'hr', 'l_d_manager', 'manager', 'employee'] },
      { id: 'messages', label: 'Announcements', icon: Megaphone, roles: ['admin', 'hr', 'l_d_manager', 'manager', 'employee'] },
    ]
  },
];

const employeeMenuSections: MenuSection[] = [
  {
    id: 'learner',
    label: 'My Learning',
    items: [
      { id: 'my-learning', label: 'My Learning', icon: BookOpen, roles: ['employee'] },
      { id: 'courses', label: 'Course Catalog', icon: BookMarked, roles: ['employee'] },
      { id: 'skill-mapping', label: 'Skill Mapping', icon: Target, roles: ['employee'] },
    ]
  },
  {
    id: 'performance',
    label: 'Performance',
    items: [
      { id: 'okrs', label: 'OKRs', icon: Target, roles: ['employee'] },
      { id: 'reviews', label: 'Reviews', icon: TrendingUp, roles: ['employee'] },
    ]
  },
  {
    id: 'resources',
    label: 'Resources',
    items: [
      { id: 'repository', label: 'Repository', icon: FolderOpen, roles: ['employee'] },
      { id: 'messages', label: 'Announcements', icon: Megaphone, roles: ['employee'] },
    ]
  }
];

export default function Sidebar({ activeView, onViewChange, learnerMode, onToggleLearnerMode, isMobileOpen, onMobileClose }: SidebarProps) {
  const { userProfile, signOut } = useAuth();
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  const role = userProfile?.role || 'employee';
  const isEmployee = role === 'employee';
  const canToggleLearner = !isEmployee;

  const activeSections = isEmployee
    ? employeeMenuSections
    : learnerMode
      ? learnerMenuSections
      : managerMenuSections;

  const visibleSections = activeSections
    .map(section => ({
      ...section,
      items: section.items.filter(item => item.roles.includes(role))
    }))
    .filter(section => section.items.length > 0);

  useEffect(() => {
    const activeSection = visibleSections.find(section =>
      section.items.some(item => item.id === activeView)
    );
    if (activeSection && !expandedSections.includes(activeSection.id)) {
      setExpandedSections(prev => [...prev, activeSection.id]);
    }
  }, [activeView]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const handleNav = (id: string) => {
    onViewChange(id);
    onMobileClose?.();
  };

  const initials = userProfile?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  const NavItem = ({ id, label, icon: Icon, indent = false }: { id: string; label: string; icon: any; indent?: boolean }) => (
    <button
      onClick={() => handleNav(id)}
      className={`w-full flex items-center gap-2.5 py-2 transition-all text-sm ${indent ? 'pl-7 pr-3' : 'px-3'} ${
        activeView === id
          ? 'bg-stratefix-yellow text-stratefix-black font-bold border-l-[3px] border-stratefix-yellow'
          : 'text-gray-300 hover:bg-gray-800/80 hover:text-white border-l-[3px] border-transparent'
      }`}
    >
      <Icon className={`flex-shrink-0 ${indent ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
      <span className={`font-medium truncate ${indent ? 'text-xs' : 'text-sm'}`}>{label}</span>
    </button>
  );

  const SidebarContent = () => (
    <div className="w-full bg-stratefix-black text-white h-full flex flex-col">
      <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-black tracking-tight text-white">ELM Platform</h1>
          <p className="text-stratefix-yellow text-xs mt-0.5 font-semibold">Stratefix</p>
        </div>
        {onMobileClose && (
          <button onClick={onMobileClose} className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white transition">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {canToggleLearner && (
        <div className="px-3 pt-3 pb-2 border-b border-white/5">
          {learnerMode ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 px-2.5 py-2 bg-stratefix-yellow/15 border border-stratefix-yellow/40 rounded-xl">
                <LearnerIcon className="w-3.5 h-3.5 text-stratefix-yellow flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-stratefix-yellow leading-tight">Learner View</p>
                  <p className="text-[10px] text-stratefix-yellow/60 leading-tight">Admin features hidden</p>
                </div>
              </div>
              <button
                onClick={onToggleLearnerMode}
                className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 border border-gray-600 rounded-lg text-xs font-medium text-gray-300 hover:border-gray-400 hover:text-white transition"
              >
                <ArrowLeftRight className="w-3 h-3" />
                Back to Admin View
              </button>
            </div>
          ) : (
            <button
              onClick={onToggleLearnerMode}
              className="w-full flex items-center gap-2 px-2.5 py-2 border border-gray-600 rounded-xl text-xs font-semibold text-gray-300 hover:border-stratefix-yellow/40 hover:text-stratefix-yellow hover:bg-stratefix-yellow/5 transition"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Switch to Learner View
            </button>
          )}
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-2 space-y-0.5">
        <NavItem id="dashboard" label="Dashboard" icon={LayoutDashboard} />

        {visibleSections.length > 0 && (
          <div className="pt-2">
            {visibleSections.map((section) => {
              const isExpanded = expandedSections.includes(section.id);
              return (
                <div key={section.id} className="mb-0.5">
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-200 transition"
                  >
                    <span>{section.label}</span>
                    {isExpanded
                      ? <ChevronDown className="w-3 h-3" />
                      : <ChevronRight className="w-3 h-3" />
                    }
                  </button>

                  {isExpanded && (
                    <div>
                      {section.items.map((item) => (
                        <NavItem key={item.id} id={item.id} label={item.label} icon={item.icon} indent />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </nav>

      <div className="border-t border-white/10 p-3 space-y-2">
        <div className="flex items-center gap-2.5 px-1">
          {userProfile?.avatar_url ? (
            <img
              src={userProfile.avatar_url}
              alt={userProfile.full_name}
              className="w-8 h-8 rounded-full object-cover ring-1 ring-gray-700 flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 bg-stratefix-yellow rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-black text-stratefix-black">{initials}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{userProfile?.full_name}</p>
            <p className="text-[10px] text-gray-400 capitalize truncate">
              {learnerMode && !isEmployee ? 'Learner View' : role.replace(/_/g, ' ')}
            </p>
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-gray-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex w-56 flex-shrink-0 h-screen">
        <SidebarContent />
      </div>

      {/* Mobile drawer */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onMobileClose}
          />
          <div className="relative w-64 h-full shadow-2xl">
            <SidebarContent />
          </div>
        </div>
      )}
    </>
  );
}
