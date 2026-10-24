import { useState, useRef } from 'react';
import { Camera, Save, User, Mail, Phone, Building, Shield, CheckCircle, AlertCircle, Upload, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import ChangePasswordForm from '../auth/ChangePasswordForm';

const roleLabels: Record<string, string> = {
  employee: 'Employee',
  manager: 'Manager',
  hr: 'HR',
  l_d_manager: 'L&D Manager',
  admin: 'Admin',
  platform_admin: 'Platform Admin',
};

const roleColors: Record<string, string> = {
  employee: 'bg-gray-100 text-gray-700',
  manager: 'bg-blue-100 text-blue-700',
  hr: 'bg-teal-100 text-teal-700',
  l_d_manager: 'bg-amber-100 text-amber-700',
  admin: 'bg-red-100 text-red-700',
  platform_admin: 'bg-gray-900 text-white',
};

export default function UserProfile() {
  const { userProfile, setUserProfile } = useAuth();

  const [form, setForm] = useState({
    full_name: userProfile?.full_name || '',
    phone: userProfile?.phone || '',
  });

  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(userProfile?.avatar_url || null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userProfile) return;

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      showMessage('error', 'Image must be smaller than 5MB');
      return;
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      showMessage('error', 'Please upload a JPEG, PNG, or WebP image');
      return;
    }

    setUploadingAvatar(true);

    try {
      const localPreview = URL.createObjectURL(file);
      setPreviewUrl(localPreview);

      const ext = file.name.split('.').pop();
      const path = `${userProfile.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userProfile.id);

      if (updateError) throw updateError;

      setPreviewUrl(publicUrl);
      setUserProfile({ ...userProfile, avatar_url: publicUrl });
      showMessage('success', 'Profile photo updated!');
    } catch (err: any) {
      console.error('Error uploading avatar:', err);
      setPreviewUrl(userProfile.avatar_url || null);
      showMessage('error', err.message || 'Failed to upload photo. Please try again.');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!userProfile) return;
    setSaving(true);
    try {
      await supabase.from('user_profiles').update({ avatar_url: null }).eq('id', userProfile.id);
      setPreviewUrl(null);
      setUserProfile({ ...userProfile, avatar_url: null });
      showMessage('success', 'Profile photo removed.');
    } catch {
      showMessage('error', 'Failed to remove photo. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || null,
        })
        .eq('id', userProfile.id);

      if (error) throw error;

      setUserProfile({ ...userProfile, full_name: form.full_name.trim(), phone: form.phone.trim() || undefined });
      showMessage('success', 'Profile updated successfully!');
    } catch (err: any) {
      showMessage('error', err.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const initials = userProfile?.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

  return (
    <div className="p-5 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your personal information and profile photo</p>
      </div>

      {message && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-3 ${
          message.type === 'success' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
        }`}>
          {message.type === 'success'
            ? <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            : <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          }
          <p className={`text-sm font-medium ${message.type === 'success' ? 'text-emerald-700' : 'text-red-700'}`}>
            {message.text}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Avatar Card */}
        <div className="md:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center text-center">
            <div className="relative mb-4">
              <div className="w-24 h-24 rounded-2xl overflow-hidden bg-stratefix-black flex items-center justify-center ring-4 ring-gray-100">
                {previewUrl ? (
                  <img src={previewUrl} alt={userProfile?.full_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-black text-stratefix-yellow">{initials}</span>
                )}
              </div>
              {uploadingAvatar && (
                <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            <h2 className="text-base font-bold text-gray-900 mb-0.5">{userProfile?.full_name}</h2>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${roleColors[userProfile?.role || 'employee']}`}>
              {roleLabels[userProfile?.role || 'employee']}
            </span>

            <div className="w-full mt-4 space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="w-full flex items-center justify-center gap-2 py-2 bg-stratefix-black text-stratefix-yellow rounded-xl hover:bg-gray-900 transition text-xs font-semibold disabled:opacity-60"
              >
                {uploadingAvatar ? (
                  <>
                    <Upload className="w-3.5 h-3.5 animate-pulse" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Camera className="w-3.5 h-3.5" />
                    {previewUrl ? 'Change Photo' : 'Upload Photo'}
                  </>
                )}
              </button>
              {previewUrl && (
                <button
                  onClick={handleRemoveAvatar}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition text-xs font-semibold disabled:opacity-60"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove Photo
                </button>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-2">JPG, PNG or WebP. Max 5MB.</p>
          </div>

          {/* Account info */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mt-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Account Info</h3>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-[11px] text-gray-400">Email</p>
                  <p className="text-xs font-semibold text-gray-700 break-all">{userProfile?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-[11px] text-gray-400">Role</p>
                  <p className="text-xs font-semibold text-gray-700">{roleLabels[userProfile?.role || 'employee']}</p>
                </div>
              </div>
              {userProfile?.organization_id && (
                <div className="flex items-center gap-2.5">
                  <Building className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div>
                    <p className="text-[11px] text-gray-400">Organization</p>
                    <p className="text-xs font-semibold text-gray-700">Assigned</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Edit form */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" />
              Personal Information
            </h3>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.full_name}
                  onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                  placeholder="Your full name"
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-stratefix-yellow focus:border-transparent outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                  <input
                    type="email"
                    disabled
                    value={userProfile?.email || ''}
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-400 cursor-not-allowed"
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Email cannot be changed. Contact your administrator.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="+91 98765 43210"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-stratefix-yellow focus:border-transparent outline-none transition"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-stratefix-black text-stratefix-yellow rounded-xl hover:bg-gray-900 transition font-semibold text-sm disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Security section */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mt-3">
            <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">
              <Shield className="w-4 h-4 text-gray-400" />
              Security
            </h3>
            <p className="text-xs text-gray-500 mb-4">Choose a new password for your account.</p>
            <ChangePasswordForm />
          </div>
        </div>
      </div>
    </div>
  );
}
