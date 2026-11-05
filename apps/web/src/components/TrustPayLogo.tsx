import React from 'react';

interface TrustPayLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'hero';
  className?: string;
  showSubtitle?: boolean;
}

export const TrustPayLogo: React.FC<TrustPayLogoProps> = ({
  size = 'md',
  className = '',
  showSubtitle = false,
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    hero: 'w-16 h-16 sm:w-20 sm:h-20',
  };

  const textSizes = {
    sm: 'text-base font-bold',
    md: 'text-xl font-extrabold',
    lg: 'text-2xl font-extrabold',
    hero: 'text-3xl sm:text-4xl font-extrabold',
  };

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* Stylized 3D T Ribbon + Shield Icon */}
      <div className={`relative ${iconSizes[size]} shrink-0 flex items-center justify-center`}>
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-[0_0_12px_rgba(139,255,36,0.35)]"
        >
          <defs>
            {/* Top Bar Gradient - Neon Lime to Emerald */}
            <linearGradient id="tp-lime-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A3FF50" />
              <stop offset="50%" stopColor="#8BFF24" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>

            {/* Stem Gradient - Chrome Silver / Metallic White */}
            <linearGradient id="tp-silver-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="50%" stopColor="#E2E8F0" />
              <stop offset="100%" stopColor="#94A3B8" />
            </linearGradient>

            {/* Shield Glow Filter */}
            <filter id="tp-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="glow" />
              <feComposite in="SourceGraphic" in2="glow" operator="over" />
            </filter>
          </defs>

          {/* Outer Fold: Stylized "T" Crossbar */}
          <path
            d="M 12 28 C 12 24 16 20 22 20 L 82 20 C 88 20 92 24 92 28 C 92 33 88 36 82 36 L 62 36 L 42 74 C 38 82 28 84 20 80 C 14 76 12 70 16 62 L 28 36 L 22 36 C 16 36 12 33 12 28 Z"
            fill="url(#tp-silver-grad)"
          />

          {/* Inner Accent: Neon Lime Curved "T" Wing */}
          <path
            d="M 28 20 L 78 20 C 84 20 86 24 82 28 L 48 28 C 42 28 38 32 36 38 L 22 66 C 20 70 16 72 14 70 C 12 68 12 64 14 60 L 26 30 C 28 24 32 20 38 20 Z"
            fill="url(#tp-lime-grad)"
          />

          {/* Micro Shield with Verified Checkmark */}
          <g transform="translate(48, 48)">
            {/* Shield Outline */}
            <path
              d="M 16 2 L 28 6 C 28 16 22 24 16 28 C 10 24 4 16 4 6 L 16 2 Z"
              fill="#080908"
              stroke="#8BFF24"
              strokeWidth="2.5"
            />
            {/* Checkmark */}
            <path
              d="M 10 14 L 14 18 L 22 10"
              stroke="#8BFF24"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      </div>

      {/* Typography */}
      <div className="flex flex-col">
        <div className={`tracking-tight leading-none ${textSizes[size]}`}>
          <span className="text-[#E8EAE6] dark:text-[#E8EAE6] text-black">Trust</span>
          <span className="text-[#8BFF24] ml-0.5">Pay</span>
        </div>
        {showSubtitle && (
          <div className="text-[9px] sm:text-[10px] tracking-[0.25em] uppercase font-mono font-bold text-[#A5AAA2] dark:text-[#A5AAA2] mt-1.5 flex items-center space-x-1.5">
            <span>CONTRACTS</span>
            <span className="text-[#8BFF24]">•</span>
            <span>ESCROW</span>
            <span className="text-[#8BFF24]">•</span>
            <span>PAYMENTS</span>
          </div>
        )}
      </div>
    </div>
  );
};

