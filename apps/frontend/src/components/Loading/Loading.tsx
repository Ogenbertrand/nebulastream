import React from 'react';
import { Film } from 'lucide-react';

interface LoadingProps {
  fullScreen?: boolean;
  message?: string;
}

const Loading: React.FC<LoadingProps> = ({ fullScreen = false, message = 'Loading...' }) => {
  const content = (
    <div className="flex flex-col items-center justify-center space-y-5">
      <div className="relative">
        <div className="w-20 h-20 rounded-full border border-white/10 bg-dark-900/60 backdrop-blur-xl" />
        <div className="absolute inset-2 rounded-full border-2 border-nebula-500/40 border-t-nebula-500 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Film className="w-7 h-7 text-nebula-500" />
        </div>
        <div className="absolute -inset-4 rounded-full bg-nebula-500/10 blur-2xl" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-white/70 text-sm uppercase tracking-[0.3em]">Loading</p>
        <p className="text-white/50 text-sm">{message}</p>
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">{content}</div>
    );
  }

  return <div className="py-12 flex items-center justify-center">{content}</div>;
};

export default Loading;
