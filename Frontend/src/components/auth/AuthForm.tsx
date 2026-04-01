'use client';

import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { login, register } from '@/modules/auth/service/auth-service.js';
import { apiUrl } from '@/config/api.js';

// Types
interface FormData {
  fullName?: string;
  email: string;
  password: string;
  confirmPassword?: string;
}

interface FormErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
  general?: string;
}

interface AuthFormProps {
  mode: 'login' | 'register';
}

// Validation utilities
const validators = {
  email: (email: string): string | null => {
    if (!email) return 'Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Please enter a valid email address';
    return null;
  },
  
  password: (password: string, isRegister: boolean): string | null => {
    if (!password) return 'Password is required';
    if (isRegister) {
      if (password.length < 8) return 'Password must be at least 8 characters';
      if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
      if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
      if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
    }
    return null;
  },
  
  confirmPassword: (password: string, confirmPassword: string): string | null => {
    if (!confirmPassword) return 'Please confirm your password';
    if (password !== confirmPassword) return 'Passwords do not match';
    return null;
  },
  
  fullName: (name: string): string | null => {
    if (!name) return 'Full name is required';
    if (name.length < 2) return 'Name must be at least 2 characters';
    return null;
  }
};

// Password strength calculator
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

// Icons
const UserIcon = () => (
  <svg className="h-5 w-5 text-[#616874]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.67}>
    <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const EmailIcon = () => (
  <svg className="h-5 w-5 text-[#616874]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.67}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M2 7l10 7 10-7" />
  </svg>
);

const LockIcon = () => (
  <svg className="h-5 w-5 text-[#616874]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.67}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 018 0v4" />
  </svg>
);

const EyeIcon = () => (
  <svg className="h-5 w-5 text-[#616874]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.67}>
    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const EyeOffIcon = () => (
  <svg className="h-5 w-5 text-[#616874]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.67}>
    <path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);

const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const BackIcon = () => (
  <svg className="h-5 w-5 text-[#616874]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.67}>
    <path d="M15 19l-7-7 7-7" />
  </svg>
);

const LoadingSpinner = () => (
  <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

// Sparkle Icon
const SparkleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
  </svg>
);

// ORBIT Logo
const OrbitLogo = () => (
  <svg width="129" height="44" viewBox="0 0 129 44" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M42.5539 35V7.78737H54.1183C57.0265 7.78737 59.1364 8.03487 60.4482 8.52987C61.7723 9.0125 62.8303 9.87875 63.6223 11.1286C64.4143 12.3785 64.8103 13.8078 64.8103 15.4166C64.8103 17.4584 64.2102 19.1476 63.0098 20.4841C61.8094 21.8082 60.015 22.6436 57.6267 22.9901C58.8147 23.6831 59.7923 24.4441 60.5595 25.2732C61.3392 26.1024 62.3848 27.575 63.6966 29.6911L67.0193 35H60.4482L56.4758 29.0786C55.065 26.9624 54.0998 25.6321 53.58 25.0876C53.0603 24.5307 52.5096 24.1533 51.928 23.9553C51.3463 23.7449 50.4244 23.6397 49.1622 23.6397H48.0484V35H42.5539ZM48.0484 19.2961H52.1136C54.7495 19.2961 56.3953 19.1847 57.0512 18.962C57.7071 18.7392 58.2207 18.3556 58.5919 17.8111C58.9632 17.2666 59.1488 16.586 59.1488 15.7692C59.1488 14.8535 58.9013 14.1172 58.4063 13.5603C57.9237 12.9911 57.2368 12.6322 56.3458 12.4837C55.9003 12.4218 54.5638 12.3909 52.3363 12.3909H48.0484V19.2961ZM70.0264 7.78737H80.904C83.0573 7.78737 84.6598 7.88019 85.7117 8.06581C86.776 8.23906 87.7227 8.61031 88.5518 9.17956C89.3933 9.74881 90.0925 10.5099 90.6493 11.4627C91.2062 12.4032 91.4847 13.4613 91.4847 14.6369C91.4847 15.9116 91.1382 17.081 90.4452 18.1452C89.7645 19.2095 88.8364 20.0077 87.6608 20.5398C89.319 21.0224 90.5937 21.8454 91.4847 23.0086C92.3757 24.1719 92.8212 25.5393 92.8212 27.1109C92.8212 28.3484 92.5303 29.555 91.9487 30.7306C91.3795 31.8939 90.5937 32.8282 89.5913 33.5336C88.6013 34.2266 87.3762 34.6535 85.9159 34.8144C85.0002 34.9134 82.7912 34.9752 79.2891 35H70.0264V7.78737ZM75.5209 12.3166V18.6093H79.122C81.2629 18.6093 82.5932 18.5784 83.113 18.5165C84.0535 18.4051 84.7898 18.0834 85.3219 17.5512C85.8664 17.0067 86.1387 16.2952 86.1387 15.4166C86.1387 14.5751 85.9035 13.8944 85.4333 13.3747C84.9754 12.8426 84.2886 12.5208 83.3728 12.4094C82.8283 12.3476 81.2629 12.3166 78.6765 12.3166H75.5209ZM75.5209 23.1386V30.4151H80.607C82.587 30.4151 83.8431 30.3594 84.3752 30.248C85.192 30.0995 85.854 29.7406 86.3614 29.1714C86.8812 28.5897 87.141 27.8163 87.141 26.8511C87.141 26.0343 86.9368 25.3413 86.5284 24.7721C86.1201 24.1905 85.5384 23.7759 84.7836 23.5284C84.0411 23.2685 82.4138 23.1386 79.9017 23.1386H75.5209Z" fill="#1F4CB1"/>
    <path d="M97.3133 35V7.78737H102.808V35H97.3133ZM114.187 35V12.3909H106.112V7.78737H127.737V12.3909H119.681V35H114.187Z" fill="#C1C7CD"/>
    <path d="M21.8445 34.1397C29.235 34.1397 35.2262 28.1486 35.2262 20.7581C35.2262 13.3676 29.235 7.37646 21.8445 7.37646C14.4541 7.37646 8.46289 13.3676 8.46289 20.7581C8.46289 28.1486 14.4541 34.1397 21.8445 34.1397Z" stroke="#1F4CB1" strokeWidth="5.57568"/>
    <path d="M23.9016 26.1807C33.5021 20.6379 39.8257 13.6171 38.0257 10.4994C36.2257 7.3817 26.9838 9.34768 17.3833 14.8905C7.78275 20.4334 1.45919 27.4542 3.2592 30.5718C5.0592 33.6895 14.3011 31.7236 23.9016 26.1807Z" stroke="#C1C7CD" strokeWidth="2.67633" strokeLinecap="round"/>
    <path d="M33.3821 13.9751C31.0555 10.0262 26.7595 7.37646 21.8445 7.37646C14.4541 7.37646 8.46289 13.3676 8.46289 20.7581C8.46289 22.7016 8.87723 24.5484 9.6224 26.2149" stroke="#1F4CB1" strokeWidth="5.57568"/>
  </svg>
);

// Hologram Panel Component - animated blue gradient panel
const HologramPanel = ({ isLogin }: { isLogin: boolean }) => {
  return (
    <div 
      className={cn(
        "absolute inset-0 flex items-center justify-center overflow-hidden rounded-[48px] transition-all duration-700 ease-in-out",
        isLogin ? "translate-x-0" : "translate-x-full"
      )}
      style={{
        background: 'linear-gradient(135deg, #60A5FA 0%, #818CF8 30%, #A78BFA 50%, #60A5FA 70%, #3B82F6 100%)',
        backgroundSize: '200% 200%',
        animation: 'hologramShift 8s ease-in-out infinite',
      }}
    >
      {/* Animated scan lines */}
      <div className="absolute inset-0 opacity-20">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute h-px w-full bg-white/40"
            style={{
              top: `${i * 5}%`,
              animation: `scanLine 3s linear infinite`,
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>

      {/* Glowing orbs */}
      <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-purple-400/20 blur-3xl" />

      {/* Floating UI Elements */}
      <div className="relative z-10 p-8">
        {/* Chat bubble */}
        <div 
          className="absolute -left-8 top-0 rounded-2xl bg-white/20 p-4 backdrop-blur-sm"
          style={{ animation: 'float 4s ease-in-out infinite' }}
        >
          <div className="flex gap-1">
            <div className="h-2 w-2 rounded-full bg-white/60" />
            <div className="h-2 w-2 rounded-full bg-white/60" />
            <div className="h-2 w-2 rounded-full bg-white/60" />
          </div>
        </div>

        {/* Video player card */}
        <div 
          className="relative rounded-2xl bg-white/15 p-6 shadow-2xl backdrop-blur-sm"
          style={{ animation: 'float 5s ease-in-out infinite reverse' }}
        >
          <div className="flex items-center gap-4">
            <div className="h-3 w-20 rounded bg-white/40" />
            <div className="h-3 w-12 rounded bg-white/30" />
          </div>
          <div className="mt-4 flex h-24 w-40 items-center justify-center rounded-lg bg-white/10">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/30">
              <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Checkmark badge */}
        <div 
          className="absolute -right-4 bottom-8 flex h-10 w-10 items-center justify-center rounded-full bg-white/25 backdrop-blur-sm"
          style={{ animation: 'pulse 2s ease-in-out infinite' }}
        >
          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Decorative circles */}
        <div className="absolute -right-16 top-1/4 h-20 w-20 rounded-full border-2 border-white/20" />
        <div className="absolute -left-12 bottom-1/4 h-16 w-16 rounded-full border-2 border-white/15" />
        <div className="absolute right-8 top-8 h-8 w-8 rounded-full bg-purple-300/30" />
      </div>

      {/* Content */}
      <div className="absolute bottom-16 left-0 right-0 text-center">
        <h2 className="text-2xl font-normal text-white">
          {isLogin ? 'Welcome Back' : 'Join the BIM Revolution'}
        </h2>
        <p className="mt-2 text-sm text-white/80">
          {isLogin 
            ? 'Sign in to continue your journey'
            : 'Get started with ORBIT and transform how your team collaborates on construction projects'
          }
        </p>
      </div>
    </div>
  );
};

export default function AuthForm({ mode }: AuthFormProps) {
  const [currentMode, setCurrentMode] = useState<'login' | 'register'>(mode);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const isRegister = currentMode === 'register';
  
  // Form state
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Handle mode switch with animation
  const handleModeSwitch = useCallback((newMode: 'login' | 'register') => {
    if (newMode === currentMode || isTransitioning) return;
    
    setIsTransitioning(true);
    
    // Reset form
    setFormData({ fullName: '', email: '', password: '', confirmPassword: '' });
    setErrors({});
    setTouched({});
    setAgreedToTerms(false);
    
    // Delay mode switch for smooth animation
    setTimeout(() => {
      setCurrentMode(newMode);
      // Update URL without reload
      window.history.pushState({}, '', newMode === 'login' ? '/login' : '/register');
    }, 100);
    
    setTimeout(() => {
      setIsTransitioning(false);
    }, 700);
  }, [currentMode, isTransitioning]);

  // Sync with URL on mount
  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/login' && currentMode !== 'login') {
      setCurrentMode('login');
    } else if (path === '/register' && currentMode !== 'register') {
      setCurrentMode('register');
    }
  }, []);

  // Handle input changes
  const handleChange = useCallback((field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [errors]);

  // Handle blur for validation
  const handleBlur = useCallback((field: keyof FormData) => () => {
    setTouched(prev => ({ ...prev, [field]: true }));
    
    let error: string | null = null;
    switch (field) {
      case 'fullName':
        if (isRegister) error = validators.fullName(formData.fullName || '');
        break;
      case 'email':
        error = validators.email(formData.email);
        break;
      case 'password':
        error = validators.password(formData.password, isRegister);
        break;
      case 'confirmPassword':
        if (isRegister) error = validators.confirmPassword(formData.password, formData.confirmPassword || '');
        break;
    }
    
    if (error) {
      setErrors(prev => ({ ...prev, [field]: error }));
    }
  }, [formData, isRegister]);

  // Validate all fields
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    
    if (isRegister) {
      const fullNameError = validators.fullName(formData.fullName || '');
      if (fullNameError) newErrors.fullName = fullNameError;
    }
    
    const emailError = validators.email(formData.email);
    if (emailError) newErrors.email = emailError;
    
    const passwordError = validators.password(formData.password, isRegister);
    if (passwordError) newErrors.password = passwordError;
    
    if (isRegister) {
      const confirmError = validators.confirmPassword(formData.password, formData.confirmPassword || '');
      if (confirmError) newErrors.confirmPassword = confirmError;
      
      if (!agreedToTerms) {
        newErrors.terms = 'You must agree to the terms and privacy policy';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    setErrors({});
    
    try {
      let data;
      if (isRegister) {
        data = await register({
          fullName: formData.fullName!,
          email: formData.email,
          password: formData.password,
          confirmPassword: formData.confirmPassword!,
          agree: agreedToTerms,
        });
      } else {
        data = await login(formData.email, formData.password);
      }

      localStorage.setItem('orbit_user', JSON.stringify(data.data));
      window.location.href = '/home';
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred. Please try again.';
      setErrors({ general: message });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Google sign-in — redirect đến backend OAuth (dùng PUBLIC_API_URL từ .env)
  const handleGoogleSignIn = () => {
    window.location.href = apiUrl('/auth/google');
  };

  const passwordStrength = isRegister ? getPasswordStrength(formData.password) : null;

  // Inject CSS animations on mount
  useEffect(() => {
    const styleId = 'auth-form-animations';
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
      
      @keyframes pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.8; }
      }
      
      @keyframes slideInLeft {
        from { opacity: 0; transform: translateX(-20px); }
        to { opacity: 1; transform: translateX(0); }
      }
      
      @keyframes slideInRight {
        from { opacity: 0; transform: translateX(20px); }
        to { opacity: 1; transform: translateX(0); }
      }
      
      .form-enter {
        animation: slideInLeft 0.5s ease-out forwards;
      }
      
      .form-enter-right {
        animation: slideInRight 0.5s ease-out forwards;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) existingStyle.remove();
    };
  }, []);
  
  return (
    <div className="min-h-screen bg-white">

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#F9FAFB] bg-white px-4 sm:px-6 lg:px-[205px]">
        <div className="mx-auto flex h-16 max-w-[1292px] items-center justify-between">
          <a href="/" className="flex items-center">
            <OrbitLogo />
          </a>
          
          <nav className="hidden items-center gap-8 md:flex">
            <a href="/#features" className="text-sm text-[#616874] hover:text-[#111827]">Features</a>
            <a href="/#solutions" className="text-sm text-[#616874] hover:text-[#111827]">Solutions</a>
            <a href="/#pricing" className="text-sm text-[#616874] hover:text-[#111827]">Pricing</a>
          </nav>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => handleModeSwitch('login')}
              className={cn(
                "px-4 py-2 text-sm font-normal transition-colors",
                currentMode === 'login' ? "text-[#2563EB]" : "text-[#616874] hover:text-[#111827]"
              )}
            >
              Log in
            </button>
            <button 
              onClick={() => handleModeSwitch('register')}
              className="flex items-center gap-2 rounded-[10px] bg-[#2563EB] px-4 py-2 text-sm font-normal text-white transition-colors hover:bg-[#1D4ED8]"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.67}>
                <path d="M12 5v14M5 12h14" />
              </svg>
              Get started free
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative min-h-[calc(100vh-65px)] overflow-hidden">
        {/* Background decorations */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* Top-left purple blob */}
          <div className="absolute -left-40 -top-40 h-96 w-96 rounded-[230px_154px_154px_230px] bg-[#FAF5FF] opacity-90" />
          {/* Bottom-right blue blob */}
          <div className="absolute -bottom-60 -right-40 h-[500px] w-[500px] rounded-[200px_300px_300px_200px] bg-[#DBEAFE] opacity-60" />
          {/* Pink blob */}
          <div className="absolute right-[30%] top-[60%] h-64 w-64 rounded-[128px_128px_77px_179px] bg-[#FB64B6]/20 opacity-90" />
          
          {/* Sparkles */}
          <SparkleIcon className="absolute left-[10%] top-[30%] h-12 w-12 text-[#C084FC]" />
          <SparkleIcon className="absolute bottom-[20%] right-[8%] h-16 w-16 text-[#C084FC]" />
          
          {/* Small decorative dots */}
          <div className="absolute left-[25%] top-[10%] h-3 w-3 rounded-full bg-white/40" />
          <div className="absolute left-[35%] top-[20%] h-2 w-2 rounded-full bg-[#8EC5FF]/60" />
          <div className="absolute bottom-[15%] right-[40%] h-4 w-4 rounded-full bg-[#FDA5D5]/50" />
          <div className="absolute bottom-[30%] left-[25%] h-3 w-3 rounded-full bg-white/30" />
          
          {/* Circle outlines */}
          <div className="absolute right-[35%] top-[40%] h-12 w-12 rounded-full border-2 border-white/20" />
          <div className="absolute bottom-[40%] left-[35%] h-8 w-8 rounded-full border-2 border-[#FDA5D5]/30" />
        </div>

        {/* Content Container */}
        <div className="relative z-10 flex min-h-[calc(100vh-65px)] items-center justify-center px-4 py-12">
          {/* Auth Card Container */}
          <div className="relative h-[772px] w-full max-w-[1152px] overflow-hidden rounded-[48px] bg-white shadow-2xl">
            {/* Form Section */}
            <div 
              className={cn(
                "absolute inset-y-0 z-10 flex w-1/2 flex-col justify-center bg-white px-12 transition-all duration-700 ease-in-out",
                isRegister ? "right-0" : "left-0"
              )}
            >
              <div className={cn(isTransitioning ? "opacity-0" : "opacity-100", "transition-opacity duration-300")}>
                {/* Back button */}
                <a 
                  href="/" 
                  className="mb-8 flex w-fit items-center gap-2 text-sm text-[#616874] hover:text-[#111827]"
                >
                  <BackIcon />
                  Back
                </a>

                {/* Title */}
                <h1 className="text-[36px] font-normal leading-[40px] text-[#111827]">
                  {isRegister ? 'Create your account' : 'Welcome back'}
                </h1>

                {errors.general && (
                  <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                    {errors.general}
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                  {/* Full Name (Register only) */}
                  {isRegister && (
                    <div>
                      <label className="block text-sm text-[#111827]">
                        Full name <span className="text-[#EF4444]">*</span>
                      </label>
                      <div className="relative mt-2">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                          <UserIcon />
                        </div>
                        <input
                          type="text"
                          value={formData.fullName}
                          onChange={handleChange('fullName')}
                          onBlur={handleBlur('fullName')}
                          placeholder="Enter username"
                          className={cn(
                            "w-full rounded-[14px] border py-4 pl-12 pr-4 text-base transition-colors",
                            "placeholder:text-[#616874] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]",
                            errors.fullName && touched.fullName
                              ? "border-red-300 bg-red-50"
                              : "border-[#E5E7EB] bg-white"
                          )}
                        />
                      </div>
                      {errors.fullName && touched.fullName && (
                        <p className="mt-1 text-xs text-red-500">{errors.fullName}</p>
                      )}
                    </div>
                  )}

                  {/* Email */}
                  <div>
                    <label className="block text-sm text-[#111827]">
                      Email <span className="text-[#EF4444]">*</span>
                    </label>
                    <div className="relative mt-2">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                        <EmailIcon />
                      </div>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={handleChange('email')}
                        onBlur={handleBlur('email')}
                        placeholder="Enter email"
                        className={cn(
                          "w-full rounded-[14px] border py-4 pl-12 pr-4 text-base transition-colors",
                          "placeholder:text-[#616874] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]",
                          errors.email && touched.email
                            ? "border-red-300 bg-red-50"
                            : "border-[#E5E7EB] bg-white"
                        )}
                      />
                    </div>
                    {errors.email && touched.email && (
                      <p className="mt-1 text-xs text-red-500">{errors.email}</p>
                    )}
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-sm text-[#111827]">
                      Password <span className="text-[#EF4444]">*</span>
                    </label>
                    <div className="relative mt-2">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                        <LockIcon />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={handleChange('password')}
                        onBlur={handleBlur('password')}
                        placeholder="Enter password"
                        className={cn(
                          "w-full rounded-[14px] border py-4 pl-12 pr-12 text-base transition-colors",
                          "placeholder:text-[#616874] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]",
                          errors.password && touched.password
                            ? "border-red-300 bg-red-50"
                            : "border-[#E5E7EB] bg-white"
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-4 text-[#616874] hover:text-[#111827]"
                      >
                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                    {errors.password && touched.password && (
                      <p className="mt-1 text-xs text-red-500">{errors.password}</p>
                    )}
                    
                    {/* Password strength indicator (register only) */}
                    {isRegister && formData.password && (
                      <div className="mt-2">
                        <div className="flex gap-1">
                          {[...Array(6)].map((_, i) => (
                            <div
                              key={i}
                              className={cn(
                                "h-1 flex-1 rounded-full transition-colors",
                                i < passwordStrength!.score ? passwordStrength!.color : "bg-gray-200"
                              )}
                            />
                          ))}
                        </div>
                        <p className="mt-1 text-xs text-gray-500">{passwordStrength!.label}</p>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password (Register only) */}
                  {isRegister && (
                    <div>
                      <label className="block text-sm text-[#111827]">
                        Confirm password <span className="text-[#EF4444]">*</span>
                      </label>
                      <div className="relative mt-2">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                          <LockIcon />
                        </div>
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={formData.confirmPassword}
                          onChange={handleChange('confirmPassword')}
                          onBlur={handleBlur('confirmPassword')}
                          placeholder="Confirm your password"
                          className={cn(
                            "w-full rounded-[14px] border py-4 pl-12 pr-12 text-base transition-colors",
                            "placeholder:text-[#616874] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]",
                            errors.confirmPassword && touched.confirmPassword
                              ? "border-red-300 bg-red-50"
                              : "border-[#E5E7EB] bg-white"
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute inset-y-0 right-0 flex items-center pr-4 text-[#616874] hover:text-[#111827]"
                        >
                          {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                        </button>
                      </div>
                      {errors.confirmPassword && touched.confirmPassword && (
                        <p className="mt-1 text-xs text-red-500">{errors.confirmPassword}</p>
                      )}
                    </div>
                  )}

                  {/* Forgot password link (Login only) */}
                  {!isRegister && (
                    <div className="flex justify-end">
                      <a href="/forgot-password" className="text-sm text-[#9810FA] hover:underline">
                        Forgot password
                      </a>
                    </div>
                  )}

                  {/* Terms checkbox (Register only) */}
                  {isRegister && (
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="terms"
                        checked={agreedToTerms}
                        onChange={(e) => {
                          setAgreedToTerms(e.target.checked);
                          if (errors.terms) setErrors(prev => ({ ...prev, terms: undefined }));
                        }}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-[#2563EB] focus:ring-[#2563EB]"
                      />
                      <label htmlFor="terms" className="text-sm text-[#616874]">
                        I agree to the{' '}
                        <a href="#" className="text-[#2563EB] hover:underline">terms of service</a>
                        {' '}and{' '}
                        <a href="#" className="text-[#2563EB] hover:underline">privacy policy</a>
                      </label>
                    </div>
                  )}
                  {errors.terms && (
                    <p className="text-xs text-red-500">{errors.terms}</p>
                  )}

                  {/* Google Sign In */}
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="flex w-full items-center justify-center gap-3 rounded-[10px] bg-[#F3F4F6] py-4 text-base text-[#616874] transition-colors hover:bg-[#E5E7EB] disabled:opacity-50"
                  >
                    <GoogleIcon />
                    Continue with Google
                  </button>

                  {/* Switch mode link */}
                  <div className="text-center text-sm text-[#616874]">
                    {isRegister ? (
                      <>
                        Already have an account?{' '}
                        <button
                          type="button"
                          onClick={() => handleModeSwitch('login')}
                          className="text-[#2563EB] hover:underline"
                        >
                          Log in
                        </button>
                      </>
                    ) : (
                      <>
                        Don't have an account?{' '}
                        <button
                          type="button"
                          onClick={() => handleModeSwitch('register')}
                          className="text-[#2563EB] hover:underline"
                        >
                          Sign up
                        </button>
                      </>
                    )}
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#2563EB] py-4 text-base font-normal text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-50"
                  >
                    {isLoading ? (
                      <LoadingSpinner />
                    ) : (
                      isRegister ? 'Create account' : 'Log in'
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* Hologram Panel */}
            <div 
              className={cn(
                "absolute inset-y-0 w-1/2 transition-all duration-700 ease-in-out",
                isRegister ? "left-0" : "right-0"
              )}
            >
              <div 
                className="h-full w-full overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #60A5FA 0%, #818CF8 30%, #A78BFA 50%, #60A5FA 70%, #3B82F6 100%)',
                  backgroundSize: '200% 200%',
                  animation: 'hologramShift 8s ease-in-out infinite',
                }}
              >
                {/* Animated scan lines */}
                <div className="absolute inset-0 opacity-10">
                  {[...Array(15)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute h-px w-full bg-white"
                      style={{
                        top: `${i * 7}%`,
                        animation: `scanLine 4s linear infinite`,
                        animationDelay: `${i * 0.2}s`,
                      }}
                    />
                  ))}
                </div>

                {/* Glowing orbs */}
                <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
                <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-purple-400/20 blur-3xl" />

                {/* Floating UI Elements */}
                <div className="relative flex h-full flex-col items-center justify-center p-12">
                  {/* Top decorative elements */}
                  <div 
                    className="absolute left-12 top-24 rounded-full bg-white/15 p-4"
                    style={{ animation: 'float 5s ease-in-out infinite' }}
                  >
                    <div className="h-12 w-12 rounded-full border-2 border-white/30" />
                  </div>

                  <div 
                    className="absolute right-16 top-20 rounded-2xl bg-white/10 px-4 py-2"
                    style={{ animation: 'float 4s ease-in-out infinite reverse' }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-white/60" />
                      <div className="h-2 w-2 rounded-full bg-white/60" />
                      <div className="h-2 w-2 rounded-full bg-white/60" />
                    </div>
                  </div>

                  {/* Central card */}
                  <div 
                    className="relative rounded-2xl bg-white/15 p-6 shadow-2xl backdrop-blur-sm"
                    style={{ animation: 'float 6s ease-in-out infinite' }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-16 rounded bg-white/40" />
                      <div className="h-3 w-10 rounded bg-white/30" />
                    </div>
                    <div className="mt-4 flex h-32 w-48 items-center justify-center rounded-xl bg-white/10">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/25">
                        <svg className="h-7 w-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Checkmark badge */}
                  <div 
                    className="absolute bottom-40 right-20 flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm"
                    style={{ animation: 'pulse 2s ease-in-out infinite' }}
                  >
                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </div>

                  {/* Decorative circles */}
                  <div className="absolute bottom-32 left-16 h-20 w-20 rounded-full border-2 border-white/20" />
                  <div className="absolute right-8 top-1/3 h-6 w-6 rounded-full bg-[#DDA0DD]/40" />

                  {/* Content text */}
                  <div className="absolute bottom-20 left-0 right-0 text-center">
                    <h2 className="text-2xl font-normal text-white">
                      {isRegister ? 'Join the BIM Revolution' : 'Welcome Back'}
                    </h2>
                    <p className="mx-auto mt-3 max-w-xs text-sm text-white/80">
                      {isRegister 
                        ? 'Get started with ORBIT and transform how your team collaborates on construction projects'
                        : 'Sign in to continue your journey with ORBIT'
                      }
                    </p>
                  </div>

                  {/* Sparkle decorations */}
                  <div className="absolute right-8 top-12 text-white/30">+</div>
                  <div className="absolute bottom-16 left-12 text-white/20">+</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E5E7EB] bg-[#F9FAFB] px-4 py-8 sm:px-6 lg:px-[205px]">
        <div className="mx-auto max-w-[1292px]">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <OrbitLogo />
              <p className="mt-4 text-sm text-[#616874]">
                Modern BIM collaboration platform
                <br />
                for construction teams.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium text-[#111827]">Product</h4>
              <ul className="mt-4 space-y-2">
                <li><a href="#" className="text-sm text-[#616874] hover:text-[#111827]">Features</a></li>
                <li><a href="#" className="text-sm text-[#616874] hover:text-[#111827]">Pricing</a></li>
                <li><a href="#" className="text-sm text-[#616874] hover:text-[#111827]">Enterprise</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-[#111827]">Company</h4>
              <ul className="mt-4 space-y-2">
                <li><a href="#" className="text-sm text-[#616874] hover:text-[#111827]">About</a></li>
                <li><a href="#" className="text-sm text-[#616874] hover:text-[#111827]">Careers</a></li>
                <li><a href="#" className="text-sm text-[#616874] hover:text-[#111827]">Contact</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-[#111827]">Resources</h4>
              <ul className="mt-4 space-y-2">
                <li><a href="#" className="text-sm text-[#616874] hover:text-[#111827]">Documentation</a></li>
                <li><a href="#" className="text-sm text-[#616874] hover:text-[#111827]">API</a></li>
                <li><a href="#" className="text-sm text-[#616874] hover:text-[#111827]">Support</a></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-[#E5E7EB] pt-8 md:flex-row">
            <p className="text-sm text-[#616874]">© 2024 ORBIT. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="#" className="text-sm text-[#616874] hover:text-[#111827]">Privacy</a>
              <a href="#" className="text-sm text-[#616874] hover:text-[#111827]">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
