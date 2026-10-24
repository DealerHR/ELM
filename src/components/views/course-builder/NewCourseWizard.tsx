import { useState } from 'react';
import { X, Plus, Trash2, ArrowUp, ArrowDown, Upload, Link as LinkIcon, Video, FileText, Presentation, HelpCircle, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { getYouTubeEmbedUrl } from '../../viewers/ContentViewer';

/*
 * New course in one sitting: basics → modules (several at once) → publish.
 * Nothing is written until the last step, so abandoning it leaves no draft behind.
 */

type Delivery = 'self_paced' | 'classroom' | 'on_job';
type ModuleType = 'video' | 'document' | 'presentation' | 'link' | 'quiz';

interface DraftModule {
  key: string;
  title: string;
  content_type: ModuleType;
  content_url: string;
  file: File | null;
  duration_minutes: number;
  is_mandatory: boolean;
}

interface Props {
  isAssessment: boolean;
  skills: { id: string; name: string }[];
  onClose: () => void;
  onCreated: (courseId: string) => void;
}

const TYPE_META: Record<ModuleType, { label: string; icon: typeof Video; hint: string }> = {
  video: { label: 'Video', icon: Video, hint: 'YouTube link or an MP4 file' },
  document: { label: 'Document', icon: FileText, hint: 'PDF or Word file' },
  presentation: { label: 'Slides', icon: Presentation, hint: 'PowerPoint or PDF file' },
  link: { label: 'Web link', icon: LinkIcon, hint: 'Any web page' },
  quiz: { label: 'Quiz', icon: HelpCircle, hint: 'Add the questions after creating the course' },
};

const inputCls = 'w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stratefix-yellow focus:border-transparent bg-white';
const labelCls = 'block text-xs font-medium text-gray-500 mb-1';
const newModule = (type: ModuleType = 'video'): DraftModule => ({ key: Math.random().toString(36).slice(2), title: '', content_type: type, content_url: '', file: null, duration_minutes: type === 'quiz' ? 10 : 15, is_mandatory: true });

export default function NewCourseWizard({ isAssessment, skills, onClose, onCreated }: Props) {
  const { userProfile } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [basics, setBasics] = useState({ title: '', description: '', category: '', delivery_type: 'self_paced' as Delivery, duration_hours: 1, skill_ids: [] as string[] });
  const [mods, setMods] = useState<DraftModule[]>([newModule(isAssessment ? 'quiz' : 'video')]);
  const [publish, setPublish] = useState(true);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  const noun = isAssessment ? 'assessment' : 'course';
  const needsSource = (m: DraftModule) => m.content_type !== 'quiz' && (m.content_type === 'link' || m.content_type === 'video' ? !m.content_url.trim() && !m.file : !m.file);
  const moduleProblems = mods.map(m => !m.title.trim() ? 'needs a title' : needsSource(m) ? (m.content_type === 'link' ? 'needs a link' : 'needs a file or link') : (m.content_type === 'video' && m.content_url && !m.file && !getYouTubeEmbedUrl(m.content_url) && !/^https?:\/\//.test(m.content_url)) ? 'link is not valid' : null);
  const step1Ok = basics.title.trim().length > 0;
  const step2Ok = mods.length > 0 && moduleProblems.every(p => !p);

  const update = (key: string, patch: Partial<DraftModule>) => setMods(ms => ms.map(m => m.key === key ? { ...m, ...patch } : m));
  const move = (i: number, d: -1 | 1) => setMods(ms => { const j = i + d; if (j < 0 || j >= ms.length) return ms; const c = [...ms]; [c[i], c[j]] = [c[j], c[i]]; return c; });

  const create = async () => {
    if (!userProfile?.organization_id) return;
    setSaving(true); setError('');
    try {
      setProgress(`Creating the ${noun}…`);
      const { data: course, error: cErr } = await supabase.from('learning_courses').insert([{
        title: basics.title.trim(), description: basics.description.trim() || null, category: basics.category.trim() || null,
        delivery_type: basics.delivery_type, is_assessment: isAssessment, duration_hours: basics.duration_hours,
        status: publish ? 'published' : 'draft', is_active: publish, skill_ids: basics.skill_ids,
        organization_id: userProfile.organization_id, created_by: userProfile.id,
      }]).select('id').single();
      if (cErr || !course) throw cErr || new Error('Could not create the course.');

      for (let i = 0; i < mods.length; i++) {
        const m = mods[i];
        setProgress(`Adding module ${i + 1} of ${mods.length}: ${m.title}`);
        let content_file_path: string | null = null, content_file_name: string | null = null;
        if (m.file) {
          const ext = m.file.name.split('.').pop();
          const path = `${userProfile.organization_id}/${course.id}/${Date.now()}-${i}.${ext}`;
          const { error: upErr } = await supabase.storage.from('course-content').upload(path, m.file, { upsert: true });
          if (upErr) throw new Error(`Upload failed for "${m.title}": ${upErr.message}`);
          content_file_path = path; content_file_name = m.file.name;
        }
        const { error: mErr } = await supabase.from('learning_modules').insert([{
          course_id: course.id, title: m.title.trim(), description: null, content_type: m.content_type,
          content_url: m.content_url.trim() || '', content_file_path, content_file_name,
          duration_minutes: m.duration_minutes, is_mandatory: m.is_mandatory, order_index: i + 1,
        }]);
        if (mErr) throw new Error(`Could not add "${m.title}": ${mErr.message}`);
      }
      onCreated(course.id);
    } catch (e: any) {
      setError(e.message || 'Something went wrong.');
      setSaving(false);
    }
  };

  const totalMin = mods.reduce((s, m) => s + (m.duration_minutes || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={saving ? undefined : onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white w-full sm:max-w-3xl rounded-t-2xl sm:rounded-xl max-h-[94vh] flex flex-col">
        <div className="flex items-center gap-3 px-4 h-12 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-sm font-semibold text-gray-900">New {noun}</h3>
          <ol className="hidden sm:flex items-center gap-1 text-xs text-gray-500 ml-2">
            {(['Basics', 'Modules', 'Publish'] as const).map((l, i) => (
              <li key={l} className="flex items-center gap-1">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-semibold ${step === i + 1 ? 'bg-stratefix-yellow text-brand-on-primary' : step > i + 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{step > i + 1 ? '✓' : i + 1}</span>
                <span className={step === i + 1 ? 'text-gray-900 font-medium' : ''}>{l}</span>{i < 2 && <span className="mx-1 text-gray-300">—</span>}
              </li>
            ))}
          </ol>
          <div className="flex-1" />
          <button onClick={onClose} disabled={saving} className="w-9 h-9 -mr-2 flex items-center justify-center text-gray-500"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {step === 1 && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><label className={labelCls}>Title</label><input autoFocus className={inputCls} placeholder={isAssessment ? 'e.g. Product knowledge check — Aeris' : 'e.g. Handling the first customer visit'} value={basics.title} onChange={e => setBasics(b => ({ ...b, title: e.target.value }))} /></div>
              <div className="sm:col-span-2"><label className={labelCls}>What the learner will be able to do (optional)</label><textarea className="w-full min-h-[72px] px-3 py-2 border border-gray-300 rounded-lg text-sm" value={basics.description} onChange={e => setBasics(b => ({ ...b, description: e.target.value }))} /></div>
              {!isAssessment && (
                <div><label className={labelCls}>How it is delivered</label>
                  <select className={inputCls} value={basics.delivery_type} onChange={e => setBasics(b => ({ ...b, delivery_type: e.target.value as Delivery }))}>
                    <option value="self_paced">Self-paced (online modules)</option>
                    <option value="classroom">Classroom (L&D signs off attendance)</option>
                    <option value="on_job">On the job (L&D signs off)</option>
                  </select></div>
              )}
              <div><label className={labelCls}>Category (optional)</label><input className={inputCls} placeholder="e.g. Sales, Service, Induction" value={basics.category} onChange={e => setBasics(b => ({ ...b, category: e.target.value }))} /></div>
              <div><label className={labelCls}>Length (hours)</label><input type="number" min={0.25} step={0.25} className={inputCls} value={basics.duration_hours} onChange={e => setBasics(b => ({ ...b, duration_hours: Number(e.target.value) }))} /></div>
              {skills.length > 0 && (
                <div className="sm:col-span-2"><label className={labelCls}>Skills it builds (optional)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map(sk => { const on = basics.skill_ids.includes(sk.id); return (
                      <button key={sk.id} type="button" onClick={() => setBasics(b => ({ ...b, skill_ids: on ? b.skill_ids.filter(x => x !== sk.id) : [...b.skill_ids, sk.id] }))} className={`h-7 px-2.5 rounded-full text-xs font-medium border transition ${on ? 'bg-stratefix-black text-white border-stratefix-black' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>{sk.name}</button>
                    ); })}
                  </div></div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">Add the modules in the order learners take them. Mark the ones that must be done for the {noun} to count as complete.</p>
              {mods.map((m, i) => {
                const Meta = TYPE_META[m.content_type]; const problem = moduleProblems[i];
                const isVideoOrLink = m.content_type === 'video' || m.content_type === 'link';
                return (
                  <div key={m.key} className={`border rounded-lg p-3 space-y-2 ${problem && m.title ? 'border-amber-300' : 'border-gray-200'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                      <input className={`${inputCls} flex-1 min-w-0`} placeholder="Module title" value={m.title} onChange={e => update(m.key, { title: e.target.value })} />
                      <select className={`${inputCls} !w-32 flex-shrink-0`} value={m.content_type} onChange={e => update(m.key, { content_type: e.target.value as ModuleType, file: null, content_url: '' })}>{(Object.keys(TYPE_META) as ModuleType[]).map(t => <option key={t} value={t}>{TYPE_META[t].label}</option>)}</select>
                      <div className="hidden sm:flex items-center">
                        <button onClick={() => move(i, -1)} disabled={i === 0} className="h-8 w-8 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center"><ArrowUp className="w-3.5 h-3.5" /></button>
                        <button onClick={() => move(i, 1)} disabled={i === mods.length - 1} className="h-8 w-8 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center"><ArrowDown className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setMods(ms => ms.filter(x => x.key !== m.key))} disabled={mods.length === 1} className="h-8 w-8 rounded-md text-red-500 hover:bg-red-50 disabled:opacity-30 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <div className="pl-6 grid sm:grid-cols-[1fr_110px_auto] gap-2 items-center">
                      {m.content_type === 'quiz' ? (
                        <p className="text-xs text-gray-500 flex items-center gap-1.5"><Meta.icon className="w-3.5 h-3.5" /> {Meta.hint}</p>
                      ) : (
                        <div className="flex items-center gap-2 min-w-0">
                          {isVideoOrLink && <input className={inputCls} placeholder={m.content_type === 'video' ? 'YouTube link (or upload an MP4 →)' : 'https://…'} value={m.content_url} onChange={e => update(m.key, { content_url: e.target.value })} />}
                          {m.content_type !== 'link' && (
                            <label className="inline-flex items-center gap-1.5 h-9 px-3 border border-gray-300 rounded-lg text-xs font-medium cursor-pointer hover:bg-gray-50 whitespace-nowrap max-w-[220px]">
                              <Upload className="w-3.5 h-3.5 flex-shrink-0" /><span className="truncate">{m.file ? m.file.name : 'Upload file'}</span>
                              <input type="file" className="hidden" onChange={e => update(m.key, { file: e.target.files?.[0] || null })} />
                            </label>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-xs text-gray-600"><input type="number" min={1} className="h-9 w-16 px-2 border border-gray-300 rounded-lg text-sm" value={m.duration_minutes} onChange={e => update(m.key, { duration_minutes: Number(e.target.value) })} /> min</div>
                      <label className="inline-flex items-center gap-1.5 text-xs text-gray-700"><input type="checkbox" checked={m.is_mandatory} onChange={e => update(m.key, { is_mandatory: e.target.checked })} /> Required</label>
                    </div>
                    {problem && m.title && <p className="pl-6 text-xs text-amber-700 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> This module {problem}.</p>}
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-2">
                {(Object.keys(TYPE_META) as ModuleType[]).map(t => { const M = TYPE_META[t]; return (
                  <button key={t} onClick={() => setMods(ms => [...ms, newModule(t)])} className="inline-flex items-center gap-1.5 h-8 px-3 border border-dashed border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"><Plus className="w-3.5 h-3.5" /> {M.label}</button>
                ); })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="text-base font-semibold text-gray-900">{basics.title}</h4>
                <p className="text-xs text-gray-500 mt-0.5">{isAssessment ? 'Assessment' : basics.delivery_type.replace('_', ' ')}{basics.category ? ` · ${basics.category}` : ''} · {basics.duration_hours} h · {mods.length} module{mods.length === 1 ? '' : 's'} · {totalMin} min · {mods.filter(m => m.is_mandatory).length} required</p>
                <ol className="mt-3 space-y-1">
                  {mods.map((m, i) => { const M = TYPE_META[m.content_type]; return <li key={m.key} className="text-sm text-gray-800 flex items-center gap-2"><span className="text-xs text-gray-400 w-4">{i + 1}</span><M.icon className="w-3.5 h-3.5 text-gray-400" />{m.title}<span className="text-xs text-gray-500">· {m.duration_minutes} min{m.is_mandatory ? '' : ' · optional'}{m.file ? ` · ${m.file.name}` : ''}</span></li>; })}
                </ol>
              </div>
              {mods.some(m => m.content_type === 'quiz') && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Quiz modules have no questions yet. Add them from the module list (Questions) before learners take this {noun}.</p>}
              <div className="space-y-2">
                <label className="flex items-start gap-2 text-sm text-gray-800"><input type="radio" className="mt-1" checked={publish} onChange={() => setPublish(true)} /> <span><span className="font-medium">Publish now</span><span className="block text-xs text-gray-500">Learners can be assigned it straight away.</span></span></label>
                <label className="flex items-start gap-2 text-sm text-gray-800"><input type="radio" className="mt-1" checked={!publish} onChange={() => setPublish(false)} /> <span><span className="font-medium">Save as draft</span><span className="block text-xs text-gray-500">Only you see it until you publish from the course page.</span></span></label>
              </div>
              {saving && <p className="text-xs text-gray-600 flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-stratefix-yellow border-t-transparent rounded-full animate-spin" /> {progress}</p>}
              {error && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2 flex-shrink-0">
          {step > 1 && <button onClick={() => setStep(s => (s - 1) as 1 | 2 | 3)} disabled={saving} className="h-9 px-3 text-gray-700 text-sm font-medium hover:bg-gray-100 rounded-lg">Back</button>}
          <div className="flex-1" />
          {step < 3 ? (
            <button onClick={() => setStep(s => (s + 1) as 1 | 2 | 3)} disabled={step === 1 ? !step1Ok : !step2Ok} className="h-9 px-4 bg-stratefix-yellow text-brand-on-primary rounded-lg text-sm font-semibold hover:bg-stratefix-yellow/90 disabled:opacity-50 transition">Next</button>
          ) : (
            <button onClick={create} disabled={saving} className="inline-flex items-center gap-1.5 h-9 px-4 bg-stratefix-yellow text-brand-on-primary rounded-lg text-sm font-semibold hover:bg-stratefix-yellow/90 disabled:opacity-50 transition"><CheckCircle className="w-4 h-4" /> {saving ? 'Creating…' : publish ? `Create and publish` : 'Create draft'}</button>
          )}
        </div>
      </div>
    </div>
  );
}
