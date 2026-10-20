import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginForm from './components/auth/LoginForm';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Dashboard from './components/views/Dashboard';
import Organizations from './components/views/Organizations';
import Departments from './components/views/Departments';
import Employees from './components/views/Employees';
import Designations from './components/views/Designations';
import Candidates from './components/views/Candidates';
import Skills from './components/views/Skills';
import Courses from './components/views/Courses';
import OKRs from './components/views/OKRs';
import Repository from './components/views/Repository';
import Assessments from './components/views/Assessments';
import CourseBuilder from './components/views/CourseBuilder';
import SkillBuilder from './components/views/SkillBuilder';
import LearningPathBuilder from './components/views/LearningPathBuilder';
import MyLearning from './components/views/MyLearning';
import AssignLearning from './components/views/AssignLearning';
import Reviews from './components/views/Reviews';
import Settings from './components/views/Settings';
import UserManagement from './components/views/UserManagement';
import GrowthProfileGuide from './components/views/GrowthProfileGuide';
import SkillMapping from './components/views/SkillMapping';
import CandidatePortal from './components/portal/CandidatePortal';
import SuperAdminDashboard from './components/views/SuperAdminDashboard';
import Messages from './components/views/Messages';
import PinnedResources from './components/views/PinnedResources';
import UserProfile from './components/views/UserProfile';
import CourseAccessRequests from './components/views/CourseAccessRequests';

function AppContent() {
  const { user, userProfile } = useAuth();
  const [activeView, setActiveView] = useState('dashboard');
  const [isPortalRoute, setIsPortalRoute] = useState(() => {
    const hash = window.location.hash;
    return hash === '#/assess' || hash.startsWith('#/assess');
  });
  const [learnerMode, setLearnerMode] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const checkRoute = () => {
      const hash = window.location.hash;
      setIsPortalRoute(hash === '#/assess' || hash.startsWith('#/assess'));
    };
    window.addEventListener('hashchange', checkRoute);
    return () => window.removeEventListener('hashchange', checkRoute);
  }, []);

  if (isPortalRoute) {
    return <CandidatePortal />;
  }

  if (!user || !userProfile) {
    return <LoginForm />;
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
        return <Skills />;
      case 'skill-builder':
        return <SkillBuilder />;
      case 'courses':
        return <Courses />;
      case 'course-builder':
        return <CourseBuilder />;
      case 'skill-mapping':
        return <SkillMapping onNavigateToLearning={() => setActiveView('my-learning')} />;
      case 'learning-path-builder':
        return <LearningPathBuilder />;
      case 'my-learning':
        return <MyLearning />;
      case 'assign-learning':
        return <AssignLearning />;
      case 'course-access-requests':
        return <CourseAccessRequests />;
      case 'okrs':
        return <OKRs />;
      case 'reviews':
        return <Reviews />;
      case 'repository':
        return <Repository />;
      case 'user-management':
        return <UserManagement />;
      case 'settings':
        return <Settings />;
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

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden max-w-full">
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        learnerMode={learnerMode}
        onToggleLearnerMode={() => {
          setLearnerMode(v => {
            setActiveView(v ? 'dashboard' : 'my-learning');
            return !v;
          });
        }}
        isMobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header
          onNavigate={setActiveView}
          onMenuOpen={() => setMobileSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto">
          {renderView()}
        </main>
      </div>
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
