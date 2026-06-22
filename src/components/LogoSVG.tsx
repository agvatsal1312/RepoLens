import React from 'react';

interface LogoSVGProps {
  className?: string;
}

export function LogoSVG({ className = "" }: LogoSVGProps) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Background Circle */}
      <circle cx="50" cy="50" r="45" fill="#E8DCD0" />
      
      {/* Back flap of folder */}
      <path d="M20 35C20 31 23 28 27 28H42L52 38H75C79 38 82 41 82 45V72C82 76 79 79 75 79H27C23 79 20 76 20 72V35Z" fill="#6F4627" />
      
      {/* Front flap of folder */}
      <path d="M20 45C20 41 23 38 27 38H75C79 38 82 41 82 45V72C82 76 79 79 75 79H27C23 79 20 76 20 72V45Z" fill="#F7EDE5" />
      
      {/* Code brackets */}
      <path d="M38 52L28 60L38 68" stroke="#6F4627" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M57 52L67 60L57 68" stroke="#6F4627" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M52 48L43 72" stroke="#6F4627" strokeWidth="4" strokeLinecap="round" />
      
      {/* Magnifying Glass Outer Circle */}
      <circle cx="70" cy="65" r="14" fill="#F7EDE5" stroke="#6F4627" strokeWidth="5" />
      
      {/* Glass reflections */}
      <path d="M63 58C65 55 69 55 72 56" stroke="#E8DCD0" strokeWidth="2.5" strokeLinecap="round" />
      
      {/* Magnifying Glass Handle */}
      <path d="M80 75L94 89" stroke="#6F4627" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}
