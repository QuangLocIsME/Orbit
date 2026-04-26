'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { resetPassword } from '@/modules/auth/service/auth-service.js';

function getEmailFromUrl(): string {
  if (typeof window === 'undefined') return '';
  const encoded = new URLSearchParams(window.location.search).get('email');
  if (!encoded) return '';
  try {
    return atob(encoded);
  } catch {
    return '';
  }
}


  const getPasswordStrength = (password: string): { score: number; label: string; color: string } => {
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
};

interface ResetPasswordFormProps {
  token: string;
  email?: string;
}

export default function ResetPasswordForm({ token, email: emailFromUrl }: ResetPasswordFormProps) {
  const email = emailFromUrl || getEmailFromUrl();
  const [formData, setFormData] = useState({ newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const styleId = 'reset-password-animations';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes hologramShift {
        0%, 100% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
      }
      @keyframes scanLine {
        0% { opacity: 0; transform: translateX(-100%); }
        50% { opacity: 0.4; }
        100% { opacity: 0; transform: translateX(100%); }
      }
      @keyframes float {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-10px); }
      }
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .animate-fade-in-up {
        animation: fadeInUp 0.5s ease-out forwards;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.getElementById(styleId)?.remove();
    };
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    const { newPassword, confirmPassword } = formData;

    if (!newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(newPassword)) {
      newErrors.newPassword = 'Password must contain at least one uppercase letter';
    } else if (!/[a-z]/.test(newPassword)) {
      newErrors.newPassword = 'Password must contain at least one lowercase letter';
    } else if (!/[0-9]/.test(newPassword)) {
      newErrors.newPassword = 'Password must contain at least one number';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleBlur = (field: string) => () => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateForm();
  };

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await resetPassword(token, formData.newPassword, formData.confirmPassword, email);
      setIsSuccess(true);
      toast.success('Password reset successfully!');
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset password. Please try again.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrength = getPasswordStrength(formData.newPassword);

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-white">
        <header className="sticky top-0 z-50 border-b border-[#F9FAFB] bg-white px-4 sm:px-6 lg:px-[205px]">
          <div className="mx-auto flex h-16 max-w-[1292px] items-center">
            <a href="/">
              <svg width="129" height="44" viewBox="0 0 129 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M42.5539 35V7.78737H54.1183C57.0265 7.78737 59.1364 8.03487 60.4482 8.52987C61.7723 9.0125 62.8303 9.87875 63.6223 11.1286C64.4143 12.3785 64.8103 13.8078 64.8103 15.4166C64.8103 17.4584 64.2102 19.1476 63.0098 20.4841C61.8094 21.8082 60.015 22.6436 57.6267 22.9901C58.8147 23.6831 59.7923 24.4441 60.5595 25.2732C61.3392 26.1024 62.3848 27.575 63.6966 29.6911L67.0193 35H60.4482L56.4758 29.0786C55.065 26.9624 54.0998 25.6321 53.58 25.0876C53.0603 24.5307 52.5096 24.1533 51.928 23.9553C51.3463 23.7449 50.4244 23.6397 49.1622 23.6397H48.0484V35H42.5539ZM48.0484 19.2961H52.1136C54.7495 19.2961 56.3953 19.1847 57.0512 18.962C57.7071 18.7392 58.2207 18.3556 58.5919 17.8111C58.9632 17.2666 59.1488 16.586 59.1488 15.7692C59.1488 14.8535 58.9013 14.1172 58.4063 13.5603C57.9237 12.9911 57.2368 12.6322 56.3458 12.4837C55.9003 12.4218 54.5638 12.3909 52.3363 12.3909H48.0484V19.2961ZM70.0264 7.78737H80.904C83.0573 7.78737 84.6598 7.88019 85.7117 8.06581C86.776 8.23906 87.7227 8.61031 88.5518 9.17956C89.3933 9.74881 90.0925 10.5099 90.6493 11.4627C91.2062 12.4032 91.4847 13.4613 91.4847 14.6369C91.4847 15.9116 91.1382 17.081 90.4452 18.1452C89.7645 19.2095 88.8364 20.0077 87.6608 20.5398C89.319 21.0224 90.5937 21.8454 91.4847 23.0086C92.3757 24.1719 92.8212 25.5393 92.8212 27.1109C92.8212 28.3484 92.5303 29.555 91.9487 30.7306C91.3795 31.8939 90.5937 32.8282 89.5913 33.5336C88.6013 34.2266 87.3762 34.6535 85.9159 34.8144C85.0002 34.9134 82.7912 34.9752 79.2891 35H70.0264V7.78737ZM75.5209 12.3166V18.6093H79.122C81.2629 18.6093 82.5932 18.5784 83.113 18.5165C84.0535 18.4051 84.7898 18.0834 85.3219 17.5512C85.8664 17.0067 86.1387 16.2952 86.1387 15.4166C86.1387 14.5751 85.9035 13.8944 85.4333 13.3747C84.9754 12.8426 84.2886 12.5208 83.3728 12.4094C82.8283 12.3476 81.2629 12.3166 78.6765 12.3166H75.5209ZM75.5209 23.1386V30.4151H80.607C82.587 30.4151 83.8431 30.3594 84.3752 30.248C85.192 30.0995 85.854 29.7406 86.3614 29.1714C86.8812 28.5897 87.141 27.8163 87.141 26.8511C87.141 26.0343 86.9368 25.3351 86.5284 24.7535C86.1201 24.1595 85.5323 23.7449 84.765 23.5098C83.9977 23.2623 82.4694 23.1386 80.1801 23.1386H75.5209Z" fill="#1F4CB1"/>
                <path d="M97.3133 35V7.78737H102.808V35H97.3133ZM114.187 35V12.3909H106.112V7.78737H127.737V12.3909H119.681V35H114.187Z" fill="#C1C7CD"/>
                <path d="M21.8445 34.1397C29.235 34.1397 35.2262 28.1486 35.2262 20.7581C35.2262 13.3676 29.235 7.37646 21.8445 7.37646C14.4541 7.37646 8.46289 13.3676 8.46289 20.7581C8.46289 28.1486 14.4541 34.1397 21.8445 34.1397Z" stroke="#1F4CB1" strokeWidth="5.57568"/>
                <path d="M23.9016 26.1807C33.5021 20.6379 39.8257 13.6171 38.0257 10.4994C36.2257 7.3817 26.9838 9.34768 17.3833 14.8905C7.78275 20.4334 1.45919 27.4542 3.2592 30.5718C5.0592 33.6895 14.3011 31.7236 23.9016 26.1807Z" stroke="#C1C7CD" strokeWidth="2.67633" strokeLinecap="round"/>
                <path d="M33.3821 13.9751C31.0555 10.0262 26.7595 7.37646 21.8445 7.37646C14.4541 7.37646 8.46289 13.3676 8.46289 20.7581C8.46289 22.7016 8.87723 24.5484 9.6224 26.2149" stroke="#1F4CB1" strokeWidth="5.57568"/>
              </svg>
            </a>
          </div>
        </header>

        <main className="flex min-h-[calc(100vh-64px)] items-center justify-center p-4">
          <div className="relative w-full max-w-[1040px] overflow-hidden rounded-[48px] bg-white shadow-2xl">
            <div className="flex min-h-[640px]">
              <div className="flex w-full flex-col justify-center p-8 md:w-1/2 md:p-12">
                <div className="animate-fade-in-up text-center">
                  <div className="mb-6 flex justify-center">
                    <CheckCircle2 className="h-16 w-16 text-green-500" />
                  </div>
                  <h1 className="text-[32px] font-semibold text-[#111827]">
                    Password reset successfully!
                  </h1>
                  <p className="mt-3 text-[#616874]">
                    Your password has been updated.
                    <br />You can now sign in with your new password.
                  </p>
                </div>
              </div>

              <div className="relative hidden w-1/2 md:block">
                <div
                  className="h-full w-full overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, #60A5FA 0%, #818CF8 30%, #A78BFA 50%, #60A5FA 70%, #3B82F6 100%)',
                    backgroundSize: '200% 200%',
                    animation: 'hologramShift 8s ease-in-out infinite',
                  }}
                >
                  <div className="absolute inset-0 opacity-10">
                    {[...Array(15)].map((_, i) => (
                      <div
                        key={i}
                        className="absolute h-px w-full bg-white"
                        style={{ top: `${i * 7}%`, animation: `scanLine 4s linear infinite`, animationDelay: `${i * 0.2}s` }}
                      />
                    ))}
                  </div>
                  <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
                  <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-purple-400/20 blur-3xl" />
                  <div className="relative flex h-full flex-col items-center justify-center p-12">
                    <div
                      className="mb-8 rounded-2xl bg-white/15 p-6 backdrop-blur-sm"
                      style={{ animation: 'float 4s ease-in-out infinite' }}
                    >
                      <svg className="h-16 w-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                      </svg>
                    </div>
                    <h2 className="text-center text-2xl font-normal text-white">
                      New password, new account
                    </h2>
                    <p className="mt-4 max-w-xs text-center text-white/80">
                      Set a strong password to keep your account secure
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 border-b border-[#F9FAFB] bg-white px-4 sm:px-6 lg:px-[205px]">
        <div className="mx-auto flex h-16 max-w-[1292px] items-center justify-between">
          <a href="/">
            <svg width="129" height="44" viewBox="0 0 129 44" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M42.5539 35V7.78737H54.1183C57.0265 7.78737 59.1364 8.03487 60.4482 8.52987C61.7723 9.0125 62.8303 9.87875 63.6223 11.1286C64.4143 12.3785 64.8103 13.8078 64.8103 15.4166C64.8103 17.4584 64.2102 19.1476 63.0098 20.4841C61.8094 21.8082 60.015 22.6436 57.6267 22.9901C58.8147 23.6831 59.7923 24.4441 60.5595 25.2732C61.3392 26.1024 62.3848 27.575 63.6966 29.6911L67.0193 35H60.4482L56.4758 29.0786C55.065 26.9624 54.0998 25.6321 53.58 25.0876C53.0603 24.5307 52.5096 24.1533 51.928 23.9553C51.3463 23.7449 50.4244 23.6397 49.1622 23.6397H48.0484V35H42.5539ZM48.0484 19.2961H52.1136C54.7495 19.2961 56.3953 19.1847 57.0512 18.962C57.7071 18.7392 58.2207 18.3556 58.5919 17.8111C58.9632 17.2666 59.1488 16.586 59.1488 15.7692C59.1488 14.8535 58.9013 14.1172 58.4063 13.5603C57.9237 12.9911 57.2368 12.6322 56.3458 12.4837C55.9003 12.4218 54.5638 12.3909 52.3363 12.3909H48.0484V19.2961ZM70.0264 7.78737H80.904C83.0573 7.78737 84.6598 7.88019 85.7117 8.06581C86.776 8.23906 87.7227 8.61031 88.5518 9.17956C89.3933 9.74881 90.0925 10.5099 90.6493 11.4627C91.2062 12.4032 91.4847 13.4613 91.4847 14.6369C91.4847 15.9116 91.1382 17.081 90.4452 18.1452C89.7645 19.2095 88.8364 20.0077 87.6608 20.5398C89.319 21.0224 90.5937 21.8454 91.4847 23.0086C92.3757 24.1719 92.8212 25.5393 92.8212 27.1109C92.8212 28.3484 92.5303 29.555 91.9487 30.7306C91.3795 31.8939 90.5937 32.8282 89.5913 33.5336C88.6013 34.2266 87.3762 34.6535 85.9159 34.8144C85.0002 34.9134 82.7912 34.9752 79.2891 35H70.0264V7.78737ZM75.5209 12.3166V18.6093H79.122C81.2629 18.6093 82.5932 18.5784 83.113 18.5165C84.0535 18.4051 84.7898 18.0834 85.3219 17.5512C85.8664 17.0067 86.1387 16.2952 86.1387 15.4166C86.1387 14.5751 85.9035 13.8944 85.4333 13.3747C84.9754 12.8426 84.2886 12.5208 83.3728 12.4094C82.8283 12.3476 81.2629 12.3166 78.6765 12.3166H75.5209ZM75.5209 23.1386V30.4151H80.607C82.587 30.4151 83.8431 30.3594 84.3752 30.248C85.192 30.0995 85.854 29.7406 86.3614 29.1714C86.8812 28.5897 87.141 27.8163 87.141 26.8511C87.141 26.0343 86.9368 25.3351 86.5284 24.7535C86.1201 24.1595 85.5323 23.7449 84.765 23.5098C83.9977 23.2623 82.4694 23.1386 80.1801 23.1386H75.5209Z" fill="#1F4CB1"/>
              <path d="M97.3133 35V7.78737H102.808V35H97.3133ZM114.187 35V12.3909H106.112V7.78737H127.737V12.3909H119.681V35H114.187Z" fill="#C1C7CD"/>
              <path d="M21.8445 34.1397C29.235 34.1397 35.2262 28.1486 35.2262 20.7581C35.2262 13.3676 29.235 7.37646 21.8445 7.37646C14.4541 7.37646 8.46289 13.3676 8.46289 20.7581C8.46289 28.1486 14.4541 34.1397 21.8445 34.1397Z" stroke="#1F4CB1" strokeWidth="5.57568"/>
              <path d="M23.9016 26.1807C33.5021 20.6379 39.8257 13.6171 38.0257 10.4994C36.2257 7.3817 26.9838 9.34768 17.3833 14.8905C7.78275 20.4334 1.45919 27.4542 3.2592 30.5718C5.0592 33.6895 14.3011 31.7236 23.9016 26.1807Z" stroke="#C1C7CD" strokeWidth="2.67633" strokeLinecap="round"/>
              <path d="M33.3821 13.9751C31.0555 10.0262 26.7595 7.37646 21.8445 7.37646C14.4541 7.37646 8.46289 13.3676 8.46289 20.7581C8.46289 22.7016 8.87723 24.5484 9.6224 26.2149" stroke="#1F4CB1" strokeWidth="5.57568"/>
            </svg>
          </a>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="/#features" className="text-sm text-[#616874] hover:text-[#111827]">Features</a>
            <a href="/#pricing" className="text-sm text-[#616874] hover:text-[#111827]">Pricing</a>
            <a href="/#about" className="text-sm text-[#616874] hover:text-[#111827]">About</a>
          </nav>
          <div className="flex items-center gap-3">
            <a href="/login" className="hidden rounded-[10px] px-4 py-2 text-sm text-[#616874] hover:bg-[#F3F4F6] sm:block">
              Log in
            </a>
            <a href="/register" className="rounded-[10px] bg-[#2563EB] px-4 py-2 text-sm text-white hover:bg-[#1D4ED8]">
              Get Started
            </a>
          </div>
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-64px)] items-center justify-center p-4">
        <div className="relative w-full max-w-[1040px] overflow-hidden rounded-[48px] bg-white shadow-2xl">
          <div className="flex min-h-[640px]">
            <div className="flex w-full flex-col justify-center p-8 md:w-1/2 md:p-12">
              <a
                href="/login"
                className="mb-8 inline-flex w-fit items-center gap-2 text-sm text-[#616874] transition-colors hover:text-[#111827]"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.67}>
                  <path d="M15 19l-7-7 7-7" />
                </svg>
                Back to login
              </a>

              <div className="animate-fade-in-up">
                <h1 className="text-[32px] font-semibold text-[#111827]">
                  Reset password
                </h1>
                <p className="mt-2 text-[#616874]">
                  Enter your new password below.
                </p>

                <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                  <div>
                    <label htmlFor="newPassword" className="mb-2 block text-sm font-medium text-[#364153]">
                      New password
                    </label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.newPassword}
                        onChange={handleChange('newPassword')}
                        onBlur={handleBlur('newPassword')}
                        placeholder="Enter new password"
                        className="h-[48px] pl-12 pr-12 rounded-[14px]"
                        aria-invalid={!!(errors.newPassword && touched.newPassword)}
                      />
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                        <svg className="h-5 w-5 text-[#616874]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.67}>
                          <rect x="5" y="11" width="14" height="10" rx="2" />
                          <path d="M8 11V7a4 4 0 018 0v4" />
                        </svg>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-4 text-[#616874] hover:text-[#111827]"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {errors.newPassword && touched.newPassword && (
                      <p className="mt-1.5 text-sm text-red-500">{errors.newPassword}</p>
                    )}

                    {formData.newPassword && (
                      <div className="mt-2">
                        <div className="flex gap-1">
                          {[...Array(6)].map((_, i) => (
                            <div
                              key={i}
                              className={`h-1 flex-1 rounded-full transition-colors ${i < passwordStrength.score ? passwordStrength.color : 'bg-gray-200'}`}
                            />
                          ))}
                        </div>
                        <p className="mt-1 text-xs text-gray-500">Strength: {passwordStrength.label}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-[#364153]">
                      Confirm password
                    </label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={formData.confirmPassword}
                        onChange={handleChange('confirmPassword')}
                        onBlur={handleBlur('confirmPassword')}
                        placeholder="Confirm new password"
                        className="h-[48px] pl-12 pr-12 rounded-[14px]"
                        aria-invalid={!!(errors.confirmPassword && touched.confirmPassword)}
                      />
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                        <svg className="h-5 w-5 text-[#616874]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.67}>
                          <rect x="5" y="11" width="14" height="10" rx="2" />
                          <path d="M8 11V7a4 4 0 018 0v4" />
                        </svg>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-4 text-[#616874] hover:text-[#111827]"
                      >
                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {errors.confirmPassword && touched.confirmPassword && (
                      <p className="mt-1.5 text-sm text-red-500">{errors.confirmPassword}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                    {isLoading ? <Spinner className="h-5 w-5" /> : 'Reset password'}
                  </Button>
                </form>
              </div>
            </div>

            <div className="relative hidden w-1/2 md:block">
              <div
                className="h-full w-full overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #60A5FA 0%, #818CF8 30%, #A78BFA 50%, #60A5FA 70%, #3B82F6 100%)',
                  backgroundSize: '200% 200%',
                  animation: 'hologramShift 8s ease-in-out infinite',
                }}
              >
                <div className="absolute inset-0 opacity-10">
                  {[...Array(15)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute h-px w-full bg-white"
                      style={{ top: `${i * 7}%`, animation: `scanLine 4s linear infinite`, animationDelay: `${i * 0.2}s` }}
                    />
                  ))}
                </div>
                <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
                <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-purple-400/20 blur-3xl" />
                <div className="relative flex h-full flex-col items-center justify-center p-12">
                  <div
                    className="mb-8 rounded-2xl bg-white/15 p-6 backdrop-blur-sm"
                    style={{ animation: 'float 4s ease-in-out infinite' }}
                  >
                    <svg className="h-16 w-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                    </svg>
                  </div>
                  <h2 className="text-center text-2xl font-normal text-white">
                    New password, new account
                  </h2>
                  <p className="mt-4 max-w-xs text-center text-white/80">
                    Set a strong password to keep your account secure
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
