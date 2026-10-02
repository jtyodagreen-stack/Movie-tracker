import React from 'react';
import { NETFLIX_AVATARS } from '../utils/profileAvatars';

interface NetflixAvatarIconProps {
  avatarId: string;
  name?: string;
  bgColor?: string;
  sizeClassName?: string;
  className?: string;
}

export default function NetflixAvatarIcon({
  avatarId,
  name = 'Viewer',
  bgColor,
  sizeClassName = 'w-12 h-12',
  className = '',
}: NetflixAvatarIconProps) {
  // Find background color from preset if not provided
  const preset = NETFLIX_AVATARS.find((a) => a.id === avatarId);
  const resolvedBgColor = bgColor || preset?.bgColor || '#E50914';

  // Return custom themed SVGs representing high-quality Netflix profile faces
  const renderAvatarContent = () => {
    switch (avatarId) {
      case 'retro-gamer':
        return (
          <>
            {/* 8-bit/Pixel Retro Sunglasses */}
            <g transform="translate(0, 4)">
              {/* Glasses frame */}
              <rect x="18" y="32" width="26" height="14" rx="1" fill="#111" />
              <rect x="56" y="32" width="26" height="14" rx="1" fill="#111" />
              <rect x="44" y="35" width="12" height="6" fill="#111" />
              {/* Glass reflection */}
              <rect x="22" y="35" width="6" height="6" fill="#FFF" />
              <rect x="60" y="35" width="6" height="6" fill="#FFF" />
            </g>
            {/* Pixel Smirk */}
            <path
              d="M 32 64 H 44 V 68 H 32 Z M 44 64 H 56 V 68 H 44 Z M 56 60 H 64 V 64 H 56 Z"
              fill="#FFF"
            />
          </>
        );

      case 'cinema-buff':
        return (
          <>
            {/* 3D Glasses */}
            <g transform="translate(0, 2)">
              {/* Frame bridge */}
              <rect x="44" y="34" width="12" height="6" fill="#FFFFFF" />
              {/* Left Lens (Red) */}
              <rect x="16" y="28" width="28" height="20" rx="4" fill="#EF4444" stroke="#FFFFFF" strokeWidth="3" />
              <rect x="20" y="32" width="8" height="8" fill="#FFF" opacity="0.4" />
              {/* Right Lens (Cyan) */}
              <rect x="56" y="28" width="28" height="20" rx="4" fill="#06B6D4" stroke="#FFFFFF" strokeWidth="3" />
              <rect x="60" y="32" width="8" height="8" fill="#FFF" opacity="0.4" />
              {/* Temples */}
              <path d="M 16 35 L 5 32" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
              <path d="M 84 35 L 95 32" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
            </g>
            {/* Happy opened mouth */}
            <path d="M 35 60 Q 50 76 65 60" stroke="#FFFFFF" strokeWidth="5.5" strokeLinecap="round" fill="none" />
          </>
        );

      case 'sci-fi-fan':
        return (
          <>
            {/* Cyborg Visor */}
            <rect x="12" y="30" width="76" height="18" rx="4" fill="#00E5FF" stroke="#00838F" strokeWidth="2" />
            {/* Visor shine */}
            <path d="M 18 33 H 50 L 46 45 H 14 Z" fill="#FFF" opacity="0.6" />
            {/* Visor laser point */}
            <circle cx="72" cy="39" r="4" fill="#FF1744" className="animate-ping" />
            <circle cx="72" cy="39" r="2.5" fill="#FF1744" />
            {/* Tech details */}
            <rect x="25" y="15" width="50" height="4" rx="1" fill="#374151" />
            <rect x="42" y="10" width="16" height="5" fill="#00E5FF" opacity="0.8" />
            {/* Robot Smile */}
            <path d="M 30 62 H 70" stroke="#00E5FF" strokeWidth="4" strokeLinecap="round" />
            <path d="M 35 56 V 68 M 45 56 V 68 M 55 56 V 68 M 65 56 V 68" stroke="#00838F" strokeWidth="2" />
          </>
        );

      case 'spooky-ghost':
        return (
          <>
            {/* Cute Ghost Head / Shape */}
            <path
              d="M 20 80 V 42 C 20 22 80 22 80 42 V 80 L 70 72 L 60 80 L 50 72 L 40 80 L 30 72 Z"
              fill="#FFF"
              opacity="0.9"
            />
            {/* Big Black Eyes */}
            <circle cx="38" cy="42" r="6" fill="#111" />
            <circle cx="62" cy="42" r="6" fill="#111" />
            {/* Eye highlights */}
            <circle cx="36" cy="40" r="2" fill="#FFF" />
            <circle cx="60" cy="40" r="2" fill="#FFF" />
            {/* Wavy mouth */}
            <path
              d="M 44 56 Q 50 50 56 56"
              stroke="#111"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
            />
          </>
        );

      case 'detective':
        return (
          <>
            {/* Detective Fedora Hat */}
            <path d="M 12 30 C 12 30 20 5 50 5 C 80 5 88 30 88 30 Z" fill="#1F2937" />
            {/* Hat ribbon */}
            <path d="M 18 25 C 18 25 24 18 50 18 C 76 18 82 25 82 25 Z" fill="#EF4444" />
            {/* Hat brim */}
            <ellipse cx="50" cy="30" rx="44" ry="4" fill="#111" />
            
            {/* Cool Spy Glasses */}
            <path d="M 22 44 Q 36 50 48 44 M 52 44 Q 64 50 78 44" stroke="#FFF" strokeWidth="6" strokeLinecap="round" fill="none" />
            {/* Detective Moustache */}
            <path d="M 32 62 Q 50 54 68 62 Q 50 68 32 62" fill="#111" />
          </>
        );

      case 'chef':
        return (
          <>
            {/* Tall Chef Hat */}
            <path
              d="M 35 25 C 28 20 28 5 42 7 C 45 2 55 2 58 7 C 72 5 72 20 65 25 Z"
              fill="#FFFFFF"
              stroke="#E5E7EB"
              strokeWidth="2"
            />
            <rect x="36" y="22" width="28" height="8" rx="1" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="1.5" />
            
            {/* Happy Eyes */}
            <path d="M 26 44 Q 36 36 42 44" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" fill="none" />
            {/* Happy Eyes Right */}
            <path d="M 58 44 Q 64 36 74 44" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" fill="none" />
            
            {/* Chef Moustache */}
            <path d="M 36 56 C 42 52 48 54 50 56 C 52 54 58 52 64 56 C 68 60 62 62 50 59 C 38 62 32 60 36 56" fill="#FFF" />
          </>
        );

      case 'classic-blue':
        return (
          <>
            {/* Cool Winking profile */}
            {/* Left Eye (Closed / wink) */}
            <path d="M 22 38 Q 32 46 42 38" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" fill="none" />
            {/* Right Eye */}
            <rect x="58" y="30" width="14" height="14" rx="4" fill="#FFFFFF" />
            {/* Big smile */}
            <path d="M 24 56 Q 50 82 76 56" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" fill="none" />
          </>
        );

      case 'classic-green':
        return (
          <>
            {/* Surprised / Cute Wide Eyes */}
            <circle cx="32" cy="36" r="8" fill="#FFFFFF" />
            <circle cx="68" cy="36" r="8" fill="#FFFFFF" />
            <circle cx="32" cy="36" r="3" fill="#111" />
            <circle cx="68" cy="36" r="3" fill="#111" />
            {/* Wide mouth */}
            <ellipse cx="50" cy="62" rx="14" ry="8" fill="#FFFFFF" />
          </>
        );

      case 'classic-yellow':
        return (
          <>
            {/* Sunglasses / Cool Look */}
            <path d="M 18 34 H 44 V 44 H 18 Z M 56 34 H 82 V 44 H 56 Z M 44 37 H 56 V 41 H 44 Z" fill="#111" />
            {/* Reflection on glasses */}
            <rect x="22" y="37" width="4" height="4" fill="#FFF" />
            <rect x="60" y="37" width="4" height="4" fill="#FFF" />
            {/* Confident Smirk */}
            <path d="M 34 60 Q 44 65 62 56" stroke="#FFFFFF" strokeWidth="5.5" strokeLinecap="round" fill="none" />
          </>
        );

      case 'classic-purple':
        return (
          <>
            {/* Sleeping / Relaxed profile */}
            {/* Eyes closed */}
            <path d="M 20 36 Q 30 42 40 36" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" fill="none" />
            <path d="M 60 36 Q 70 42 80 36" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" fill="none" />
            {/* Small smile */}
            <path d="M 36 58 Q 50 68 64 58" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" fill="none" />
          </>
        );

      case 'classic-pink':
        return (
          <>
            {/* Laughing / Starry profile */}
            {/* Eyes squinting */}
            <path d="M 22 32 L 36 40 L 22 48" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M 78 32 L 64 40 L 78 48" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            {/* Big open laugh */}
            <path d="M 28 58 Q 50 82 72 58 Z" fill="#FFFFFF" />
          </>
        );

      case 'classic-red':
      default:
        return (
          <>
            {/* Classic Netflix Smile Face */}
            <rect x="24" y="32" width="14" height="14" rx="4" fill="#FFFFFF" />
            <rect x="62" y="32" width="14" height="14" rx="4" fill="#FFFFFF" />
            <path d="M 24 58 Q 50 84 76 58" stroke="#FFFFFF" strokeWidth="7.5" strokeLinecap="round" fill="none" />
          </>
        );
    }
  };

  // Extract initial / display name if no custom avatar matches or as label
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <div
      className={`relative inline-block overflow-hidden rounded-2xl select-none ${sizeClassName} ${className}`}
      style={{ backgroundColor: resolvedBgColor }}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full object-cover"
        xmlns="http://www.w3.org/2000/svg"
      >
        {renderAvatarContent()}
      </svg>
    </div>
  );
}
