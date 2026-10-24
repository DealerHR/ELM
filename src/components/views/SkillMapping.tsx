import { useAuth } from '../../contexts/AuthContext';
import AdminSkillMapping from './skill-mapping/AdminSkillMapping';
import LearnerSkillMapping from './skill-mapping/LearnerSkillMapping';

export default function SkillMapping({ onNavigateToLearning }: { onNavigateToLearning?: () => void }) {
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'l_d_manager';

  if (isAdmin) {
    return (
      <div className="p-4 lg:p-6">
        <div className="mb-6">
          {/* page name is in the header */}
          <p className="text-sm text-gray-500 mt-1">Assign skills to employee roles and manage pass thresholds</p>
        </div>
        <AdminSkillMapping />
      </div>
    );
  }

  return <LearnerSkillMapping onNavigateToLearning={onNavigateToLearning} />;
}
