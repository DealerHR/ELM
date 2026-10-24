import {
  LayoutDashboard, Users, UserCheck, Target, FolderOpen, Settings, Building, Briefcase,
  Network, Award, BookOpen, Shield, FileText, BookMarked, Megaphone, Link2, ClipboardList,
} from 'lucide-react';
import type { ElementType } from 'react';
import type { UserRole } from './supabase';

/**
 * One description of the app's navigation, used by the desktop rail, the
 * mobile tab bar and the header title. Add a screen here and it appears
 * everywhere it should.
 */

export interface NavItem {
  id: string;
  label: string;
  /** Short label for the mobile tab bar. Defaults to label. */
  shortLabel?: string;
  icon: ElementType;
  roles: UserRole[];
  /** Shown as one of the first tabs on a phone. */
  mobilePrimary?: boolean;
}

export interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

const ALL_ROLES: UserRole[] = ['platform_admin', 'admin', 'hr', 'l_d_manager', 'manager', 'employee'];

export const DASHBOARD_ITEM: NavItem = {
  id: 'dashboard', label: 'Dashboard', shortLabel: 'Home', icon: LayoutDashboard, roles: ALL_ROLES, mobilePrimary: true,
};

/**
 * Menus for staff roles when not in learner view, grouped by the stage of the
 * employee lifecycle the operator is working in.
 */
export const STAFF_SECTIONS: NavSection[] = [
  {
    id: 'hire',
    label: 'Hire',
    items: [
      { id: 'candidates', label: 'Candidates', icon: UserCheck, roles: ['admin', 'hr'], mobilePrimary: true },
      { id: 'assessments', label: 'Assessments', icon: Award, roles: ['admin', 'hr'] },
      { id: 'growth-profile-guide', label: 'Growth Profile Guide', shortLabel: 'Guide', icon: FileText, roles: ['admin', 'hr'] },
    ],
  },
  {
    id: 'onboard',
    label: 'Onboard',
    items: [
      { id: 'inductions', label: 'Inductions', icon: ClipboardList, roles: ['admin', 'hr', 'l_d_manager'] },
    ],
  },
  {
    id: 'learn',
    label: 'Learn',
    items: [
      { id: 'course-builder', label: 'Courses', icon: BookOpen, roles: ['admin', 'l_d_manager'], mobilePrimary: true },
      { id: 'learning-path-builder', label: 'Learning Paths', shortLabel: 'Paths', icon: Network, roles: ['admin', 'l_d_manager'] },
      { id: 'skill-builder', label: 'Skills', icon: Award, roles: ['admin', 'l_d_manager'] },
      { id: 'assign-learning', label: 'Assign Learning', shortLabel: 'Assign', icon: BookMarked, roles: ['admin', 'l_d_manager'], mobilePrimary: true },
      { id: 'course-access-requests', label: 'Access Requests', shortLabel: 'Requests', icon: FileText, roles: ['admin', 'l_d_manager'] },
      { id: 'courses', label: 'Course Catalog', shortLabel: 'Catalog', icon: BookMarked, roles: ['admin', 'l_d_manager'] },
      { id: 'skill-mapping', label: 'Skill Mapping', shortLabel: 'Mapping', icon: Target, roles: ['admin', 'l_d_manager'] },
    ],
  },
  {
    id: 'perform',
    label: 'Perform',
    items: [
      { id: 'okrs', label: 'Team OKRs', shortLabel: 'OKRs', icon: Target, roles: ['manager', 'admin', 'hr'], mobilePrimary: true },
    ],
  },
  {
    id: 'people',
    label: 'People',
    items: [
      { id: 'employees', label: 'People', icon: Users, roles: ['admin', 'hr', 'manager'], mobilePrimary: true },
      { id: 'departments', label: 'Departments', icon: Network, roles: ['admin', 'hr'] },
      { id: 'designations', label: 'Designations', icon: Briefcase, roles: ['admin', 'hr'] },
    ],
  },
  {
    id: 'setup',
    label: 'Setup',
    items: [
      { id: 'messages', label: 'Announcements', icon: Megaphone, roles: ['admin', 'l_d_manager', 'hr'] },
      { id: 'pinned-resources', label: 'Quick Links', icon: Link2, roles: ['admin', 'l_d_manager'] },
      { id: 'repository', label: 'Repository', icon: FolderOpen, roles: ['admin', 'l_d_manager', 'hr'] },
      { id: 'settings', label: 'Settings', icon: Settings, roles: ['admin', 'hr'] },
    ],
  },
  {
    id: 'platform',
    label: 'Platform',
    items: [
      { id: 'organizations', label: 'Organizations', icon: Building, roles: ['platform_admin'], mobilePrimary: true },
      { id: 'super-admin', label: 'Super Admin', icon: Shield, roles: ['platform_admin'], mobilePrimary: true },
    ],
  },
];

/** Menus for employees, and for staff in learner view. */
export const LEARNER_SECTIONS: NavSection[] = [
  {
    id: 'learning',
    label: 'Learning',
    items: [
      { id: 'my-learning', label: 'My Learning', shortLabel: 'Learning', icon: BookOpen, roles: ALL_ROLES, mobilePrimary: true },
      { id: 'courses', label: 'Course Catalog', shortLabel: 'Catalog', icon: BookMarked, roles: ALL_ROLES, mobilePrimary: true },
      { id: 'skill-mapping', label: 'Skill Mapping', shortLabel: 'Skills', icon: Target, roles: ALL_ROLES, mobilePrimary: true },
    ],
  },
  {
    id: 'performance',
    label: 'Performance',
    items: [
      { id: 'okrs', label: 'OKRs', icon: Target, roles: ALL_ROLES },
    ],
  },
  {
    id: 'resources',
    label: 'Resources',
    items: [
      { id: 'repository', label: 'Repository', icon: FolderOpen, roles: ALL_ROLES },
      { id: 'messages', label: 'Announcements', icon: Megaphone, roles: ALL_ROLES },
    ],
  },
];

export function sectionsFor(role: UserRole, learnerMode: boolean): NavSection[] {
  const source = role === 'employee' || learnerMode ? LEARNER_SECTIONS : STAFF_SECTIONS;
  return source
    .map(s => ({ ...s, items: s.items.filter(i => i.roles.includes(role)) }))
    .filter(s => s.items.length > 0);
}

/** Flat list of everything the role can reach, dashboard first. */
export function itemsFor(role: UserRole, learnerMode: boolean): NavItem[] {
  return [DASHBOARD_ITEM, ...sectionsFor(role, learnerMode).flatMap(s => s.items)];
}

const EXTRA_TITLES: Record<string, string> = {
  'user-profile': 'My Profile',
  'dashboard': 'Dashboard',
  'user-management': 'People',
  'reviews': 'Reviews',
};

export function pageTitle(viewId: string): string {
  const all = [DASHBOARD_ITEM, ...STAFF_SECTIONS.flatMap(s => s.items), ...LEARNER_SECTIONS.flatMap(s => s.items)];
  return all.find(i => i.id === viewId)?.label || EXTRA_TITLES[viewId] || '';
}
