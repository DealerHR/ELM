import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginForm from './components/auth/LoginForm';
import ChangePasswordForm from './components/auth/ChangePasswordForm';
import { supabase } from './lib/supabase';
import { parseHash, navigate } from './lib/router';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import MobileNav from './components/layout/MobileNav';
import Dashboard from './components/views/Dashboard';
import Organizations from './components/views/Organizations';
import Departments from './components/views/Departments';
import Employees from './components/views/Employees';
import Inductions from './components/views/Inductions';
import Designations from './components/views/Designations';
import Candidates from './components/views/Candidates';
import Skills from './components/views/Skills';
import Courses from './components/views/Courses';
import OKRs from './components/views/OKRs';
import Repository from './components/views/Repository';
import Assessments from './components/views/Assessments';
import CourseBuilder from './components/views/CourseBuilder';
import LearningPathBuilder from './components/views/LearningPathBuilder';
import MyLearning from './components/views/MyLearning';
import AssignLearning from './components/views/AssignLearning';
import Settings from './components/views/Settings';
import GrowthProfileGuide from './components/views/GrowthProfileGuide';
import SkillMapping from './components/views/SkillMapping';
import CandidatePortal from './components/portal/CandidatePortal';
import SuperAdminDashboard from './components/views/SuperAdminDashboard';
import Messages from './components/views/Messages';
import PinnedResources from './components/views/PinnedResources';
import UserProfile from './components/views/UserProfile';

function AppContent() {
  const { user, userProfile } = useAuth();
  // The address bar is the source of truth for which screen is open (#/view/:id).
  const [activeView, setActiveViewState] = useState(() => {
    const r = parseHash();
    return r.view.startsWith('assess') ? 'dashboard' : r.view;
  });
  const setActiveView = (view: string) => navigate(view);
  const [isPortalRoute, setIsPortalRoute] = useState(() => {
    const hash = window.location.hash;
    return hash === '#/assess' || hash.startsWith('#/assess');
  });
  const [learnerMode, setLearnerMode] = useState(false);
  // Set when the user arrives through a "forgot password" email link.
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const checkRoute = () => {
      const hash = window.location.hash;
      setIsPortalRoute(hash === '#/assess' || hash.startsWith('#/assess'));
    };
    const syncView = () => {
      const r = parseHash();
      if (!r.view.startsWith('assess')) setActiveViewState(r.view);
    };
    window.addEventListener('hashchange', checkRoute);
    window.addEventListener('hashchange', syncView);
    return () => { window.removeEventListener('hashchange', checkRoute); window.removeEventListener('hashchange', syncView); };
  }, []);

  if (isPortalRoute) {
    return <CandidatePortal />;
  }

  if (!user || !userProfile) {
    return <LoginForm />;
  }

  if (passwordRecovery) {
    return (
      <ChangePasswordForm
        fullScreen
        title="Reset your password"
        description="Choose a new password for your account."
        onDone={() => setPasswordRecovery(false)}
      />
    );
  }

  if (userProfile.must_change_password) {
    return <ChangePasswordForm fullScreen />;
  }

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard onNavigate={setActiveView} learnerMode={learnerMode} />;
      case 'organizations':
        return <Organizations />;
      case 'departments':
        return <Departments />;
      case 'employees':
        return <Employees />;
      case 'designations':
        return <Designations />;
      case 'candidates':
        return <Candidates />;
      case 'assessments':
        return <Assessments />;
      case 'growth-profile-guide':
        return <GrowthProfileGuide />;
      case 'skills':
      case 'skill-builder':
        return <Skills />;
      case 'courses':
        return <Courses />;
      case 'course-builder':
        return <CourseBuilder />;
      case 'skill-mapping':
        // Staff manage the mapping inside Skills; learners see their own skill picture.
        return !learnerMode && (userProfile?.role === 'admin' || userProfile?.role === 'l_d_manager')
          ? <Skills initialTab="mapping" />
          : <SkillMapping onNavigateToLearning={() => setActiveView('my-learning')} />;
      case 'learning-path-builder':
        return <LearningPathBuilder />;
      case 'my-learning':
        return <MyLearning />;
      case 'assign-learning':
        return <AssignLearning />;
      case 'course-access-requests':
        return <CourseBuilder initialTab="requests" />;
      case 'okrs':
        return <OKRs learnerMode={learnerMode} />;
      case 'reviews': // retired stub; performance lives in OKRs
        return <OKRs learnerMode={learnerMode} />;
      case 'repository':
        return <Repository />;
      case 'user-management': // folded into People; old links still land somewhere useful
        return <Employees />;
      case 'inductions':
        return <Inductions />;
      case 'settings':
        return <Settings onNavigate={setActiveView} />;
      case 'super-admin':
        return <SuperAdminDashboard />;
      case 'messages':
        return <Messages />;
      case 'pinned-resources':
        return <PinnedResources />;
      case 'user-profile':
        return <UserProfile />;
      default:
        return (
          <div className="p-8">
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Coming Soon</h2>
              <p className="text-gray-600">This feature is under development</p>
            </div>
          </div>
        );
    }
  };

  const toggleLearnerMode = () => {
    setLearnerMode(v => {
      setActiveView(v ? 'dashboard' : 'my-learning');
      return !v;
    });
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden max-w-full">
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        learnerMode={learnerMode}
        onToggleLearnerMode={toggleLearnerMode}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header activeView={activeView} onNavigate={setActiveView} />
        {/* Bottom padding on small screens keeps content clear of the tab bar. */}
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          {renderView()}
        </main>
      </div>
      <MobileNav
        activeView={activeView}
        onViewChange={setActiveView}
        learnerMode={learnerMode}
        onToggleLearnerMode={toggleLearnerMode}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
