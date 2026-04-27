'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { forgotPassword } from '@/modules/auth/service/auth-service.js';

const validateEmail = (email: string): string | null => {
  if (!email) return 'Email is required';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return 'Please enter a valid email address';
  return null;
};

interface ForgotPasswordResponse {
  success: boolean;
  message: string;
  emailExists?: boolean;
}

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [emailNotFound, setEmailNotFound] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    const styleId = 'forgot-password-animations';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    setIsLoading(true);
    setError('');
    setEmailNotFound(false);

    try {
      const result: ForgotPasswordResponse = await forgotPassword(email);

      if (!result.emailExists) {
        setEmailNotFound(true);
        return;
      }

      setIsSubmitted(true);
      setCountdown(60);
      toast.success('Check your inbox for the reset code.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred. Please try again.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;

    setIsLoading(true);
    setError('');
    setEmailNotFound(false);

    try {
      await forgotPassword(email);
      setCountdown(60);
      toast.success('A new reset code has been sent.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resend. Please try again.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 border-b border-[#F9FAFB] bg-white px-4 sm:px-6 lg:px-[205px]">
        <div className="mx-auto flex h-16 max-w-[1292px] items-center justify-between">
          <a href="/" className="flex items-center">
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

              {!isSubmitted ? (
                <div className="animate-fade-in-up">
                  <h1 className="text-[32px] font-semibold text-[#111827]">
                    Forgot password?
                  </h1>
                  <p className="mt-2 text-[#616874]">
                    No worries, we&apos;ll send you reset instructions.
                  </p>

                  <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                    <div>
                      <label htmlFor="email" className="mb-2 block text-sm font-medium text-[#364153]">
                        Email
                      </label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (error) setError('');
                          if (emailNotFound) setEmailNotFound(false);
                        }}
                        placeholder="Enter your email"
                        className="h-[48px] rounded-[14px]"
                        aria-invalid={!!error || emailNotFound}
                      />
                      {error && (
                        <p className="mt-1.5 text-sm text-red-500">{error}</p>
                      )}
                      {emailNotFound && !error && (
                        <p className="mt-1.5 text-sm text-red-500">
                          This email is not registered. Please check your spelling or{' '}
                          <a href="/register" className="font-medium text-[#2563EB] hover:underline">
                            create a new account
                          </a>
                          .
                        </p>
                      )}
                    </div>

                    <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                      {isLoading ? <Spinner className="h-5 w-5" /> : 'Reset password'}
                    </Button>
                  </form>
                </div>
              ) : (
                <div className="animate-fade-in-up text-center">
                  <div className="mb-6 flex justify-center">
                    <svg className="h-16 w-16 text-[#2563EB]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                  </div>
                  <h1 className="text-[32px] font-semibold text-[#111827]">
                    Check your email
                  </h1>
                  <p className="mt-2 text-[#616874]">
                    We sent a verification code to
                  </p>
                  <p className="mt-1 font-medium text-[#111827]">{email}</p>

                  <p className="mt-8 text-sm text-[#616874]">
                    Did not receive the email?{' '}
                    {countdown > 0 ? (
                      <span className="text-[#9CA3AF]">
                        Resend in {countdown}s
                      </span>
                    ) : (
                      <button
                        onClick={handleResend}
                        disabled={isLoading}
                        className="text-[#2563EB] hover:underline disabled:opacity-50"
                      >
                        Click to resend
                      </button>
                    )}
                  </p>
                </div>
              )}
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
                    Password Recovery
                  </h2>
                  <p className="mt-4 max-w-xs text-center text-white/80">
                    We&apos;ll help you get back into your account safely and securely
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
