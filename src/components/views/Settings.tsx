import { Settings as SettingsIcon, User, Bell, Shield, Database } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function Settings() {
  const { userProfile } = useAuth();

  return (
    <div className="p-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Settings</h1>
        <p className="text-sm text-gray-600">Platform configuration and preferences</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white rounded-lg shadow-sm p-3 border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">Profile Settings</h3>
          </div>
          <p className="text-xs text-gray-600 mb-2">Manage your personal information and preferences</p>
          <button className="text-xs text-blue-950 hover:underline font-medium">
            Edit Profile
          </button>
        </div>

        {(userProfile?.role === 'admin') && (
          <>
            <div className="bg-white rounded-lg shadow-sm p-3 border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <Shield className="w-4 h-4 text-green-600" />
                </div>
                <h3 className="text-sm font-bold text-gray-900">Security</h3>
              </div>
              <p className="text-xs text-gray-600 mb-2">Manage authentication and access control</p>
              <button className="text-xs text-blue-950 hover:underline font-medium">
                Configure Security
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-3 border border-gray-100">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mb-2">
                <Database className="w-4 h-4 text-purple-600" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">Organization</h3>
              <p className="text-xs text-gray-600 mb-2">Organization-wide settings and configuration</p>
              <button className="text-xs text-blue-950 hover:underline font-medium">
                Manage Organization
              </button>
            </div>
          </>
        )}

        <div className="bg-white rounded-lg shadow-sm p-3 border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <Bell className="w-4 h-4 text-orange-600" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
          </div>
          <p className="text-xs text-gray-600 mb-2">Control email and in-app notifications</p>
          <button className="text-xs text-blue-950 hover:underline font-medium">
            Configure Notifications
          </button>
        </div>
      </div>

      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex gap-2">
          <SettingsIcon className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-blue-900 mb-1">Settings Under Development</h4>
            <p className="text-xs text-blue-800">
              Additional configuration options will be available here as features are added to the platform.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
