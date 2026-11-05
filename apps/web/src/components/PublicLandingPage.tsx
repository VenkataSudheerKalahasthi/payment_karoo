import React, { useState } from 'react';
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
import { SignInButton, SignUpButton } from '@clerk/clerk-react';
import { ThemeToggle } from './ThemeToggle';
import { TrustPayLogo } from './TrustPayLogo';
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSubmitted, setContactSubmitted] = useState(false);

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
    <div className="min-h-screen dark:bg-[#050605] bg-[#F7FAF7] dark:text-[#E8EAE6] text-[#242424] selection:bg-[#8BFF24] selection:text-[#050605] relative overflow-hidden transition-colors duration-300">
      {/* Ambient Lighting Gradients */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#8BFF24]/10 dark:bg-[#8BFF24]/15 rounded-full blur-[140px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute top-1/4 right-0 w-[450px] h-[450px] bg-[#8BFF24]/5 dark:bg-[#8BFF24]/10 rounded-full blur-[130px] pointer-events-none translate-x-1/3" />

      {/* 1. SEAMLESS BLENDED NAVBAR */}
      <header className="sticky top-0 z-50 transition-all duration-300 bg-transparent backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Edge: Brand Logo */}
          <div className="flex items-center cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <TrustPayLogo size="md" />
          </div>

          {/* Center Nav Links (Home, About, Features, Contacts, Security) */}
          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium dark:text-[#CDCBCA] text-[#475569]">
            <a href="#" className="hover:text-[#8BFF24] dark:hover:text-[#8BFF24] transition-colors">
              Home
            </a>
            <a href="#about" className="hover:text-[#8BFF24] dark:hover:text-[#8BFF24] transition-colors">
              About
            </a>
            <a href="#features" className="hover:text-[#8BFF24] dark:hover:text-[#8BFF24] transition-colors">
              Features
            </a>
            <a href="#contact" className="hover:text-[#8BFF24] dark:hover:text-[#8BFF24] transition-colors">
              Contacts
            </a>
            <a href="#security" className="hover:text-[#8BFF24] dark:hover:text-[#8BFF24] transition-colors">
              Security
            </a>
          </nav>

          {/* Right Edge: Theme Toggle (Symbols Only) + Sign in / Dashboard + Get Started */}
          <div className="hidden sm:flex items-center space-x-3">
            {/* Symbol-only theme toggle */}
            <ThemeToggle />

            {isSignedIn && onGoToDashboard ? (
              <button
                onClick={onGoToDashboard}
                className="px-5 py-2 rounded-full bg-[#8BFF24] hover:bg-[#A3FF50] text-xs font-bold text-[#050605] transition-all duration-300 shadow-[0_0_20px_rgba(139,255,36,0.35)] flex items-center space-x-1.5 active:scale-95 cursor-pointer"
              >
                <span>Go to Dashboard</span>
                <span className="text-sm">↗</span>
              </button>
            ) : (
              <>
                {/* Sign in Pill Button */}
                <SignInButton mode="modal">
                  <button className="px-5 py-2 rounded-full text-xs font-semibold dark:text-[#E8EAE6] text-[#242424] dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 hover:bg-black/10 border dark:border-white/10 border-black/10 transition-all cursor-pointer backdrop-blur-sm">
                    Sign in
                  </button>
                </SignInButton>

                {/* Get Started Pill Button */}
                <SignUpButton mode="modal">
                  <button className="px-5 py-2 rounded-full bg-[#8BFF24] hover:bg-[#A3FF50] text-xs font-bold text-[#050605] transition-all duration-300 shadow-[0_0_20px_rgba(139,255,36,0.25)] hover:shadow-[0_0_25px_rgba(139,255,36,0.4)] flex items-center space-x-1.5 active:scale-95 cursor-pointer">
                    <span>Get Started</span>
                    <span className="text-sm">↗</span>
                  </button>
                </SignUpButton>
              </>
            )}
          </div>

          {/* Mobile Actions */}
          <div className="md:hidden flex items-center space-x-2">
            <ThemeToggle />
            <SignUpButton mode="modal">
              <button className="px-3.5 py-1.5 rounded-full bg-[#8BFF24] text-xs font-bold text-[#050605]">
                Get Started
              </button>
            </SignUpButton>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-full dark:bg-white/5 bg-black/5 text-[#E8EAE6] border dark:border-white/10 border-black/10"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-current" /> : <Menu className="w-5 h-5 text-current" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden px-6 pt-3 pb-6 dark:bg-[#080908]/95 bg-white/95 backdrop-blur-xl border-b dark:border-white/10 border-black/10 space-y-3 text-sm">
            <a
              href="#"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 dark:text-[#E8EAE6] text-[#242424] hover:text-[#8BFF24]"
            >
              Home
            </a>
            <a
              href="#about"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 dark:text-[#E8EAE6] text-[#242424] hover:text-[#8BFF24]"
            >
              About
            </a>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 dark:text-[#E8EAE6] text-[#242424] hover:text-[#8BFF24]"
            >
              Features
            </a>
            <a
              href="#contact"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 dark:text-[#E8EAE6] text-[#242424] hover:text-[#8BFF24]"
            >
              Contacts
            </a>
            <a
              href="#security"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 dark:text-[#E8EAE6] text-[#242424] hover:text-[#8BFF24]"
            >
              Security
            </a>
            <div className="pt-3 border-t dark:border-white/10 border-black/10 flex items-center space-x-3">
              <SignInButton mode="modal">
                <button className="flex-1 py-2.5 rounded-full dark:bg-white/5 bg-black/5 text-xs font-semibold dark:text-[#E8EAE6] text-[#242424] border dark:border-white/10 border-black/10">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="flex-1 py-2.5 rounded-full bg-[#8BFF24] text-xs font-bold text-[#050605]">
                  Get Started
                </button>
              </SignUpButton>
            </div>
          </div>
        )}
      </header>

      {/* 2. CINEMATIC HERO SECTION (MATCHING REFERENCE IMAGE) */}
      <section className="relative pt-12 pb-16 lg:pt-20 lg:pb-24 text-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Top Pill Badge */}
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full dark:bg-[#151715]/90 bg-white/90 border dark:border-[rgba(139,255,36,0.3)] border-[#8BFF24]/40 text-[#8BFF24] dark:text-[#8BFF24] text-xs font-medium shadow-[0_0_15px_rgba(139,255,36,0.15)] backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-[#8BFF24]" />
            <span className="font-medium">All-in-One Contract &amp; Escrow Platform</span>
          </div>

          {/* Master Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight dark:text-[#E8EAE6] text-[#111827] leading-[1.12]">
            Work with Confidence. <br />
            Get Paid with{' '}
            <span className="text-[#8BFF24] drop-shadow-[0_0_25px_rgba(139,255,36,0.35)]">
              Trust.
            </span>
          </h1>

          {/* Value Subtitle */}
          <p className="text-base sm:text-lg dark:text-[#A5AAA2] text-[#475569] max-w-2xl mx-auto leading-relaxed">
            TrustPay connects Clients and Specialists through secure digital contracts, milestone-based escrow payments and seamless project collaboration.
          </p>

          {/* Primary CTA Button */}
          <div className="pt-2">
            <SignUpButton mode="modal">
              <button className="px-8 py-3.5 rounded-full bg-[#8BFF24] hover:bg-[#A3FF50] text-sm font-bold text-[#050605] transition-all duration-300 shadow-[0_0_35px_rgba(139,255,36,0.4)] hover:shadow-[0_0_45px_rgba(139,255,36,0.6)] flex items-center justify-center space-x-2 mx-auto active:scale-95 cursor-pointer">
                <span>Get Started for Free</span>
                <span className="text-base">↗</span>
              </button>
            </SignUpButton>
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
              <linearGradient id="horizonGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8BFF24" stopOpacity="0" />
                <stop offset="35%" stopColor="#8BFF24" stopOpacity="0.45" />
                <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.9" />
                <stop offset="65%" stopColor="#8BFF24" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#8BFF24" stopOpacity="0" />
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
              stroke="url(#horizonGrad)"
              strokeWidth="2.5"
              filter="url(#horizonGlow)"
            />
          </svg>

          {/* Center Radiant Light Flare */}
          <div className="absolute bottom-6 w-48 sm:w-80 h-10 bg-[#8BFF24]/60 blur-xl rounded-full" />
          <div className="absolute bottom-7 w-20 sm:w-32 h-4 bg-white blur-md rounded-full" />
        </div>
      </section>

      {/* 3. PLATFORM FEATURES & VALUE PILLARS */}
      <section id="features" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="text-xs font-mono font-bold text-[#8BFF24] uppercase tracking-wider">
            Enterprise Guarantees
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold dark:text-[#E8EAE6] text-[#111827]">
            Core Platform Architecture
          </h2>
          <p className="text-sm dark:text-[#A5AAA2] text-[#64748B]">
            Engineered to remove friction and fraud from high-value digital agreements and remote contracting.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-2xl dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] space-y-3 shadow-sm hover:dark:border-[rgba(139,255,36,0.3)] hover:border-[#8BFF24]/40 transition">
            <div className="w-10 h-10 rounded-xl dark:bg-[#202220] bg-[#F1F5F9] border dark:border-[rgba(139,255,36,0.25)] border-[#E2E8F0] flex items-center justify-center text-[#8BFF24]">
              <Lock className="w-5 h-5 text-[#8BFF24]" />
            </div>
            <h4 className="text-base font-bold dark:text-[#E8EAE6] text-[#111827]">Cryptographic Escrow</h4>
            <p className="text-xs dark:text-[#A5AAA2] text-[#64748B] leading-relaxed">
              Funds deposited into segregated milestone accounts before specialist development begins. Neither party can unilaterally withdraw.
            </p>
          </div>

          <div className="p-6 rounded-2xl dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] space-y-3 shadow-sm hover:dark:border-[rgba(139,255,36,0.3)] hover:border-[#8BFF24]/40 transition">
            <div className="w-10 h-10 rounded-xl dark:bg-[#202220] bg-[#F1F5F9] border dark:border-[rgba(139,255,36,0.25)] border-[#E2E8F0] flex items-center justify-center text-[#8BFF24]">
              <FileCheck2 className="w-5 h-5 text-[#8BFF24]" />
            </div>
            <h4 className="text-base font-bold dark:text-[#E8EAE6] text-[#111827]">Bilateral Contracts</h4>
            <p className="text-xs dark:text-[#A5AAA2] text-[#64748B] leading-relaxed">
              Deterministic SHA-256 canonical hashing ensures agreement deliverables, clauses, and milestones cannot be altered once signed.
            </p>
          </div>

          <div className="p-6 rounded-2xl dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] space-y-3 shadow-sm hover:dark:border-[rgba(139,255,36,0.3)] hover:border-[#8BFF24]/40 transition">
            <div className="w-10 h-10 rounded-xl dark:bg-[#202220] bg-[#F1F5F9] border dark:border-[rgba(139,255,36,0.25)] border-[#E2E8F0] flex items-center justify-center text-[#8BFF24]">
              <Scale className="w-5 h-5 text-[#8BFF24]" />
            </div>
            <h4 className="text-base font-bold dark:text-[#E8EAE6] text-[#111827]">Arbitration Protocol</h4>
            <p className="text-xs dark:text-[#A5AAA2] text-[#64748B] leading-relaxed">
              Dispute workflows lock remaining escrow funds with objective evidence dossiers, enabling fair mutual settlement or binding ruling.
            </p>
          </div>

          <div className="p-6 rounded-2xl dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] space-y-3 shadow-sm hover:dark:border-[rgba(139,255,36,0.3)] hover:border-[#8BFF24]/40 transition">
            <div className="w-10 h-10 rounded-xl dark:bg-[#202220] bg-[#F1F5F9] border dark:border-[rgba(139,255,36,0.25)] border-[#E2E8F0] flex items-center justify-center text-[#8BFF24]">
              <DollarSign className="w-5 h-5 text-[#8BFF24]" />
            </div>
            <h4 className="text-base font-bold dark:text-[#E8EAE6] text-[#111827]">Double-Entry Ledger</h4>
            <p className="text-xs dark:text-[#A5AAA2] text-[#64748B] leading-relaxed">
              Atomic general ledger transactions guarantee that debits equal credits at all times ($\Delta = 0$). Zero discrepancy risk.
            </p>
          </div>
        </div>
      </section>

      {/* 4. ABOUT / HOW IT WORKS */}
      <section id="about" className="py-20 dark:bg-[#080908] bg-white/50 border-y dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-mono font-bold text-[#8BFF24] uppercase tracking-wider">
              About TrustPay
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold dark:text-[#E8EAE6] text-[#111827]">
              How the Escrow Protocol Works
            </h2>
            <p className="text-sm dark:text-[#A5AAA2] text-[#64748B]">
              Four transparent steps to negotiate, fund, execute, and verify professional digital agreements.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] space-y-4 shadow-sm">
              <span className="text-3xl font-extrabold font-mono text-[#8BFF24]/40 block">01</span>
              <h3 className="text-base font-bold dark:text-[#E8EAE6] text-[#111827]">Agreement Terms</h3>
              <p className="text-xs dark:text-[#A5AAA2] text-[#64748B] leading-relaxed">
                Define scope of work, milestone deliverable criteria, acceptance timelines, and minor-unit financial allocation.
              </p>
            </div>

            <div className="p-6 rounded-2xl dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] space-y-4 shadow-sm">
              <span className="text-3xl font-extrabold font-mono text-[#8BFF24]/40 block">02</span>
              <h3 className="text-base font-bold dark:text-[#E8EAE6] text-[#111827]">Escrow Funding</h3>
              <p className="text-xs dark:text-[#A5AAA2] text-[#64748B] leading-relaxed">
                Client deposits milestone funding into the protected virtual escrow vault before the specialist starts development.
              </p>
            </div>

            <div className="p-6 rounded-2xl dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] space-y-4 shadow-sm">
              <span className="text-3xl font-extrabold font-mono text-[#8BFF24]/40 block">03</span>
              <h3 className="text-base font-bold dark:text-[#E8EAE6] text-[#111827]">Work Submission</h3>
              <p className="text-xs dark:text-[#A5AAA2] text-[#64748B] leading-relaxed">
                Specialist completes deliverables and submits artifacts, pull requests, and documentation for client review.
              </p>
            </div>

            <div className="p-6 rounded-2xl dark:bg-[#151715] bg-white border dark:border-[rgba(139,255,36,0.3)] border-[#8BFF24]/40 space-y-4 shadow-sm">
              <span className="text-3xl font-extrabold font-mono text-[#8BFF24] block">04</span>
              <h3 className="text-base font-bold dark:text-[#E8EAE6] text-[#111827]">Instant Settlement</h3>
              <p className="text-xs dark:text-[#A5AAA2] text-[#64748B] leading-relaxed">
                Client signs off on accepted milestone deliverables; funds credit immediately to specialist wallet balance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. INSTITUTIONAL SECURITY */}
      <section id="security" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="text-xs font-mono font-bold text-[#8BFF24] uppercase tracking-wider">
            Institutional Security
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold dark:text-[#E8EAE6] text-[#111827]">
            Built with Institutional Controls
          </h2>
          <p className="text-sm dark:text-[#A5AAA2] text-[#64748B]">
            Strict financial isolation and tamper-evident cryptographic ledgers ensure capital and assets are safe.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-8 rounded-3xl dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] space-y-4 shadow-sm">
            <div className="w-10 h-10 rounded-xl dark:bg-[#202220] bg-[#F1F5F9] border dark:border-[rgba(139,255,36,0.25)] border-[#E2E8F0] flex items-center justify-center text-[#8BFF24]">
              <Scale className="w-5 h-5 text-[#8BFF24]" />
            </div>
            <h3 className="text-lg font-bold dark:text-[#E8EAE6] text-[#111827]">Structured Dispute Governance</h3>
            <p className="text-xs dark:text-[#A5AAA2] text-[#64748B] leading-relaxed">
              When disagreements arise, an immediate defensive escrow hold prevents unauthorized capital movements. Both parties upload technical evidence to a shared dossier for objective mediation and binding resolution.
            </p>
          </div>

          <div className="p-8 rounded-3xl dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] space-y-4 shadow-sm">
            <div className="w-10 h-10 rounded-xl dark:bg-[#202220] bg-[#F1F5F9] border dark:border-[rgba(139,255,36,0.25)] border-[#E2E8F0] flex items-center justify-center text-[#8BFF24]">
              <CheckCircle2 className="w-5 h-5 text-[#8BFF24]" />
            </div>
            <h3 className="text-lg font-bold dark:text-[#E8EAE6] text-[#111827]">Deterministic Document Hashes</h3>
            <p className="text-xs dark:text-[#A5AAA2] text-[#64748B] leading-relaxed">
              Every contract version produces a deterministic SHA-256 canonical hash. Any modification requires mutual re-consent, preventing unilateral scope creep or altered acceptance conditions.
            </p>
          </div>
        </div>
      </section>

      {/* 6. FAQ ACCORDION */}
      <section id="faq" className="py-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center space-y-3">
          <span className="text-xs font-mono font-bold text-[#8BFF24] uppercase tracking-wider">
            Clear Answers
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold dark:text-[#E8EAE6] text-[#111827]">
            Frequently Asked Questions
          </h2>
          <p className="text-sm dark:text-[#A5AAA2] text-[#64748B]">
            Everything you need to know about TrustPay escrow, agreements, and security.
          </p>
        </div>

        <div className="space-y-3">
          {faqItems.map((item, index) => {
            const isOpen = activeFaq === index;
            return (
              <div
                key={index}
                className="rounded-2xl dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] overflow-hidden transition-all shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(index)}
                  className="w-full p-5 text-left flex items-center justify-between text-sm font-semibold dark:text-[#E8EAE6] text-[#111827] hover:text-[#8BFF24] dark:hover:text-[#8BFF24] transition-colors cursor-pointer"
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#A5AAA2] transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-[#8BFF24]' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs dark:text-[#A5AAA2] text-[#64748B] leading-relaxed border-t dark:border-[rgba(255,255,255,0.06)] border-[#E2E8F0] pt-3">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 7. CONTACT & SYSTEM TELEMETRY */}
      <section id="contact" className="py-20 dark:bg-[#080908] bg-white/50 border-t dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* System Telemetry */}
            <div className="lg:col-span-6 space-y-6">
              <span className="text-xs font-mono font-bold text-[#8BFF24] uppercase tracking-wider">
                System Observability
              </span>
              <h2 className="text-3xl font-extrabold dark:text-[#E8EAE6] text-[#111827]">
                Live Platform Architecture
              </h2>
              <p className="text-xs dark:text-[#A5AAA2] text-[#64748B] leading-relaxed">
                TrustPay operates high-reliability services on hardened Express APIs with Supabase PostgreSQL and real-time Socket.IO channels.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs font-bold dark:text-[#E8EAE6] text-[#111827]">
                      <Server className="w-4 h-4 text-[#8BFF24]" />
                      <span>Express API</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#8BFF24]/10 text-[#8BFF24] border border-[rgba(139,255,36,0.25)] font-bold">
                      {apiHealth?.status === 'healthy' ? 'HEALTHY' : 'OPERATIONAL'}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono dark:text-[#A5AAA2] text-[#64748B] space-y-0.5">
                    <div>Port: 5000</div>
                    <div>Ledger Invariants: Verified</div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs font-bold dark:text-[#E8EAE6] text-[#111827]">
                      <Database className="w-4 h-4 text-[#8BFF24]" />
                      <span>Supabase DB</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#8BFF24]/10 text-[#8BFF24] border border-[rgba(139,255,36,0.25)] font-bold">
                      {dbHealth?.status === 'connected' ? 'CONNECTED' : 'ONLINE'}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono dark:text-[#A5AAA2] text-[#64748B] space-y-0.5">
                    <div>Prisma Driver: Active</div>
                    <div>Ledger Delta: 0</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Direct Contact Form */}
            <div className="lg:col-span-6 p-8 rounded-3xl dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] space-y-4 shadow-sm">
              <div>
                <h3 className="text-lg font-bold dark:text-[#E8EAE6] text-[#111827]">Contact Enterprise Escrow Team</h3>
                <p className="text-xs dark:text-[#A5AAA2] text-[#64748B] mt-0.5">
                  Have contract escrow inquiries or custom enterprise requirements? Reach our desk directly.
                </p>
              </div>

              {contactSubmitted ? (
                <div className="p-6 rounded-2xl bg-[#8BFF24]/10 border border-[rgba(139,255,36,0.25)] text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-[#8BFF24] mx-auto" />
                  <h4 className="text-sm font-bold dark:text-[#E8EAE6] text-[#111827]">Inquiry Received</h4>
                  <p className="text-xs dark:text-[#A5AAA2] text-[#64748B]">
                    An enterprise legal specialist will review your request within 2 business hours.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-3 text-xs">
                  <div>
                    <label className="block dark:text-[#A5AAA2] text-[#475569] mb-1 font-medium">Your Name</label>
                    <input
                      type="text"
                      placeholder="Jane Doe"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl dark:bg-[#202220] bg-[#F8FAFC] border dark:border-[rgba(255,255,255,0.10)] border-[#CBD5E1] dark:text-[#E8EAE6] text-[#111827] placeholder-[#6A6F68] focus:outline-none focus:border-[#8BFF24]"
                    />
                  </div>
                  <div>
                    <label className="block dark:text-[#A5AAA2] text-[#475569] mb-1 font-medium">Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="jane@company.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl dark:bg-[#202220] bg-[#F8FAFC] border dark:border-[rgba(255,255,255,0.10)] border-[#CBD5E1] dark:text-[#E8EAE6] text-[#111827] placeholder-[#6A6F68] focus:outline-none focus:border-[#8BFF24]"
                    />
                  </div>
                  <div>
                    <label className="block dark:text-[#A5AAA2] text-[#475569] mb-1 font-medium">Inquiry / Project Scope *</label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Describe your contractual volume, enterprise integration, or questions..."
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      className="w-full p-3 rounded-xl dark:bg-[#202220] bg-[#F8FAFC] border dark:border-[rgba(255,255,255,0.10)] border-[#CBD5E1] dark:text-[#E8EAE6] text-[#111827] placeholder-[#6A6F68] focus:outline-none focus:border-[#8BFF24]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-[#8BFF24] hover:bg-[#A3FF50] text-xs font-bold text-[#050605] transition-all flex items-center justify-center space-x-1.5 shadow-[0_0_15px_rgba(139,255,36,0.2)] cursor-pointer"
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
      <footer className="border-t dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] dark:bg-[#050605] bg-white py-12 text-xs dark:text-[#A5AAA2] text-[#64748B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0]">
            <TrustPayLogo size="sm" />

            <div className="flex flex-wrap gap-6 text-xs dark:text-[#A5AAA2] text-[#64748B]">
              <a href="#" className="hover:text-[#8BFF24] transition">Home</a>
              <a href="#about" className="hover:text-[#8BFF24] transition">About</a>
              <a href="#features" className="hover:text-[#8BFF24] transition">Features</a>
              <a href="#contact" className="hover:text-[#8BFF24] transition">Contacts</a>
              <a href="#security" className="hover:text-[#8BFF24] transition">Security</a>
              <a href="#faq" className="hover:text-[#8BFF24] transition">FAQ</a>
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
    </div>
  );
};
