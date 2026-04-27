'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';
import { signOut } from '@/lib/auth';
import { updateAuthAvatar } from '@/stores/appStore';

const TABS = [
    { id: 'profile', label: 'Profile' },
    { id: 'security', label: 'Security' },
    { id: 'account', label: 'Account' },
];

interface UserProfile {
    id: string;
    publicId: string;
    fullName: string;
    email: string;
    avatar: string | null;
    provider: string;
    role: string;
    isVerified: boolean;
    hasPassword: boolean;
    twoFactorEnabled: boolean;
    twoFactorVerified: boolean;
    createdAt: string;
    lastLoginAt: string | null;
    jobTitle?: string | null;
    company?: string | null;
    bio?: string | null;
}

function LoadingSpinner({ className = 'h-5 w-5' }: { className?: string }) {
    return (
        <svg className={cn('animate-spin', className)} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
    );
}

function getInitials(name: string) {
    return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

export default function UserAccountSettings() {
    const [isHydrated, setIsHydrated] = useState(false);
    const [activeTab, setActiveTab] = useState('profile');
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);

    useEffect(() => {
        setIsHydrated(true);
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        setIsLoadingProfile(true);
        try {
            const res = await apiFetch('/api/user-settings/profile');
            if (res.ok) {
                const data = await res.json();
                setProfile(data.data);
            }
        } catch {
            toast.error('Failed to load profile');
        } finally {
            setIsLoadingProfile(false);
        }
    };

    if (!isHydrated || isLoadingProfile) {
        return <SettingsSkeleton />;
    }

    return (
        <div className="min-h-full bg-background">
            <div className="mx-auto max-w-4xl px-6 py-8">
                <div className="mb-8">
                    <h1 className="text-2xl font-semibold text-foreground">My Account</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Manage your personal information, security, and account preferences</p>
                </div>

                <div className="mb-8 border-b border-border">
                    <nav className="flex gap-6">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "pb-3 text-sm font-medium transition-colors border-b-2 -mb-px",
                                    activeTab === tab.id
                                        ? "border-primary text-primary"
                                        : "border-transparent text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {activeTab === 'profile' && <ProfileTab profile={profile} onProfileUpdate={setProfile} />}
                {activeTab === 'security' && <SecurityTab profile={profile} onProfileUpdate={setProfile} />}
                {activeTab === 'account' && <AccountTab profile={profile} />}
            </div>
        </div>
    );
}

function ProfileTab({ profile, onProfileUpdate }: { profile: UserProfile | null; onProfileUpdate: (p: UserProfile) => void }) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [fullName, setFullName] = useState(profile?.fullName || '');
    const [jobTitle, setJobTitle] = useState(profile?.jobTitle || '');
    const [company, setCompany] = useState(profile?.company || '');
    const [bio, setBio] = useState(profile?.bio || '');
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (profile) {
            setFullName(profile.fullName);
            setJobTitle(profile.jobTitle || '');
            setCompany(profile.company || '');
            setBio(profile.bio || '');
            setAvatarPreview(profile.avatar);
        }
    }, [profile]);

    const handleAvatarClick = () => fileInputRef.current?.click();

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            toast.error('File too large. Max size is 5MB.');
            return;
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            toast.error('Invalid file type. Allowed: JPG, PNG, GIF, WEBP.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => setAvatarPreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const handleUploadAvatar = async (file: File) => {
        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('avatar', file);
            const res = await apiFetch('/api/user-settings/avatar', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();
            if (res.ok && data.data?.avatar) {
                setAvatarPreview(data.data.avatar);
                if (profile) {
                    onProfileUpdate({ ...profile, avatar: data.data.avatar });
                }
                updateAuthAvatar(data.data.avatar);
                toast.success('Avatar updated');
            } else {
                toast.error(data.message || 'Failed to upload avatar');
            }
        } catch {
            toast.error('Failed to upload avatar');
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemoveAvatar = async () => {
        try {
            const res = await apiFetch('/api/user-settings/avatar/delete', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setAvatarPreview(null);
                if (profile) {
                    onProfileUpdate({ ...profile, avatar: null });
                }
                toast.success('Avatar removed');
            } else {
                toast.error(data.message || 'Failed to remove avatar');
            }
        } catch {
            toast.error('Failed to remove avatar');
        }
    };

    const handleSave = async () => {
        const newErrors: Record<string, string> = {};
        if (!fullName.trim() || fullName.trim().length < 2) {
            newErrors.fullName = 'Name must be at least 2 characters';
        }
        if (fullName.trim().length > 200) {
            newErrors.fullName = 'Name must be at most 200 characters';
        }
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setIsSaving(true);
        try {
            const res = await apiFetch('/api/user-settings/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullName: fullName.trim(), jobTitle, company, bio }),
            });
            const data = await res.json();
            if (res.ok) {
                if (profile) {
                    onProfileUpdate({
                        ...profile,
                        fullName: fullName.trim(),
                        jobTitle: jobTitle || null,
                        company: company || null,
                        bio: bio || null,
                    });
                }
                toast.success('Profile updated');
                setErrors({});
            } else {
                toast.error(data.message || 'Failed to update profile');
            }
        } catch {
            toast.error('Failed to update profile');
        } finally {
            setIsSaving(false);
        }
    };

    const currentAvatarSrc = avatarPreview;
    const displayInitials = getInitials(fullName || profile?.fullName || 'U');

    return (
        <div className="space-y-8">
            <div className="flex items-start gap-6">
                <div className="relative shrink-0">
                    {currentAvatarSrc ? (
                        <img
                            src={currentAvatarSrc}
                            alt="Avatar"
                            className="h-24 w-24 rounded-full object-cover ring-4 ring-background"
                        />
                    ) : (
                        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-primary text-2xl font-semibold ring-4 ring-background">
                            {displayInitials}
                        </div>
                    )}
                    <button
                        onClick={handleAvatarClick}
                        disabled={isUploading}
                        className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-card border border-border shadow-sm hover:bg-muted transition-colors disabled:opacity-50"
                        title="Change avatar"
                    >
                        {isUploading ? (
                            <LoadingSpinner className="h-3.5 w-3.5" />
                        ) : (
                            <svg className="h-3.5 w-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                        )}
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="hidden"
                        onChange={(e) => {
                            handleAvatarChange(e);
                            const file = e.target.files?.[0];
                            if (file) handleUploadAvatar(file);
                        }}
                    />
                </div>
                <div>
                    <h3 className="text-sm font-medium text-foreground">Profile Photo</h3>
                    <p className="mt-1 text-sm text-muted-foreground">JPG, PNG or WEBP. Max size 5MB.</p>
                    <div className="mt-3 flex gap-3">
                        <button
                            onClick={handleAvatarClick}
                            disabled={isUploading}
                            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            Upload Photo
                        </button>
                        {currentAvatarSrc && (
                            <button
                                onClick={handleRemoveAvatar}
                                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                            >
                                Remove
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid gap-6">
                <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Full Name</label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => {
                                setFullName(e.target.value);
                                setErrors({ ...errors, fullName: '' });
                            }}
                            className={cn(
                                "w-full rounded-lg border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-colors",
                                errors.fullName ? "border-red-500 focus:ring-red-500/20" : "border-input focus:border-ring"
                            )}
                        />
                        {errors.fullName && <p className="text-xs text-red-500">{errors.fullName}</p>}
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Email Address</label>
                        <input
                            type="email"
                            value={profile?.email || ''}
                            disabled
                            className="w-full cursor-not-allowed rounded-lg border border-input bg-muted/30 px-4 py-2.5 text-sm text-muted-foreground"
                        />
                    </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Job Title</label>
                        <input
                            type="text"
                            value={jobTitle}
                            onChange={(e) => setJobTitle(e.target.value)}
                            placeholder="e.g. Project Manager"
                            className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Company</label>
                        <input
                            type="text"
                            value={company}
                            onChange={(e) => setCompany(e.target.value)}
                            placeholder="e.g. Orbit Construction"
                            className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Bio</label>
                    <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        rows={3}
                        maxLength={500}
                        placeholder="Tell us about yourself..."
                        className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors"
                    />
                    <p className="text-xs text-muted-foreground text-right">{bio.length}/500</p>
                </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-border">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                    {isSaving ? <><LoadingSpinner />Saving...</> : 'Save Changes'}
                </button>
            </div>
        </div>
    );
}

function SecurityTab({ profile, onProfileUpdate }: { profile: UserProfile | null; onProfileUpdate: (p: UserProfile) => void }) {
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    const [is2FASetupOpen, setIs2FASetupOpen] = useState(false);
    const [twoFAData, setTwoFAData] = useState<{ secret: string; qrCodeUrl: string; otpauthUrl: string } | null>(null);
    const [twoFACode, setTwoFACode] = useState('');
    const [twoFAError, setTwoFAError] = useState('');
    const [isSettingUp2FA, setIsSettingUp2FA] = useState(false);
    const [isVerifying2FA, setIsVerifying2FA] = useState(false);
    const [isDisabling2FA, setIsDisabling2FA] = useState(false);
    const [disable2FAPassword, setDisable2FAPassword] = useState('');
    const [disable2FACode, setDisable2FACode] = useState('');
    const [disable2FAError, setDisable2FAError] = useState('');
    const [showDisable2FAPanel, setShowDisable2FAPanel] = useState(false);

    const passwordStrength = getPasswordStrength(newPassword);

    const handleChangePassword = async () => {
        if (!newPassword || !confirmPassword || !currentPassword) {
            setPasswordError('All fields are required');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError('Passwords do not match');
            return;
        }
        if (newPassword.length < 8) {
            setPasswordError('Password must be at least 8 characters');
            return;
        }
        setPasswordError('');
        setIsChangingPassword(true);
        try {
            const res = await apiFetch('/api/user-settings/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message || 'Password updated');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            } else {
                setPasswordError(data.message || 'Failed to change password');
            }
        } catch {
            setPasswordError('Failed to change password');
        } finally {
            setIsChangingPassword(false);
        }
    };

    const handleSetup2FA = async () => {
        setIsSettingUp2FA(true);
        try {
            const res = await apiFetch('/api/user-settings/2fa/setup', { method: 'POST' });
            const data = await res.json();
            if (res.ok && data.data) {
                setTwoFAData(data.data);
                setIs2FASetupOpen(true);
            } else {
                toast.error(data.message || 'Failed to setup 2FA');
            }
        } catch {
            toast.error('Failed to setup 2FA');
        } finally {
            setIsSettingUp2FA(false);
        }
    };

    const handleVerify2FA = async () => {
        if (!/^\d{6}$/.test(twoFACode)) {
            setTwoFAError('Please enter a valid 6-digit code');
            return;
        }
        setTwoFAError('');
        setIsVerifying2FA(true);
        try {
            const res = await apiFetch('/api/user-settings/2fa/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: twoFACode }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('Two-factor authentication enabled');
                if (profile) {
                    onProfileUpdate({ ...profile, twoFactorEnabled: true, twoFactorVerified: true });
                }
                setIs2FASetupOpen(false);
                setTwoFACode('');
                setTwoFAData(null);
            } else {
                setTwoFAError(data.message || 'Invalid code');
            }
        } catch {
            setTwoFAError('Verification failed');
        } finally {
            setIsVerifying2FA(false);
        }
    };

    const handleDisable2FA = async () => {
        if (!disable2FACode || !disable2FAPassword) {
            setDisable2FAError('Both fields are required');
            return;
        }
        if (!/^\d{6}$/.test(disable2FACode)) {
            setDisable2FAError('Please enter a valid 6-digit code');
            return;
        }
        setDisable2FAError('');
        setIsDisabling2FA(true);
        try {
            const res = await apiFetch('/api/user-settings/2fa/disable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: disable2FACode, password: disable2FAPassword }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('Two-factor authentication disabled');
                if (profile) {
                    onProfileUpdate({ ...profile, twoFactorEnabled: false, twoFactorVerified: false });
                }
                setShowDisable2FAPanel(false);
                setDisable2FACode('');
                setDisable2FAPassword('');
            } else {
                setDisable2FAError(data.message || 'Failed to disable 2FA');
            }
        } catch {
            setDisable2FAError('Failed to disable 2FA');
        } finally {
            setIsDisabling2FA(false);
        }
    };

    const isGoogleUser = profile?.provider === 'google';

    return (
        <div className="space-y-8">
            {isGoogleUser ? (
                <div className="rounded-lg border border-border bg-card p-6">
                    <h3 className="text-base font-semibold text-card-foreground">Password</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Your account is managed through Google. Password management is handled by Google.
                    </p>
                </div>
            ) : (
                <div className="rounded-lg border border-border bg-card p-6">
                    <h3 className="text-base font-semibold text-card-foreground">Password</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Update your password to keep your account secure</p>
                    <div className="mt-6 space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Current Password</label>
                            <div className="relative">
                                <input
                                    type={showCurrentPassword ? 'text' : 'password'}
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="Enter current password"
                                    className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showCurrentPassword ? (
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                    ) : (
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    )}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">New Password</label>
                            <div className="relative">
                                <input
                                    type={showNewPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Enter new password"
                                    className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showNewPassword ? (
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                    ) : (
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    )}
                                </button>
                            </div>
                            {newPassword && (
                                <div className="mt-1.5">
                                    <div className="flex gap-1">
                                        {[...Array(6)].map((_, i) => (
                                            <div
                                                key={i}
                                                className={cn(
                                                    "h-1 flex-1 rounded-full transition-colors",
                                                    i < passwordStrength.score ? passwordStrength.color : "bg-gray-200 dark:bg-zinc-700"
                                                )}
                                            />
                                        ))}
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">Strength: {passwordStrength.label}</p>
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Confirm New Password</label>
                            <div className="relative">
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm new password"
                                    className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showConfirmPassword ? (
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                    ) : (
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    )}
                                </button>
                            </div>
                        </div>
                        {passwordError && (
                            <p className="text-sm text-red-500">{passwordError}</p>
                        )}
                        <button
                            onClick={handleChangePassword}
                            disabled={isChangingPassword}
                            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            {isChangingPassword ? <><LoadingSpinner />Updating...</> : 'Update Password'}
                        </button>
                    </div>
                </div>
            )}

            <div className="rounded-lg border border-border bg-card p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="text-base font-semibold text-card-foreground">Two-Factor Authentication</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Add an extra layer of security by requiring a verification code from an authenticator app.
                        </p>
                    </div>
                    <span className={cn(
                        "shrink-0 rounded-full px-3 py-1 text-xs font-medium",
                        profile?.twoFactorEnabled
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-zinc-400"
                    )}>
                        {profile?.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                </div>

                {!profile?.twoFactorEnabled && !is2FASetupOpen && (
                    <button
                        onClick={handleSetup2FA}
                        disabled={isSettingUp2FA}
                        className="mt-4 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                        {isSettingUp2FA ? 'Setting up...' : 'Enable 2FA'}
                    </button>
                )}

                {is2FASetupOpen && twoFAData && (
                    <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4 space-y-4">
                        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                            <img
                                src={twoFAData.qrCodeUrl}
                                alt="2FA QR Code"
                                className="h-48 w-48 rounded-lg border border-border bg-white"
                            />
                            <div className="flex-1 space-y-3">
                                <p className="text-sm text-muted-foreground">
                                    Scan this QR code with an authenticator app (Google Authenticator, Authy, etc.)
                                </p>
                                <div className="rounded bg-muted/50 p-3">
                                    <p className="text-xs text-muted-foreground mb-1">Manual entry key:</p>
                                    <p className="font-mono text-sm break-all text-foreground">{twoFAData.secret}</p>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Store this key somewhere safe. You will need it if you lose access to your authenticator app.
                                </p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Enter the 6-digit code from your app</label>
                            <input
                                type="text"
                                value={twoFACode}
                                onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="000000"
                                maxLength={6}
                                className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors font-mono tracking-widest text-center"
                            />
                            {twoFAError && <p className="text-sm text-red-500">{twoFAError}</p>}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleVerify2FA}
                                disabled={isVerifying2FA || twoFACode.length !== 6}
                                className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                                {isVerifying2FA ? 'Verifying...' : 'Verify & Enable'}
                            </button>
                            <button
                                onClick={() => { setIs2FASetupOpen(false); setTwoFACode(''); setTwoFAData(null); }}
                                className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {profile?.twoFactorEnabled && !showDisable2FAPanel && (
                    <button
                        onClick={() => setShowDisable2FAPanel(true)}
                        className="mt-4 rounded-lg border border-destructive/30 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                    >
                        Disable 2FA
                    </button>
                )}

                {profile?.twoFactorEnabled && showDisable2FAPanel && (
                    <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
                        <p className="text-sm text-destructive font-medium">Disable Two-Factor Authentication</p>
                        <p className="text-sm text-muted-foreground">Enter your password and a 2FA code to confirm.</p>
                        <div className="space-y-2">
                            <input
                                type="password"
                                value={disable2FAPassword}
                                onChange={(e) => setDisable2FAPassword(e.target.value)}
                                placeholder="Your password"
                                className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors"
                            />
                            <input
                                type="text"
                                value={disable2FACode}
                                onChange={(e) => setDisable2FACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="2FA Code (000000)"
                                maxLength={6}
                                className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors font-mono tracking-widest"
                            />
                            {disable2FAError && <p className="text-sm text-red-500">{disable2FAError}</p>}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleDisable2FA}
                                disabled={isDisabling2FA}
                                className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                            >
                                {isDisabling2FA ? 'Disabling...' : 'Confirm Disable'}
                            </button>
                            <button
                                onClick={() => { setShowDisable2FAPanel(false); setDisable2FACode(''); setDisable2FAPassword(''); setDisable2FAError(''); }}
                                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function AccountTab({ profile }: { profile: UserProfile | null }) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteError, setDeleteError] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleted, setIsDeleted] = useState(false);

    const handleDeleteAccount = async () => {
        if (confirmText !== 'DELETE') {
            setDeleteError('Please type DELETE to confirm');
            return;
        }
        setDeleteError('');
        setIsDeleting(true);
        try {
            const res = await apiFetch('/api/user-settings/delete-account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirmText, password: deletePassword }),
            });
            const data = await res.json();
            if (res.ok) {
                setIsDeleted(true);
                toast.success('Account deleted. Redirecting...');
                setTimeout(() => signOut(), 1500);
            } else {
                setDeleteError(data.message || 'Failed to delete account');
            }
        } catch {
            setDeleteError('Failed to delete account');
        } finally {
            setIsDeleting(false);
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        });
    };

    if (isDeleted) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                    <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h3 className="text-lg font-semibold text-foreground">Account Deleted</h3>
                <p className="mt-1 text-sm text-muted-foreground">Redirecting you to the login page...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="text-base font-semibold text-card-foreground">Account Information</h3>
                <p className="mt-1 text-sm text-muted-foreground">Details about your account</p>
                <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-border">
                        <div>
                            <p className="text-sm font-medium text-foreground">Email</p>
                            <p className="text-sm text-muted-foreground">{profile?.email || ''}</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-border">
                        <div>
                            <p className="text-sm font-medium text-foreground">Account Created</p>
                            <p className="text-sm text-muted-foreground">{formatDate(profile?.createdAt || null)}</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between py-3">
                        <div>
                            <p className="text-sm font-medium text-foreground">Last Login</p>
                            <p className="text-sm text-muted-foreground">{formatDate(profile?.lastLoginAt || null)}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
                <h3 className="text-base font-semibold text-destructive">Danger Zone</h3>
                <p className="mt-1 text-sm text-muted-foreground">Permanently delete your account and all associated data. This action cannot be undone.</p>

                {!showDeleteConfirm ? (
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="mt-4 rounded-lg border border-destructive/30 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                    >
                        Delete Account
                    </button>
                ) : (
                    <div className="mt-4 space-y-3">
                        <p className="text-sm font-medium text-destructive">Are you absolutely sure?</p>
                        <p className="text-sm text-muted-foreground">
                            Type <strong>DELETE</strong> to confirm. This will permanently remove all your data including projects, tasks, and files.
                        </p>
                        <input
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="Type DELETE"
                            className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive/20 focus:border-destructive transition-colors"
                        />
                        {profile?.provider === 'local' && (
                            <input
                                type="password"
                                value={deletePassword}
                                onChange={(e) => setDeletePassword(e.target.value)}
                                placeholder="Enter your password"
                                className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive/20 focus:border-destructive transition-colors"
                            />
                        )}
                        {deleteError && <p className="text-sm text-red-500">{deleteError}</p>}
                        <div className="flex gap-3">
                            <button
                                onClick={handleDeleteAccount}
                                disabled={isDeleting || confirmText !== 'DELETE'}
                                className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                            >
                                {isDeleting ? 'Deleting...' : 'Yes, Delete My Account'}
                            </button>
                            <button
                                onClick={() => { setShowDeleteConfirm(false); setConfirmText(''); setDeletePassword(''); setDeleteError(''); }}
                                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500' };
    if (score <= 4) return { score, label: 'Medium', color: 'bg-yellow-500' };
    return { score, label: 'Strong', color: 'bg-green-500' };
}

function SettingsSkeleton() {
    return (
        <div className="min-h-full bg-background animate-pulse">
            <div className="mx-auto max-w-4xl px-6 py-8">
                <div className="mb-8 space-y-2">
                    <div className="h-8 w-48 rounded bg-muted" />
                    <div className="h-4 w-72 rounded bg-muted" />
                </div>
                <div className="mb-8 h-10 w-64 rounded border-b border-border" />
                <div className="space-y-6">
                    <div className="flex items-start gap-6">
                        <div className="h-24 w-24 rounded-full bg-muted" />
                        <div className="flex-1 space-y-3 pt-2">
                            <div className="h-4 w-24 rounded bg-muted" />
                            <div className="h-3 w-48 rounded bg-muted" />
                            <div className="flex gap-3">
                                <div className="h-9 w-28 rounded bg-muted" />
                                <div className="h-9 w-24 rounded bg-muted" />
                            </div>
                        </div>
                    </div>
                    <div className="grid gap-6 sm:grid-cols-2">
                        <div className="space-y-2">
                            <div className="h-4 w-20 rounded bg-muted" />
                            <div className="h-10 rounded-lg bg-muted" />
                        </div>
                        <div className="space-y-2">
                            <div className="h-4 w-24 rounded bg-muted" />
                            <div className="h-10 rounded-lg bg-muted" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
