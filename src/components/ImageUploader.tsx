import React, { useState } from 'react';
import { Link as LinkIcon, Trash2, Check, ExternalLink, Sparkles, Image as ImageIcon } from 'lucide-react';

interface ImageUploaderProps {
  label: string;
  description?: string;
  currentUrl?: string;
  aspectRatio?: 'poster' | 'backdrop';
  onImageSelected: (url: string) => void;
  onImageRemoved?: () => void;
}

export default function ImageUploader({
  label,
  description,
  currentUrl,
  aspectRatio = 'poster',
  onImageSelected,
  onImageRemoved,
}: ImageUploaderProps) {
  const [urlInput, setUrlInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedNotification, setCopiedNotification] = useState(false);

  const handleApplyUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;

    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setErrorMessage('Please enter a valid web URL starting with https:// or http://');
      return;
    }

    setErrorMessage(null);
    onImageSelected(trimmed);
    setUrlInput('');
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
          setUrlInput(text.trim());
          onImageSelected(text.trim());
          setErrorMessage(null);
          setCopiedNotification(true);
          setTimeout(() => setCopiedNotification(false), 2000);
        } else {
          setErrorMessage('Clipboard does not contain a valid web URL (must start with https://)');
        }
      } else {
        setErrorMessage('Clipboard access not supported in this browser. Please paste into the box.');
      }
    } catch {
      setErrorMessage('Could not access clipboard. Please paste manually into the text field.');
    }
  };

  return (
    <div className="space-y-3 p-3.5 bg-zinc-900/80 border border-zinc-800 rounded-lg">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
            <LinkIcon className="w-3.5 h-3.5 text-[#E50914]" />
            <span>{label}</span>
          </label>
          {description && <p className="text-[11px] text-zinc-400 mt-0.5">{description}</p>}
        </div>
      </div>

      {/* Web Image URL Input Field */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApplyUrl();
                }
              }}
              placeholder="https://m.media-amazon.com/images/... or poster image URL"
              className="w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-base text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#E50914] transition-colors"
            />
          </div>

          <button
            type="button"
            onClick={handleApplyUrl}
            className="bg-[#E50914] hover:bg-[#B80710] text-white text-xs px-3.5 py-2 rounded-md font-semibold transition-colors shrink-0 shadow-sm"
          >
            Apply URL
          </button>

          <button
            type="button"
            onClick={handlePasteFromClipboard}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs px-2.5 py-2 rounded-md border border-zinc-700 transition-colors shrink-0"
            title="Paste URL from Clipboard"
          >
            Paste
          </button>
        </div>

        {copiedNotification && (
          <p className="text-xs text-emerald-400 font-medium">✓ Pasted URL from clipboard!</p>
        )}

        <div className="flex items-center justify-between text-[11px] text-zinc-400 flex-wrap gap-1">
          <p>
            Paste any direct image URL (from IMDb, TMDB, Wikipedia, or Amazon).
          </p>
        </div>
      </div>

      {/* Error display */}
      {errorMessage && (
        <p className="text-xs text-red-400 font-medium bg-red-950/30 border border-red-900/50 p-2 rounded">
          {errorMessage}
        </p>
      )}

      {/* Preview of Current Selected Image */}
      {currentUrl && (
        <div className="flex items-center gap-3 pt-2 border-t border-zinc-800">
          <div
            className={`relative rounded border border-zinc-700 overflow-hidden bg-zinc-950 flex-shrink-0 shadow-md ${
              aspectRatio === 'poster' ? 'w-12 h-16' : 'w-24 h-14'
            }`}
          >
            <img
              src={currentUrl}
              alt="Poster Preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=300&auto=format&fit=crop';
              }}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>Web Image Active</span>
            </div>
            <p className="text-[10px] text-zinc-400 truncate mt-0.5 font-mono" title={currentUrl}>
              {currentUrl}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const inputEl = document.querySelector('input[type="url"]') as HTMLInputElement;
                if (inputEl) inputEl.focus();
              }}
              className="text-xs text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1.5 rounded-md border border-zinc-700 transition-colors cursor-pointer"
              title="Replace image URL"
            >
              Replace
            </button>
            {onImageRemoved && (
              <button
                type="button"
                onClick={onImageRemoved}
                className="text-xs text-red-400 hover:text-red-300 bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1.5 rounded-md border border-zinc-700 transition-colors flex items-center gap-1 cursor-pointer"
                title="Remove image"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
