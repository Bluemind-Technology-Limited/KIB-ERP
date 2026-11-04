import { useEffect, useState } from 'react';
import { KeyRound, Loader2, Mail, Save, ShieldCheck, UserRound } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { useAuthStore } from '../../../stores/useAuthStore';
import { PageDescription } from '../../../components/ui/PageDescription';

interface ProfileResponse {
  profile: {
    id: string;
    email: string;
    username: string;
    fullName: string;
    role: string;
    phoneNumber?: string | null;
    isActive: boolean;
    createdAt?: string;
  } | null;
}

export default function AccountSettings() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const setSession = useAuthStore((state) => state.setSession);

  const [profile, setProfile] = useState<ProfileResponse['profile']>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [profileForm, setProfileForm] = useState({ fullName: '', phoneNumber: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  useEffect(() => {
    let active = true;
    axiosClient
      .get<ProfileResponse>('/auth/profile', { toast: false })
      .then((res) => {
        if (!active) return;
        setProfile(res.data.profile);
        setProfileForm({
          fullName: res.data.profile?.fullName ?? user?.fullName ?? '',
          phoneNumber: res.data.profile?.phoneNumber ?? '',
        });
      })
      .catch((err: any) => {
        if (active) setError(err?.response?.data?.error || 'Failed to load your account details.');
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user?.fullName]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!profileForm.fullName.trim()) {
      setError('Full name cannot be empty.');
      return;
    }
    setSavingProfile(true);
    try {
      const res = await axiosClient.patch<ProfileResponse>('/auth/profile', {
        fullName: profileForm.fullName.trim(),
        phoneNumber: profileForm.phoneNumber.trim(),
      });
      setProfile(res.data.profile);
      if (user && res.data.profile) {
        setSession(
          {
            ...user,
            fullName: res.data.profile.fullName,
            phoneNumber: res.data.profile.phoneNumber ?? undefined,
          },
          token
        );
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save your profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);
    if (!passwordForm.currentPassword) {
      setPasswordFeedback({ type: 'error', message: 'Enter your current password.' });
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordFeedback({ type: 'error', message: 'New password must be at least 8 characters.' });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordFeedback({ type: 'error', message: 'The new passwords do not match.' });
      return;
    }
    if (passwordForm.newPassword === passwordForm.currentPassword) {
      setPasswordFeedback({ type: 'error', message: 'New password must be different from the current one.' });
      return;
    }

    setSavingPassword(true);
    try {
      await axiosClient.post('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordFeedback({ type: 'success', message: 'Password changed. Use it the next time you sign in.' });
    } catch (err: any) {
      setPasswordFeedback({
        type: 'error',
        message: err?.response?.data?.error || 'Failed to change your password.',
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const email = profile?.email ?? user?.email ?? '';
  const fullName = profile?.fullName ?? user?.fullName ?? '';
  const role = (profile?.role ?? user?.role ?? '').replace(/_/g, ' ');
  const initials = fullName
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="w-full mx-auto space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Account Settings</h2>
          <PageDescription>Update your profile and change your sign-in password.</PageDescription>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 2. Profile */}
        <form onSubmit={saveProfile} className="lg:col-span-2 bg-white border border-[#E9E9E9] rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <UserRound className="w-4 h-4 text-[#EA4335]" />
            <h3 className="text-xs font-bold text-[#171717]">Profile</h3>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center text-sm font-bold text-[#171717]">
                  {initials || <UserRound className="w-5 h-5 text-slate-400" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#171717] truncate">{fullName || '—'}</p>
                  <p className="text-[10px] text-slate-400 truncate">{email}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Full Name *</label>
                  <input
                    value={profileForm.fullName}
                    onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                    className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Phone Number</label>
                  <input
                    value={profileForm.phoneNumber}
                    onChange={(e) => setProfileForm({ ...profileForm, phoneNumber: e.target.value })}
                    placeholder="+234 800 000 0000"
                    className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email</label>
                  <div className="h-9 flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 text-xs text-slate-500">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{email || '—'}</span>
                  </div>
                  <p className="text-[9px] text-slate-400">Email changes are handled by an administrator.</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Role</label>
                  <div className="h-9 flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 text-xs">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                    <span className="uppercase tracking-wider text-[10px] font-bold text-slate-600">{role || '—'}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button type="submit" disabled={savingProfile} className="btn-3d px-4 h-9 disabled:opacity-50">
                  <span className="flex items-center gap-1.5 text-white text-xs font-semibold">
                    {savingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {savingProfile ? 'Saving…' : 'Save changes'}
                  </span>
                </button>
              </div>
            </>
          )}
        </form>

        {/* 3. Password */}
        <form onSubmit={changePassword} className="bg-white border border-[#E9E9E9] rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#EA4335]" />
            <h3 className="text-xs font-bold text-[#171717]">Change Password</h3>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Password *</label>
            <input
              type="password"
              autoComplete="current-password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">New Password *</label>
            <input
              type="password"
              autoComplete="new-password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Confirm New Password *</label>
            <input
              type="password"
              autoComplete="new-password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]"
            />
            <p className="text-[9px] text-slate-400">At least 8 characters.</p>
          </div>

          {passwordFeedback && (
            <div
              className={`rounded-lg border px-3 py-2 text-[11px] ${
                passwordFeedback.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-rose-200 bg-rose-50 text-rose-600'
              }`}
            >
              {passwordFeedback.message}
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button type="submit" disabled={savingPassword} className="btn-3d px-4 h-9 disabled:opacity-50">
              <span className="flex items-center gap-1.5 text-white text-xs font-semibold">
                {savingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                {savingPassword ? 'Updating…' : 'Update password'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
