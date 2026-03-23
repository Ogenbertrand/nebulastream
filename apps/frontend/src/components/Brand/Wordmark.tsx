import React from 'react';

type WordmarkSize = 'sm' | 'md' | 'lg';

interface WordmarkProps {
  size?: WordmarkSize;
  className?: string;
}

const sizeClasses: Record<WordmarkSize, string> = {
  sm: 'text-[10px] sm:text-xs',
  md: 'text-sm sm:text-base',
  lg: 'text-lg sm:text-xl lg:text-2xl',
};

const Wordmark: React.FC<WordmarkProps> = ({ size = 'md', className }) => {
  return (
    <span
      className={`nebula-wordmark nebula-wordmark--${size} ${sizeClasses[size]} ${
        className || ''
      }`}
    >
      <span className="nebula-wordmark__text">NEBULA</span>
      <span className="nebula-wordmark__text nebula-wordmark__text--accent">STREAM</span>
    </span>
  );
};

export default Wordmark;
