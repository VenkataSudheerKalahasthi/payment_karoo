import React from 'react';

interface TrustPayLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'hero';
  className?: string;
  showSubtitle?: boolean;
  iconOnly?: boolean;
}

export const TrustPayLogo: React.FC<TrustPayLogoProps> = ({
  size = 'md',
  className = '',
  iconOnly = false,
}) => {
  // Height sizing mapped to 3:1 aspect ratio full logo
  const fullSizeClasses: Record<string, string> = {
    xs: 'h-7 sm:h-8',
    sm: 'h-9 sm:h-10',
    md: 'h-11 sm:h-12',
    lg: 'h-16 sm:h-18',
    hero: 'h-28 sm:h-36 md:h-44 max-w-full',
  };

  // Sizing for 1:1 aspect ratio icon/emblem only
  const iconSizeClasses: Record<string, string> = {
    xs: 'w-7 h-7 sm:w-8 sm:h-8',
    sm: 'w-10 h-10 sm:w-11 sm:h-11',
    md: 'w-12 h-12 sm:w-14 sm:h-14',
    lg: 'w-16 h-16 sm:w-20 sm:h-20',
    hero: 'w-28 h-28 sm:w-36 sm:h-36',
  };

  if (iconOnly) {
    return (
      <div className={`inline-flex items-center justify-center shrink-0 select-none ${className}`}>
        {/* Light Theme Icon Emblem (Royal Indigo 3D Hexagon Shield) */}
        <img
          src="/trustpay-icon-light.png"
          alt="TrustPay Emblem"
          className={`${iconSizeClasses[size]} object-contain block dark:hidden transition-all duration-300 drop-shadow-sm`}
          loading="eager"
        />

        {/* Dark Theme Icon Emblem (Neon Lime Green 3D Hexagon Shield) */}
        <img
          src="/trustpay-icon-dark.png"
          alt="TrustPay Emblem"
          className={`${iconSizeClasses[size]} object-contain hidden dark:block transition-all duration-300 dark:drop-shadow-[0_0_15px_rgba(139,255,36,0.4)]`}
          loading="eager"
        />
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center shrink-0 select-none ${className}`}>
      {/* 1st Image Logo: Light Theme (Royal Indigo / Violet Enterprise Edition) */}
      <img
        src="/trustpay-logo-light.png"
        alt="TrustPay Enterprise"
        className={`${fullSizeClasses[size]} w-auto object-contain block dark:hidden transition-all duration-300 drop-shadow-sm`}
        loading="eager"
      />

      {/* 2nd Image Logo: Dark Theme (Neon Lime Green / Obsidian Enterprise Edition PNG) */}
      <img
        src="/trustpay-logo-dark.png"
        alt="TrustPay Enterprise"
        className={`${fullSizeClasses[size]} w-auto object-contain hidden dark:block transition-all duration-300 dark:drop-shadow-[0_0_20px_rgba(139,255,36,0.35)]`}
        loading="eager"
      />
    </div>
  );
};
