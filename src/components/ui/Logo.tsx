/**
 * Logo Component
 * Simple logo component for the VJ application
 */

import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12', 
    lg: 'h-16 w-16'
  };

  return (
    <div className={`${sizeClasses[size]} ${className} flex items-center justify-center bg-gradient-to-r from-v1z3r-primary to-v1z3r-secondary rounded-lg text-white font-bold`}>
      <span className="text-xl">V1</span>
    </div>
  );
};

export default Logo;