import { useState } from 'react';
import SkillBuilder from './SkillBuilder';
import AdminSkillMapping from './skill-mapping/AdminSkillMapping';

/*
 * Learn → Skills: the skill library with its question banks, and the mapping
 * of skills to designations with pass thresholds, in one place.
 */
export default function Skills({ initialTab = 'skills' }: { initialTab?: 'skills' | 'mapping' }) {
  const [tab, setTab] = useState<'skills' | 'mapping'>(initialTab);
  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 lg:px-6 h-11 flex items-center gap-5">
        {([{ id: 'skills', label: 'Skills & questions' }, { id: 'mapping', label: 'Role mapping' }] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`h-full text-sm border-b-2 transition ${tab === t.id ? 'border-stratefix-yellow text-gray-900 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'skills' ? <SkillBuilder embedded /> : (
          <div className="p-4 lg:p-6">
            <p className="text-sm text-gray-500 mb-4">Which skills each designation needs, and the score that counts as a pass.</p>
            <AdminSkillMapping />
          </div>
        )}
      </div>
    </div>
  );
}
