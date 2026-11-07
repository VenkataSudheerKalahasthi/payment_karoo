import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('trustpay_theme') as 'dark' | 'light' | null;
    const initial = saved || (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    setTheme(initial);
    if (initial === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('trustpay_theme', next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
      aria-label="Toggle theme"
      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-90 ${
        theme === 'dark'
          ? 'bg-white/5 hover:bg-white/10 text-[#E8ECF5] hover:text-[#8FB5FF] border border-[#272B38] shadow-sm'
          : 'bg-black/5 hover:bg-black/10 text-[#242424] hover:text-[#2563EB] border border-black/10 shadow-sm'
      } ${className}`}
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 text-[#E8ECF5] hover:text-[#8FB5FF] transition-colors" />
      ) : (
        <Moon className="w-4 h-4 text-[#242424] hover:text-[#2563EB] transition-colors" />
      )}
    </button>
  );
};
