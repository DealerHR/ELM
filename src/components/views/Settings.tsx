import { useEffect, useState } from 'react';
import { Upload, RotateCcw, CheckCircle, Megaphone, Link2, FolderOpen, ChevronRight, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { DEFAULT_BRAND, applyBrand, readableOn, type Brand } from '../../lib/brand';

/*
 * Setup → Settings: the organisation's name and logo, its four brand colours
 * (previewed live, applied for everyone at next sign-in), and onboarding
 * defaults. Admins edit; HR can read. Platform admins edit any organisation
 * from the Organizations screen.
 */

const inputCls = 'w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stratefix-yellow focus:border-transparent bg-white disabled:bg-gray-50';
const labelCls = 'block text-xs font-medium text-gray-500 mb-1';

const COLOURS: { key: keyof Brand; label: string; help: string }[] = [
  { key: 'primary', label: 'Primary', help: 'Buttons, active items, progress bars' },
  { key: 'on_primary', label: 'Text on primary', help: 'Text and icons placed on the primary colour' },
  { key: 'nav', label: 'Navigation', help: 'Side menu background' },
  { key: 'accent', label: 'Accent', help: 'Links and secondary highlights' },
];

export default function Settings({ onNavigate }: { onNavigate?: (v: string) => void }) {
  const { userProfile, organization, refreshOrganization } = useAuth();
  const canEdit = userProfile?.role === 'admin' || userProfile?.role === 'platform_admin';
  const [name, setName] = useState('');
  const [brand, setBrand] = useState<Brand>(DEFAULT_BRAND);
  const [defaults, setDefaults] = useState({ induction_days: 90, probation_months: 3 });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!organization) return;
    setName(organization.name);
    setBrand({ ...DEFAULT_BRAND, ...(organization.settings?.brand || {}) });
    setDefaults({ induction_days: Number(organization.settings?.induction_days) || 90, probation_months: Number(organization.settings?.probation_months) || 3 });
  }, [organization?.id]);

  // Live preview while editing; reverts to the saved brand if the person leaves without saving.
  useEffect(() => { applyBrand(brand); }, [brand]);
  useEffect(() => () => { applyBrand(organization?.settings?.brand); }, [organization?.settings?.brand]);

  const setColour = (key: keyof Brand, value: string) => {
    setBrand(b => {
      const next = { ...b, [key]: value };
      if (key === 'primary') next.on_primary = readableOn(value); // keep text readable by default; can be changed after
      return next;
    });
  };

  const save = async () => {
    if (!organization) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      let logo_url = organization.logo_url;
      if (logoFile) {
        const ext = (logoFile.name.split('.').pop() || 'png').toLowerCase();
        const path = `${organization.id}/logo-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('org-assets').upload(path, logoFile, { upsert: true, contentType: logoFile.type });
        if (upErr) throw upErr;
        logo_url = supabase.storage.from('org-assets').getPublicUrl(path).data.publicUrl;
      }
      const settings = { ...(organization.settings || {}), brand, induction_days: defaults.induction_days, probation_months: defaults.probation_months };
      const { error: err } = await supabase.from('organizations').update({ name: name.trim(), logo_url, settings }).eq('id', organization.id);
      if (err) throw err;
      await refreshOrganization();
      setLogoFile(null); setSaved(true);
    } catch (e: any) {
      setError(e.message || 'Could not save.');
    } finally { setSaving(false); }
  };

  if (!organization) {
    return <div className="p-6 text-sm text-gray-500">Settings belong to an organisation. Platform admins manage organisations under Platform → Organizations.</div>;
  }

  const Preview = () => (
    <div className="rounded-lg overflow-hidden border border-gray-200 flex h-40">
      <div className="w-14 flex flex-col items-center py-3 gap-3" style={{ background: brand.nav }}>
        <span className="w-7 h-7 rounded-md text-[10px] font-bold flex items-center justify-center" style={{ background: brand.primary, color: brand.on_primary }}>{(name || 'A')[0]}</span>
        <span className="w-7 h-7 rounded-md" style={{ background: brand.primary }} />
        <span className="w-7 h-7 rounded-md bg-white/10" />
        <span className="w-7 h-7 rounded-md bg-white/10" />
      </div>
      <div className="flex-1 bg-gray-50 p-3 space-y-2">
        <div className="h-3 w-32 bg-gray-300 rounded" />
        <div className="h-2 w-48 bg-gray-200 rounded" />
        <div className="h-1.5 w-40 bg-gray-200 rounded overflow-hidden"><div className="h-full w-2/3" style={{ background: brand.primary }} /></div>
        <div className="flex gap-2 pt-1">
          <span className="h-7 px-3 rounded-md text-xs font-semibold flex items-center" style={{ background: brand.primary, color: brand.on_primary }}>Primary action</span>
          <span className="h-7 px-2 text-xs font-medium flex items-center" style={{ color: brand.accent }}>Accent link</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-4">
      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-4">
          <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Organisation</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><label className={labelCls}>Name</label><input className={inputCls} value={name} disabled={!canEdit} onChange={e => setName(e.target.value)} /></div>
              <div>
                <label className={labelCls}>Logo <span className="text-gray-400">(PNG or SVG, square works best)</span></label>
                <div className="flex items-center gap-3">
                  {(logoFile || organization.logo_url) && <img src={logoFile ? URL.createObjectURL(logoFile) : organization.logo_url!} alt="" className="w-9 h-9 rounded-lg object-contain border border-gray-200 bg-white" />}
                  <label className={`inline-flex items-center gap-1.5 h-9 px-3 border border-gray-300 rounded-lg text-sm font-medium cursor-pointer hover:bg-gray-50 ${!canEdit ? 'opacity-50 pointer-events-none' : ''}`}>
                    <Upload className="w-3.5 h-3.5" /> {logoFile ? logoFile.name : 'Choose file'}
                    <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" disabled={!canEdit} onChange={e => setLogoFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900">Brand colours</h2>
              <div className="flex-1" />
              {canEdit && <button onClick={() => setBrand(DEFAULT_BRAND)} className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"><RotateCcw className="w-3.5 h-3.5" /> Reset to default</button>}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {COLOURS.map(c => (
                <div key={c.key} className="flex items-center gap-3">
                  <input type="color" value={brand[c.key]} disabled={!canEdit} onChange={e => setColour(c.key, e.target.value)} className="w-10 h-10 rounded-lg border border-gray-300 p-0.5 bg-white cursor-pointer disabled:cursor-default" />
                  <div className="flex-1 min-w-0">
                    <label className="block text-sm font-medium text-gray-900">{c.label}</label>
                    <p className="text-xs text-gray-500 truncate">{c.help}</p>
                  </div>
                  <input className="w-24 h-8 px-2 border border-gray-300 rounded-md text-xs font-mono uppercase" value={brand[c.key]} disabled={!canEdit} onChange={e => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && setBrand(b => ({ ...b, [c.key]: e.target.value }))} />
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500">Changes preview here as you go. Everyone sees the new colours the next time they sign in.</p>
          </section>

          <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Onboarding defaults</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><label className={labelCls}>Induction length (days)</label><input type="number" min={1} className={inputCls} value={defaults.induction_days} disabled={!canEdit} onChange={e => setDefaults(d => ({ ...d, induction_days: Number(e.target.value) }))} /></div>
              <div><label className={labelCls}>Probation (months)</label><input type="number" min={0} className={inputCls} value={defaults.probation_months} disabled={!canEdit} onChange={e => setDefaults(d => ({ ...d, probation_months: Number(e.target.value) }))} /></div>
            </div>
            <p className="text-xs text-gray-500">Used when a new induction template is created. Existing templates keep their own values.</p>
          </section>

          {error && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          {canEdit && (
            <div className="flex items-center gap-3">
              <button onClick={save} disabled={saving || !name.trim()} className="h-9 px-4 bg-stratefix-yellow text-brand-on-primary rounded-lg text-sm font-semibold hover:bg-stratefix-yellow/90 disabled:opacity-50 transition">{saving ? 'Saving…' : 'Save settings'}</button>
              {saved && <span className="text-xs text-emerald-700 inline-flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Saved</span>}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-gray-400" /> Preview</h2>
            <Preview />
            <p className="text-xs text-gray-500">Plan: <span className="font-medium text-gray-800 capitalize">{organization.plan}</span> · Status: <span className="font-medium text-gray-800 capitalize">{organization.status}</span></p>
          </section>
          <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <h2 className="text-sm font-semibold text-gray-900 px-4 h-10 flex items-center border-b border-gray-100">Also under Setup</h2>
            <ul className="divide-y divide-gray-100">
              {[
                { id: 'messages', label: 'Announcements', icon: Megaphone },
                { id: 'pinned-resources', label: 'Quick links', icon: Link2 },
                { id: 'repository', label: 'Repository', icon: FolderOpen },
              ].map(i => (
                <li key={i.id}>
                  <button onClick={() => onNavigate?.(i.id)} className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-gray-800 hover:bg-gray-50"><i.icon className="w-4 h-4 text-gray-400" />{i.label}<ChevronRight className="w-4 h-4 text-gray-300 ml-auto" /></button>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
