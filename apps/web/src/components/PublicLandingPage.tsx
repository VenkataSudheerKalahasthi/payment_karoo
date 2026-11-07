import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Lock,
  FileCheck2,
  Scale,
  DollarSign,
  ChevronDown,
  Server,
  Database,
  CheckCircle2,
  Menu,
  X,
  Send,
  Sparkles,
} from 'lucide-react';
import { useClerk } from '@clerk/clerk-react';
import { ThemeToggle } from './ThemeToggle';
import { TrustPayLogo } from './TrustPayLogo';
import { RoleSelectionModal } from './RoleSelectionModal';
import { SystemHealthStatus, DatabaseHealthStatus } from '@trustpay/shared';

interface PublicLandingPageProps {
  apiHealth: SystemHealthStatus | null;
  dbHealth: DatabaseHealthStatus | null;
  isSignedIn?: boolean;
  onGoToDashboard?: () => void;
}

export const PublicLandingPage: React.FC<PublicLandingPageProps> = ({
  apiHealth,
  dbHealth,
  isSignedIn = false,
  onGoToDashboard,
}) => {
  const clerk = useClerk();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSubmitted, setContactSubmitted] = useState(false);

  // Role Selection Modal for Registration & Login
  const [authRoleModalOpen, setAuthRoleModalOpen] = useState(false);
  const [authActionType, setAuthActionType] = useState<'register' | 'login'>('register');

  // Floating Pill Navbar Navigation State
  const shouldReduceMotion = useReducedMotion();
  const [activeNav, setActiveNav] = useState('home');
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  const navItems = [
    { id: 'home', label: 'Home', href: '#' },
    { id: 'about', label: 'About', href: '#about' },
    { id: 'features', label: 'Features', href: '#features' },
    { id: 'contact', label: 'Contacts', href: '#contact' },
    { id: 'security', label: 'Security', href: '#security' },
  ];

  const springTransition = shouldReduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 380, damping: 30 };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);

      // Scroll Spy for active section
      const sections = ['contact', 'security', 'about', 'features'];
      const scrollPosition = window.scrollY + 200;

      let current = 'home';
      for (const sectionId of sections) {
        const el = document.getElementById(sectionId);
        if (el && scrollPosition >= el.offsetTop) {
          current = sectionId;
          break;
        }
      }
      setActiveNav(current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setActiveNav(id);
    if (id === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      history.replaceState(null, '', ' ');
    } else {
      const el = document.getElementById(id);
      if (el) {
        const navOffset = 90;
        const elementPosition = el.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - navOffset;
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth',
        });
        history.replaceState(null, '', `#${id}`);
      }
    }
  };

  const openAuthWithRolePrompt = (action: 'register' | 'login') => {
    setAuthActionType(action);
    setAuthRoleModalOpen(true);
    setMobileMenuOpen(false);
  };

  const handleRoleSelectedForAuth = (role: 'CLIENT' | 'WORKER') => {
    try {
      localStorage.setItem('trustpay_selected_role', role);
    } catch (e) {
      console.warn('Could not save role intent to localStorage', e);
    }
    setAuthRoleModalOpen(false);

    if (authActionType === 'register') {
      clerk.openSignUp();
    } else {
      clerk.openSignIn();
    }
  };

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactEmail.trim() || !contactMessage.trim()) return;
    setContactSubmitted(true);
    setTimeout(() => {
      setContactName('');
      setContactEmail('');
      setContactMessage('');
    }, 1500);
  };

  const faqItems = [
    {
      q: 'How does TrustPay ensure financial isolation and escrow protection?',
      a: 'All project milestone funds are deposited into isolated cryptographic escrow allocations before specialists begin development. Funds cannot be unilaterally withdrawn by either party. Release occurs strictly upon bilateral milestone review or binding arbitration.',
    },
    {
      q: 'Are digital contract agreements legally binding?',
      a: 'Yes. Every contract version generates a deterministic SHA-256 canonical hash signed bilaterally by both client and specialist through audited identity authentication, creating an immutable cryptographic audit trail.',
    },
    {
      q: 'How does the milestone review and deliverable workflow work?',
      a: 'Specialists submit code, pull request references, or deliverable documents directly against designated milestone deliverables. Clients inspect the submission and either authorize instant fund settlement or request specific contractual revisions.',
    },
    {
      q: 'What occurs if a disagreement arises between client and specialist?',
      a: 'Either party may initiate a structured dispute. An immediate protective hold locks remaining escrow funds while parties submit written evidence. If mutual settlement cannot be reached, platform arbitration provides a binding legal ruling.',
    },
    {
      q: 'Are there any hidden fees or variable commission charges?',
      a: 'No. TrustPay maintains total double-entry ledger transparency. The platform fee is clearly broken down prior to contract execution, and transaction activity is recorded in verifiable double-entry journals.',
    },
    {
      q: 'How do specialists receive their earnings?',
      a: 'Once a milestone is approved, funds credit immediately to the specialist’s TrustPay wallet and become available for rapid settlement through configured banking rails.',
    },
  ];

  return (
    <div className="min-h-screen dark:bg-[#0B0D14] bg-[#F8FAFC] dark:text-[#E8EAE6] text-[#242424] dark:selection:bg-[#1F61EF] selection:bg-[#5046E5] selection:text-white dark:selection:text-white relative overflow-hidden transition-colors duration-300">
      {/* Ambient Lighting Gradients */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#6366F1]/10 dark:bg-[#1C2740] rounded-full blur-[140px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute top-1/4 right-0 w-[450px] h-[450px] bg-[#6366F1]/5 dark:bg-[#1C2740] rounded-full blur-[130px] pointer-events-none translate-x-1/3" />

      {/* 1. ANIMATED FLOATING PILL NAVBAR */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'dark:bg-[#0B0D14]/85 bg-[#F8FAFC]/85 backdrop-blur-md border-b dark:border-[#272B38]/60 border-slate-200/60 shadow-sm'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Edge Left: Brand Logo (Emblem Only for Clean Navbar) */}
          <div className="flex items-center flex-1">
            <div
              className="flex items-center cursor-pointer transition-transform duration-200 hover:scale-105"
              onClick={() => {
                setActiveNav('home');
                window.scrollTo({ top: 0, behavior: 'smooth' });
                history.replaceState(null, '', ' ');
              }}
              aria-label="TrustPay Home"
            >
              <TrustPayLogo size="md" iconOnly={true} />
            </div>
          </div>

          {/* Center: Animated Floating Pill Navbar (Matching Video Reference) */}
          <div className="hidden md:flex items-center justify-center flex-shrink-0">
            <nav
              className="flex items-center p-1.5 rounded-full border dark:border-[#272B38] border-slate-200/90 dark:bg-[#191B25]/85 bg-white/85 backdrop-blur-xl dark:shadow-[0_8px_32px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.08)] shadow-[0_8px_30px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.85)] relative transition-all duration-300 ring-1 ring-black/5 dark:ring-white/5"
              onMouseLeave={() => setHoveredNav(null)}
              role="navigation"
              aria-label="Main Navigation"
            >
              {navItems.map((item) => {
                const isActive = activeNav === item.id;
                const isHovered = hoveredNav === item.id;

                return (
                  <a
                    key={item.id}
                    href={item.href}
                    onClick={(e) => handleNavClick(e, item.id)}
                    onMouseEnter={() => setHoveredNav(item.id)}
                    className="relative px-4 py-1.5 text-xs sm:text-sm font-medium transition-colors duration-200 cursor-pointer rounded-full select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F61EF] z-0"
                  >
                    {/* Active Raised Pill Indicator */}
                    {isActive && (
                      <motion.span
                        layoutId="navbar-active-pill"
                        className="absolute inset-0 rounded-full dark:bg-[#1F61EF] bg-[#5046E5] shadow-sm dark:shadow-[0_2px_14px_rgba(31,97,239,0.5)] shadow-[#5046E5]/30 -z-10"
                        transition={springTransition}
                      />
                    )}

                    {/* Hover Highlight Indicator */}
                    {!isActive && isHovered && (
                      <motion.span
                        layoutId="navbar-hover-pill"
                        className="absolute inset-0 rounded-full dark:bg-white/[0.08] bg-slate-200/60 -z-10"
                        transition={springTransition}
                      />
                    )}

                    {/* Label */}
                    <span
                      className={`relative z-10 transition-colors duration-200 ${
                        isActive
                          ? 'text-white font-semibold'
                          : 'dark:text-[#9AA4B8] text-[#475569] dark:hover:text-[#E8ECF5] hover:text-[#0F172A]'
                      }`}
                    >
                      {item.label}
                    </span>
                  </a>
                );
              })}
            </nav>
          </div>

          {/* Edge Right: Theme Toggle (Symbols Only) + Sign in / Dashboard + Get Started */}
          <div className="hidden sm:flex items-center justify-end flex-1 space-x-3">
            {/* Symbol-only theme toggle */}
            <ThemeToggle />

            {isSignedIn && onGoToDashboard ? (
              <button
                onClick={onGoToDashboard}
                className="px-5 py-2 rounded-full dark:bg-[#1F61EF] dark:hover:bg-[#174EC4] dark:text-white bg-[#5046E5] hover:bg-[#4338CA] text-white text-xs font-bold transition-all duration-300 dark:shadow-[0_0_20px_rgba(31,97,239,0.3)] shadow-md shadow-[#5046E5]/25 flex items-center space-x-1.5 active:scale-95 cursor-pointer"
              >
                <span>Go to Dashboard</span>
                <span className="text-sm">↗</span>
              </button>
            ) : (
              <>
                {/* Sign in Pill Button */}
                <button
                  onClick={() => openAuthWithRolePrompt('login')}
                  className="px-5 py-2 rounded-full text-xs font-semibold dark:text-[#E8EAE6] text-[#334155] dark:bg-white/5 bg-white hover:dark:bg-white/10 hover:bg-[#F1F5F9] border dark:border-[#272B38] border-slate-200 transition-all cursor-pointer backdrop-blur-sm shadow-sm active:scale-95"
                >
                  Sign in
                </button>

                {/* Get Started Pill Button */}
                <button
                  onClick={() => openAuthWithRolePrompt('register')}
                  className="px-5 py-2 rounded-full dark:bg-[#1F61EF] dark:hover:bg-[#174EC4] dark:text-white bg-[#5046E5] hover:bg-[#4338CA] text-white text-xs font-bold transition-all duration-300 dark:shadow-[0_0_20px_rgba(31,97,239,0.2)] shadow-md shadow-[#5046E5]/25 hover:shadow-lg hover:shadow-[#5046E5]/35 flex items-center space-x-1.5 active:scale-95 cursor-pointer"
                >
                  <span>Get Started</span>
                  <span className="text-sm">↗</span>
                </button>
              </>
            )}
          </div>

          {/* Mobile Actions */}
          <div className="md:hidden flex items-center space-x-2">
            <ThemeToggle />
            {isSignedIn && onGoToDashboard ? (
              <button
                onClick={onGoToDashboard}
                className="px-3.5 py-1.5 rounded-full dark:bg-[#1F61EF] dark:text-white bg-[#5046E5] text-white text-xs font-bold shadow-sm"
              >
                Dashboard
              </button>
            ) : (
              <button
                onClick={() => openAuthWithRolePrompt('register')}
                className="px-3.5 py-1.5 rounded-full dark:bg-[#1F61EF] dark:text-white bg-[#5046E5] text-white text-xs font-bold shadow-sm"
              >
                Get Started
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-full dark:bg-white/5 bg-slate-100 dark:text-[#E8EAE6] text-slate-700 border dark:border-[#272B38] border-slate-200 transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-current" /> : <Menu className="w-5 h-5 text-current" />}
            </button>
          </div>
        </div>

        {/* Mobile Animated Dropdown Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="md:hidden mx-4 my-2 p-4 rounded-2xl dark:bg-[#191B25]/95 bg-white/95 backdrop-blur-xl border dark:border-[#272B38] border-slate-200 shadow-xl space-y-2 text-sm"
            >
              {navItems.map((item) => {
                const isActive = activeNav === item.id;
                return (
                  <a
                    key={item.id}
                    href={item.href}
                    onClick={(e) => {
                      handleNavClick(e, item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`block px-4 py-2.5 rounded-xl font-medium transition-all ${
                      isActive
                        ? 'dark:bg-[#1F61EF] bg-[#5046E5] text-white font-semibold shadow-sm'
                        : 'dark:text-[#E8ECF5] text-slate-700 hover:dark:bg-white/5 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </a>
                );
              })}

              <div className="pt-3 border-t dark:border-[#272B38] border-slate-200">
                {isSignedIn && onGoToDashboard ? (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onGoToDashboard();
                    }}
                    className="w-full py-2.5 rounded-full dark:bg-[#1F61EF] dark:text-white bg-[#5046E5] text-white text-xs font-bold shadow-md"
                  >
                    Go to Dashboard ↗
                  </button>
                ) : (
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => openAuthWithRolePrompt('login')}
                      className="flex-1 py-2.5 rounded-full dark:bg-white/5 bg-slate-100 text-xs font-semibold dark:text-[#E8EAE6] text-slate-800 border dark:border-[#272B38] border-slate-200"
                    >
                      Sign in
                    </button>
                    <button
                      onClick={() => openAuthWithRolePrompt('register')}
                      className="flex-1 py-2.5 rounded-full dark:bg-[#1F61EF] dark:text-white bg-[#5046E5] text-white text-xs font-bold"
                    >
                      Get Started
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* 2. CINEMATIC HERO SECTION (MATCHING REFERENCE IMAGE) */}
      <section className="relative pt-12 pb-16 lg:pt-20 lg:pb-24 text-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Top Pill Badge */}
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full dark:bg-[#191B25]/90 bg-white border dark:border-[rgba(31,97,239,0.25)] border-[#C7D2FE] text-[#5046E5] dark:text-[#8FB5FF] text-xs font-medium dark:shadow-[0_0_15px_rgba(31,97,239,0.12)] shadow-[0_2px_12px_rgba(80,70,229,0.08)] backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 dark:text-[#8FB5FF] text-[#5046E5]" />
            <span className="font-semibold">All-in-One Contract &amp; Escrow Platform</span>
          </div>

          {/* Master Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight dark:text-[#E8EAE6] text-[#0F172A] leading-[1.12]">
            Work with Confidence. <br />
            Get Paid with{' '}
            <span className="dark:text-[#8FB5FF] text-[#5046E5] dark:drop-shadow-[0_0_25px_rgba(31,97,239,0.3)] drop-shadow-[0_0_20px_rgba(80,70,229,0.25)]">
              Trust.
            </span>
          </h1>

          {/* Value Subtitle */}
          <p className="text-base sm:text-lg dark:text-[#9AA4B8] text-slate-600 max-w-2xl mx-auto leading-relaxed">
            TrustPay connects Clients and Specialists through secure digital contracts, milestone-based escrow payments and seamless project collaboration.
          </p>

          {/* Primary CTA Button */}
          <div className="pt-2">
            <button
              onClick={() => openAuthWithRolePrompt('register')}
              className="px-8 py-3.5 rounded-full dark:bg-[#1F61EF] dark:hover:bg-[#174EC4] dark:text-white bg-[#5046E5] hover:bg-[#4338CA] text-white text-sm font-bold transition-all duration-300 dark:shadow-[0_0_35px_rgba(31,97,239,0.35)] dark:hover:shadow-[0_0_45px_rgba(31,97,239,0.6)] shadow-lg shadow-[#5046E5]/30 hover:shadow-xl hover:shadow-[#5046E5]/45 flex items-center justify-center space-x-2 mx-auto active:scale-95 cursor-pointer"
            >
              <span>Get Started for Free</span>
              <span className="text-base">↗</span>
            </button>
          </div>

          {/* Center Brand Showcase Emblem (Matching Reference Image) */}
          <div className="pt-10 sm:pt-14 flex flex-col items-center justify-center">
            <TrustPayLogo size="hero" showSubtitle={true} />
          </div>
        </div>

        {/* Luminous Curved Horizon with Central Flare Ray (Matching Reference Image) */}
        <div className="relative w-full h-32 sm:h-44 overflow-hidden mt-6 flex items-center justify-center pointer-events-none">
          {/* Horizon Curved Line SVG */}
          <svg viewBox="0 0 1440 200" className="w-full absolute bottom-0 left-0" preserveAspectRatio="none">
            <defs>
              <linearGradient id="horizonGradDark" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#1F61EF" stopOpacity="0" />
                <stop offset="35%" stopColor="#1F61EF" stopOpacity="0.45" />
                <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.9" />
                <stop offset="65%" stopColor="#1F61EF" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#1F61EF" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="horizonGradLight" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6366F1" stopOpacity="0" />
                <stop offset="35%" stopColor="#6366F1" stopOpacity="0.45" />
                <stop offset="50%" stopColor="#5046E5" stopOpacity="0.85" />
                <stop offset="65%" stopColor="#6366F1" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
              </linearGradient>
              <filter id="horizonGlow">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <path
              d="M 0 180 Q 720 40 1440 180"
              fill="none"
              stroke="url(#horizonGradDark)"
              strokeWidth="2.5"
              filter="url(#horizonGlow)"
              className="hidden dark:block"
            />
            <path
              d="M 0 180 Q 720 40 1440 180"
              fill="none"
              stroke="url(#horizonGradLight)"
              strokeWidth="2.5"
              filter="url(#horizonGlow)"
              className="block dark:hidden"
            />
          </svg>

          {/* Center Radiant Light Flare */}
          <div className="absolute bottom-6 w-48 sm:w-80 h-10 dark:bg-[#1F61EF]/60 bg-[#6366F1]/30 blur-xl rounded-full" />
          <div className="absolute bottom-7 w-20 sm:w-32 h-4 dark:bg-white bg-[#5046E5]/40 blur-md rounded-full" />
        </div>
      </section>

      {/* 3. PLATFORM FEATURES & VALUE PILLARS */}
      <section id="features" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="text-xs font-mono font-bold dark:text-[#8FB5FF] text-[#5046E5] uppercase tracking-wider">
            Enterprise Guarantees
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold dark:text-[#E8EAE6] text-slate-900">
            Core Platform Architecture
          </h2>
          <p className="text-sm dark:text-[#9AA4B8] text-slate-600">
            Engineered to remove friction and fraud from high-value digital agreements and remote contracting.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 space-y-3 shadow-sm hover:dark:border-[rgba(31,97,239,0.25)] hover:border-[#C7D2FE] hover:shadow-md transition">
            <div className="w-10 h-10 rounded-xl dark:bg-[#191D2A] bg-[#EEF2FF] border dark:border-[rgba(31,97,239,0.2)] border-[#C7D2FE] flex items-center justify-center dark:text-[#8FB5FF] text-[#5046E5]">
              <Lock className="w-5 h-5 dark:text-[#8FB5FF] text-[#5046E5]" />
            </div>
            <h4 className="text-base font-bold dark:text-[#E8EAE6] text-slate-900">Cryptographic Escrow</h4>
            <p className="text-xs dark:text-[#9AA4B8] text-slate-600 leading-relaxed">
              Funds deposited into segregated milestone accounts before specialist development begins. Neither party can unilaterally withdraw.
            </p>
          </div>

          <div className="p-6 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 space-y-3 shadow-sm hover:dark:border-[rgba(31,97,239,0.25)] hover:border-[#C7D2FE] hover:shadow-md transition">
            <div className="w-10 h-10 rounded-xl dark:bg-[#191D2A] bg-[#EEF2FF] border dark:border-[rgba(31,97,239,0.2)] border-[#C7D2FE] flex items-center justify-center dark:text-[#8FB5FF] text-[#5046E5]">
              <FileCheck2 className="w-5 h-5 dark:text-[#8FB5FF] text-[#5046E5]" />
            </div>
            <h4 className="text-base font-bold dark:text-[#E8EAE6] text-slate-900">Bilateral Contracts</h4>
            <p className="text-xs dark:text-[#9AA4B8] text-slate-600 leading-relaxed">
              Deterministic SHA-256 canonical hashing ensures agreement deliverables, clauses, and milestones cannot be altered once signed.
            </p>
          </div>

          <div className="p-6 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 space-y-3 shadow-sm hover:dark:border-[rgba(31,97,239,0.25)] hover:border-[#C7D2FE] hover:shadow-md transition">
            <div className="w-10 h-10 rounded-xl dark:bg-[#191D2A] bg-[#EEF2FF] border dark:border-[rgba(31,97,239,0.2)] border-[#C7D2FE] flex items-center justify-center dark:text-[#8FB5FF] text-[#5046E5]">
              <Scale className="w-5 h-5 dark:text-[#8FB5FF] text-[#5046E5]" />
            </div>
            <h4 className="text-base font-bold dark:text-[#E8EAE6] text-slate-900">Arbitration Protocol</h4>
            <p className="text-xs dark:text-[#9AA4B8] text-slate-600 leading-relaxed">
              Dispute workflows lock remaining escrow funds with objective evidence dossiers, enabling fair mutual settlement or binding ruling.
            </p>
          </div>

          <div className="p-6 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 space-y-3 shadow-sm hover:dark:border-[rgba(31,97,239,0.25)] hover:border-[#C7D2FE] hover:shadow-md transition">
            <div className="w-10 h-10 rounded-xl dark:bg-[#191D2A] bg-[#EEF2FF] border dark:border-[rgba(31,97,239,0.2)] border-[#C7D2FE] flex items-center justify-center dark:text-[#8FB5FF] text-[#5046E5]">
              <DollarSign className="w-5 h-5 dark:text-[#8FB5FF] text-[#5046E5]" />
            </div>
            <h4 className="text-base font-bold dark:text-[#E8EAE6] text-slate-900">Double-Entry Ledger</h4>
            <p className="text-xs dark:text-[#9AA4B8] text-slate-600 leading-relaxed">
              Atomic general ledger transactions guarantee that debits equal credits at all times ($\Delta = 0$). Zero discrepancy risk.
            </p>
          </div>
        </div>
      </section>

      {/* 4. ABOUT / HOW IT WORKS */}
      <section id="about" className="py-20 dark:bg-[#0B0D14] bg-white/70 border-y dark:border-[#272B38] border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-mono font-bold dark:text-[#8FB5FF] text-[#5046E5] uppercase tracking-wider">
              About TrustPay
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold dark:text-[#E8EAE6] text-slate-900">
              How the Escrow Protocol Works
            </h2>
            <p className="text-sm dark:text-[#9AA4B8] text-slate-600">
              Four transparent steps to negotiate, fund, execute, and verify professional digital agreements.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 space-y-4 shadow-sm">
              <span className="text-3xl font-extrabold font-mono dark:text-[#8FB5FF]/40 text-[#6366F1]/30 block">01</span>
              <h3 className="text-base font-bold dark:text-[#E8EAE6] text-slate-900">Agreement Terms</h3>
              <p className="text-xs dark:text-[#9AA4B8] text-slate-600 leading-relaxed">
                Define scope of work, milestone deliverable criteria, acceptance timelines, and minor-unit financial allocation.
              </p>
            </div>

            <div className="p-6 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 space-y-4 shadow-sm">
              <span className="text-3xl font-extrabold font-mono dark:text-[#8FB5FF]/40 text-[#6366F1]/30 block">02</span>
              <h3 className="text-base font-bold dark:text-[#E8EAE6] text-slate-900">Escrow Funding</h3>
              <p className="text-xs dark:text-[#9AA4B8] text-slate-600 leading-relaxed">
                Client deposits milestone funding into the protected virtual escrow vault before the specialist starts development.
              </p>
            </div>

            <div className="p-6 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 space-y-4 shadow-sm">
              <span className="text-3xl font-extrabold font-mono dark:text-[#8FB5FF]/40 text-[#6366F1]/30 block">03</span>
              <h3 className="text-base font-bold dark:text-[#E8EAE6] text-slate-900">Work Submission</h3>
              <p className="text-xs dark:text-[#9AA4B8] text-slate-600 leading-relaxed">
                Specialist completes deliverables and submits artifacts, pull requests, and documentation for client review.
              </p>
            </div>

            <div className="p-6 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[rgba(31,97,239,0.25)] border-[#C7D2FE] space-y-4 shadow-sm">
              <span className="text-3xl font-extrabold font-mono dark:text-[#8FB5FF] text-[#5046E5] block">04</span>
              <h3 className="text-base font-bold dark:text-[#E8EAE6] text-slate-900">Instant Settlement</h3>
              <p className="text-xs dark:text-[#9AA4B8] text-slate-600 leading-relaxed">
                Client signs off on accepted milestone deliverables; funds credit immediately to specialist wallet balance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. INSTITUTIONAL SECURITY */}
      <section id="security" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="text-xs font-mono font-bold dark:text-[#8FB5FF] text-[#5046E5] uppercase tracking-wider">
            Institutional Security
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold dark:text-[#E8EAE6] text-slate-900">
            Built with Institutional Controls
          </h2>
          <p className="text-sm dark:text-[#9AA4B8] text-slate-600">
            Strict financial isolation and tamper-evident cryptographic ledgers ensure capital and assets are safe.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-8 rounded-3xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 space-y-4 shadow-sm">
            <div className="w-10 h-10 rounded-xl dark:bg-[#191D2A] bg-[#EEF2FF] border dark:border-[rgba(31,97,239,0.2)] border-[#C7D2FE] flex items-center justify-center dark:text-[#8FB5FF] text-[#5046E5]">
              <Scale className="w-5 h-5 dark:text-[#8FB5FF] text-[#5046E5]" />
            </div>
            <h3 className="text-lg font-bold dark:text-[#E8EAE6] text-slate-900">Structured Dispute Governance</h3>
            <p className="text-xs dark:text-[#9AA4B8] text-slate-600 leading-relaxed">
              When disagreements arise, an immediate defensive escrow hold prevents unauthorized capital movements. Both parties upload technical evidence to a shared dossier for objective mediation and binding resolution.
            </p>
          </div>

          <div className="p-8 rounded-3xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 space-y-4 shadow-sm">
            <div className="w-10 h-10 rounded-xl dark:bg-[#191D2A] bg-[#EEF2FF] border dark:border-[rgba(31,97,239,0.2)] border-[#C7D2FE] flex items-center justify-center dark:text-[#8FB5FF] text-[#5046E5]">
              <CheckCircle2 className="w-5 h-5 dark:text-[#8FB5FF] text-[#5046E5]" />
            </div>
            <h3 className="text-lg font-bold dark:text-[#E8EAE6] text-slate-900">Deterministic Document Hashes</h3>
            <p className="text-xs dark:text-[#9AA4B8] text-slate-600 leading-relaxed">
              Every contract version produces a deterministic SHA-256 canonical hash. Any modification requires mutual re-consent, preventing unilateral scope creep or altered acceptance conditions.
            </p>
          </div>
        </div>
      </section>

      {/* 6. FAQ ACCORDION */}
      <section id="faq" className="py-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center space-y-3">
          <span className="text-xs font-mono font-bold dark:text-[#8FB5FF] text-[#5046E5] uppercase tracking-wider">
            Clear Answers
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold dark:text-[#E8EAE6] text-slate-900">
            Frequently Asked Questions
          </h2>
          <p className="text-sm dark:text-[#9AA4B8] text-slate-600">
            Everything you need to know about TrustPay escrow, agreements, and security.
          </p>
        </div>

        <div className="space-y-3">
          {faqItems.map((item, index) => {
            const isOpen = activeFaq === index;
            return (
              <div
                key={index}
                className="rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 overflow-hidden transition-all shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(index)}
                  className="w-full p-5 text-left flex items-center justify-between text-sm font-semibold dark:text-[#E8EAE6] text-slate-900 dark:hover:text-[#8FB5FF] hover:text-[#5046E5] transition-colors cursor-pointer"
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#A5AAA2] transition-transform duration-200 ${
                      isOpen ? 'rotate-180 dark:text-[#8FB5FF] text-[#5046E5]' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs dark:text-[#9AA4B8] text-slate-600 leading-relaxed border-t dark:border-[#272B38] border-slate-200 pt-3">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 7. CONTACT & SYSTEM TELEMETRY */}
      <section id="contact" className="py-20 dark:bg-[#0B0D14] bg-white/70 border-t dark:border-[#272B38] border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* System Telemetry */}
            <div className="lg:col-span-6 space-y-6">
              <span className="text-xs font-mono font-bold dark:text-[#8FB5FF] text-[#5046E5] uppercase tracking-wider">
                System Observability
              </span>
              <h2 className="text-3xl font-extrabold dark:text-[#E8EAE6] text-slate-900">
                Live Platform Architecture
              </h2>
              <p className="text-xs dark:text-[#9AA4B8] text-slate-600 leading-relaxed">
                TrustPay operates high-reliability services on hardened Express APIs with Supabase PostgreSQL and real-time Socket.IO channels.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs font-bold dark:text-[#E8EAE6] text-slate-900">
                      <Server className="w-4 h-4 dark:text-[#8FB5FF] text-[#5046E5]" />
                      <span>Express API</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full dark:bg-[#1C2740] bg-[#EEF2FF] dark:text-[#8FB5FF] text-[#5046E5] dark:border-[rgba(31,97,239,0.2)] border-[#C7D2FE] font-bold">
                      {apiHealth?.status === 'healthy' ? 'HEALTHY' : 'OPERATIONAL'}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono dark:text-[#9AA4B8] text-slate-600 space-y-0.5">
                    <div>Port: 5000</div>
                    <div>Ledger Invariants: Verified</div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs font-bold dark:text-[#E8EAE6] text-slate-900">
                      <Database className="w-4 h-4 dark:text-[#8FB5FF] text-[#5046E5]" />
                      <span>Supabase DB</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full dark:bg-[#1C2740] bg-[#EEF2FF] dark:text-[#8FB5FF] text-[#5046E5] dark:border-[rgba(31,97,239,0.2)] border-[#C7D2FE] font-bold">
                      {dbHealth?.status === 'connected' ? 'CONNECTED' : 'ONLINE'}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono dark:text-[#9AA4B8] text-slate-600 space-y-0.5">
                    <div>Prisma Driver: Active</div>
                    <div>Ledger Delta: 0</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Direct Contact Form */}
            <div className="lg:col-span-6 p-8 rounded-3xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 space-y-4 shadow-sm">
              <div>
                <h3 className="text-lg font-bold dark:text-[#E8EAE6] text-slate-900">Contact Enterprise Escrow Team</h3>
                <p className="text-xs dark:text-[#9AA4B8] text-slate-600 mt-0.5">
                  Have contract escrow inquiries or custom enterprise requirements? Reach our desk directly.
                </p>
              </div>

              {contactSubmitted ? (
                <div className="p-6 rounded-2xl dark:bg-[#1C2740] bg-[#EEF2FF] dark:border-[rgba(31,97,239,0.2)] border-[#C7D2FE] text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 dark:text-[#8FB5FF] text-[#5046E5] mx-auto" />
                  <h4 className="text-sm font-bold dark:text-[#E8EAE6] text-slate-900">Inquiry Received</h4>
                  <p className="text-xs dark:text-[#9AA4B8] text-slate-600">
                    An enterprise legal specialist will review your request within 2 business hours.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-3 text-xs">
                  <div>
                    <label className="block dark:text-[#9AA4B8] text-slate-700 mb-1 font-medium">Your Name</label>
                    <input
                      type="text"
                      placeholder="Jane Doe"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl dark:bg-[#191D2A] bg-slate-50 border dark:border-[#272B38] border-slate-300 dark:text-[#E8EAE6] text-slate-900 placeholder-slate-400 focus:outline-none dark:focus:border-[#1F61EF] focus:border-[#5046E5]"
                    />
                  </div>
                  <div>
                    <label className="block dark:text-[#9AA4B8] text-slate-700 mb-1 font-medium">Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="jane@company.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl dark:bg-[#191D2A] bg-slate-50 border dark:border-[#272B38] border-slate-300 dark:text-[#E8EAE6] text-slate-900 placeholder-slate-400 focus:outline-none dark:focus:border-[#1F61EF] focus:border-[#5046E5]"
                    />
                  </div>
                  <div>
                    <label className="block dark:text-[#9AA4B8] text-slate-700 mb-1 font-medium">Inquiry / Project Scope *</label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Describe your contractual volume, enterprise integration, or questions..."
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      className="w-full p-3 rounded-xl dark:bg-[#191D2A] bg-slate-50 border dark:border-[#272B38] border-slate-300 dark:text-[#E8EAE6] text-slate-900 placeholder-slate-400 focus:outline-none dark:focus:border-[#1F61EF] focus:border-[#5046E5]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl dark:bg-[#1F61EF] dark:hover:bg-[#174EC4] dark:text-white bg-[#5046E5] hover:bg-[#4338CA] text-white text-xs font-bold transition-all flex items-center justify-center space-x-1.5 dark:shadow-[0_0_15px_rgba(31,97,239,0.15)] shadow-md shadow-[#5046E5]/25 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Enterprise Inquiry</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 8. COMPLETE FOOTER */}
      <footer className="border-t dark:border-[#272B38] border-slate-200 dark:bg-[#0B0D14] bg-white py-12 text-xs dark:text-[#9AA4B8] text-slate-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b dark:border-[#272B38] border-slate-200">
            <TrustPayLogo size="sm" />

            <div className="flex flex-wrap gap-6 text-xs dark:text-[#9AA4B8] text-slate-600">
              <a href="#" className="dark:hover:text-[#8FB5FF] hover:text-[#5046E5] transition">Home</a>
              <a href="#about" className="dark:hover:text-[#8FB5FF] hover:text-[#5046E5] transition">About</a>
              <a href="#features" className="dark:hover:text-[#8FB5FF] hover:text-[#5046E5] transition">Features</a>
              <a href="#contact" className="dark:hover:text-[#8FB5FF] hover:text-[#5046E5] transition">Contacts</a>
              <a href="#security" className="dark:hover:text-[#8FB5FF] hover:text-[#5046E5] transition">Security</a>
              <a href="#faq" className="dark:hover:text-[#8FB5FF] hover:text-[#5046E5] transition">FAQ</a>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#6A6F68]">
            <p>
              &copy; {new Date().getFullYear()} TrustPay Enterprise v2.0. Digital Contract &amp; Cryptographic Milestone Escrow Platform. All rights reserved.
            </p>
            <div className="flex items-center space-x-4">
              <span>Financial Isolation Enforced</span>
              <span>•</span>
              <span>Sandbox Mode Active</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Role Selection Modal for Sign Up & Sign In */}
      <RoleSelectionModal
        isOpen={authRoleModalOpen}
        onSelectRole={handleRoleSelectedForAuth}
        onCancel={() => setAuthRoleModalOpen(false)}
        actionType={authActionType}
        onToggleActionType={(type) => setAuthActionType(type)}
      />
    </div>
  );
};
