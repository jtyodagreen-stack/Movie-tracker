import React, { useState } from 'react';
import { findAvatarOption } from '../utils/profileAvatars';

interface NetflixAvatarIconProps {
  avatarId?: string;
  name?: string;
  sizeClassName?: string;
  className?: string;
  bgColor?: string;
}

export default function NetflixAvatarIcon({
  avatarId,
  name,
  sizeClassName = 'w-16 h-16',
  className = '',
  bgColor,
}: NetflixAvatarIconProps) {
  const [imageError, setImageError] = useState(false);

  // If avatarId is a direct image URL or data URL and not errored
  if (avatarId && (avatarId.startsWith('data:image') || avatarId.startsWith('http')) && !imageError) {
    return (
      <div className={`relative rounded-2xl overflow-hidden shadow-lg ${sizeClassName} ${className}`}>
        <img
          src={avatarId}
          alt={name || 'Profile Avatar'}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  const option = findAvatarOption(avatarId);

  // If classic Netflix smile
  if (option.svgOrEmoji === 'face-smile' || imageError) {
    return (
      <div
        className={`relative rounded-2xl flex items-center justify-center bg-gradient-to-br ${option.bgGradient} shadow-lg overflow-hidden select-none ${sizeClassName} ${className}`}
        style={bgColor ? { backgroundColor: bgColor } : undefined}
      >
        {/* Stylized Netflix Smiley Icon */}
        <svg
          viewBox="0 0 100 100"
          className="w-[65%] h-[65%] fill-white drop-shadow-sm opacity-95"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Eyes */}
          <circle cx="32" cy="36" r="6.5" />
          <circle cx="68" cy="36" r="6.5" />
          {/* Cute Smile Arc */}
          <path
            d="M 28 58 Q 50 82 72 58"
            stroke="white"
            strokeWidth="8"
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>
      </div>
    );
  }

  // Emoji / Icon Avatar
  return (
    <div
      className={`relative rounded-2xl flex items-center justify-center bg-gradient-to-br ${option.bgGradient} shadow-lg text-2xl sm:text-3xl select-none ${sizeClassName} ${className}`}
      style={bgColor ? { backgroundColor: bgColor } : undefined}
    >
      <span className="drop-shadow-md transform transition-transform group-hover:scale-110">
        {option.svgOrEmoji}
      </span>
    </div>
  );
}
