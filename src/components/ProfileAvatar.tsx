import { useState, useEffect } from 'react';
import { getProfilePicture, GOOGLE_AVATAR_DATA_URI } from '../utils/userProfile';

interface ProfileAvatarProps {
  photoURL?: string | null;
  name?: string;
  className?: string;
  sizeClassName?: string;
  alt?: string;
  id?: string;
}

export default function ProfileAvatar({
  photoURL,
  name = 'Profile picture',
  className = '',
  sizeClassName = 'w-8 h-8 sm:w-9 sm:h-9',
  alt = 'Profile Picture',
  id,
}: ProfileAvatarProps) {
  const targetSrc = getProfilePicture({ photoURL });
  const [imgSrc, setImgSrc] = useState<string>(targetSrc);

  useEffect(() => {
    setImgSrc(targetSrc);
  }, [targetSrc]);

  return (
    <img
      id={id}
      src={imgSrc}
      alt={alt || name}
      className={`${sizeClassName} rounded-full object-cover ring-1 ring-white/20 transition-all ${className}`}
      referrerPolicy="no-referrer"
      onError={() => {
        if (imgSrc !== GOOGLE_AVATAR_DATA_URI) {
          setImgSrc(GOOGLE_AVATAR_DATA_URI);
        }
      }}
    />
  );
}
