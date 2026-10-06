import React, { useState, useEffect } from 'react';
import { X, Camera, RefreshCw, Link2, Upload, Trash2, CheckCircle2, ExternalLink } from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  getEffectiveUserPhoto,
  updateUserProfilePhoto,
  fetchGoogleAccountPhoto,
  googleSignIn,
} from '../firebase';

interface EditProfilePhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onPhotoUpdated: (newPhotoURL: string | null) => void;
}

export default function EditProfilePhotoModal({
  isOpen,
  onClose,
  user,
  onPhotoUpdated,
}: EditProfilePhotoModalProps) {
  const currentPhoto = getEffectiveUserPhoto(user);
  const [photoInput, setPhotoInput] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentPhoto);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    if (isOpen) {
      const active = getEffectiveUserPhoto(user);
      setPreviewUrl(active);
      setPhotoInput(active || '');
      setStatusMsg(null);
      // Save current scroll position
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
    } else {
      // Restore scroll position
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const handleUrlChange = (val: string) => {
    setPhotoInput(val);
    if (!val.trim()) {
      setPreviewUrl(null);
      return;
    }
    // Reject unavatar
    if (val.includes('unavatar.io')) {
      setStatusMsg({ type: 'error', text: 'Please use your direct Google profile image address.' });
      return;
    }
    setPreviewUrl(val.trim());
    setStatusMsg(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setStatusMsg({ type: 'error', text: 'Please choose an image file (PNG, JPG, WebP).' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setStatusMsg({ type: 'error', text: 'Image size should be under 2MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setPreviewUrl(base64);
      setPhotoInput(base64);
      setStatusMsg(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSyncWithGoogle = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      // 1. Reload current Firebase Auth user first
      let pic = await fetchGoogleAccountPhoto(user);
      if (pic && !pic.includes('unavatar.io')) {
        setPreviewUrl(pic);
        setPhotoInput(pic);
        onPhotoUpdated(pic);
        setStatusMsg({ type: 'success', text: 'Google Account profile picture synced successfully!' });
        setLoading(false);
        return;
      }

      // 2. Re-trigger Google OAuth to refresh credentials
      const result = await googleSignIn();
      if (result?.user) {
        const freshPhoto = getEffectiveUserPhoto(result.user);
        if (freshPhoto && !freshPhoto.includes('unavatar.io')) {
          setPreviewUrl(freshPhoto);
          setPhotoInput(freshPhoto);
          onPhotoUpdated(freshPhoto);
          setStatusMsg({ type: 'success', text: 'Google Account photo retrieved and applied!' });
          setLoading(false);
          return;
        }
      }

      setStatusMsg({
        type: 'error',
        text: 'Google did not return a public picture. You can copy & paste your picture address from Google Personal Info below.',
      });
    } catch (err: any) {
      console.warn('Sync photo error:', err);
      setStatusMsg({
        type: 'error',
        text: 'Could not sync automatically. You can copy & paste your picture URL from Google Personal Info below.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const targetPhoto = previewUrl?.trim() || '';
      if (targetPhoto.includes('unavatar.io')) {
        setStatusMsg({ type: 'error', text: 'Please provide a valid image link.' });
        setLoading(false);
        return;
      }

      const success = await updateUserProfilePhoto(user, targetPhoto);
      if (success) {
        onPhotoUpdated(targetPhoto);
        setStatusMsg({ type: 'success', text: 'Profile picture saved!' });
        setTimeout(() => {
          onClose();
        }, 600);
      } else {
        setStatusMsg({ type: 'error', text: 'Failed to update photo. Please check the URL.' });
      }
    } catch {
      setStatusMsg({ type: 'error', text: 'Failed to save changes.' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetToDefault = async () => {
    setLoading(true);
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('bingebox_user_profile');
      }
      setPreviewUrl(null);
      setPhotoInput('');
      onPhotoUpdated(null);
      setStatusMsg({ type: 'success', text: 'Reset to default avatar.' });
    } catch {
      setStatusMsg({ type: 'error', text: 'Failed to reset avatar.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-photo-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md bg-[#181818] border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-red-500" />
            <h2 id="profile-photo-modal-title" className="text-base font-bold text-white">
              Google Account Profile Picture
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Message */}
        {statusMsg && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
              statusMsg.type === 'success'
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                : 'bg-red-950/80 text-red-300 border border-red-500/40'
            }`}
          >
            {statusMsg.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Current Avatar & Live Preview */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-900 border border-zinc-800/80">
          <div className="relative">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Profile Preview"
                className="w-16 h-16 rounded-full object-cover ring-2 ring-red-500 shadow-lg"
                referrerPolicy="no-referrer"
                onError={() => {
                  setPreviewUrl(null);
                  setStatusMsg({
                    type: 'error',
                    text: 'Image failed to load. Please verify the URL or try uploading a file.',
                  });
                }}
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-red-600 text-white font-black text-2xl flex items-center justify-center shadow-lg">
                {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white truncate">
              {user.displayName || 'Google Account'}
            </p>
            <p className="text-xs text-zinc-400 truncate">{user.email}</p>
            <p className="text-[11px] text-zinc-500 mt-1">
              {previewUrl ? 'Custom / Google Picture Active' : 'Default Showflix Initial Avatar'}
            </p>
          </div>
        </div>

        {/* Option 1: Live Sync from Google */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            <span>Automatic Sync</span>
          </label>
          <button
            type="button"
            onClick={handleSyncWithGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded-lg border border-zinc-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-emerald-400 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Connecting to Google...' : 'Sync Fresh Picture from Google'}</span>
          </button>
        </div>

        {/* Option 2: Paste Google Picture URL directly */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Paste Google Photo Address</span>
            </label>
            <a
              href="https://myaccount.google.com/personal-info?utm_source=OGB&utm_medium=act&hl=en_GB"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 underline underline-offset-2"
            >
              <span>Google Personal Info</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <input
            type="url"
            value={photoInput}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://lh3.googleusercontent.com/..."
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 transition-colors"
          />
          <p className="text-[10px] text-zinc-400 leading-relaxed">
            On your Google personal info page, right-click your profile picture and choose{' '}
            <strong className="text-zinc-200">"Copy image address"</strong>, then paste it here and click Apply.
          </p>
        </div>

        {/* Option 3: Upload from Device */}
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 text-xs font-medium text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 px-3 py-2 rounded-lg cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5 text-zinc-400" />
            <span>Upload File</span>
            <input
              type="file"
              accept="image/png, image/jpeg, image/webp"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {previewUrl && (
            <button
              type="button"
              onClick={handleResetToDefault}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-2 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset Avatar</span>
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 border-t border-zinc-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="px-5 py-2 text-xs font-bold bg-[red-600] hover:bg-[red-700] text-white rounded-lg shadow transition-colors disabled:opacity-50 cursor-pointer"
          >
            Apply Picture
          </button>
        </div>
      </div>
    </div>
  );
}
