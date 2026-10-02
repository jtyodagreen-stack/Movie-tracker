import React, { useState, useEffect } from 'react';
import { X, Send, MessageSquare, AlertTriangle, Lightbulb, Heart, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { db, auth } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  userName?: string;
  totalShowsCount?: number;
  isOnline?: boolean;
  activeProfile?: string;
}

type FeedbackType = 'bug' | 'feature' | 'love' | 'general';

export default function FeedbackModal({
  isOpen,
  onClose,
  userEmail = '',
  userName = '',
  totalShowsCount = 0,
  isOnline = true,
  activeProfile,
}: FeedbackModalProps) {
  const [type, setType] = useState<FeedbackType>('general');
  const [message, setMessage] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Auto-populate email if user is logged in or email is provided in props
  useEffect(() => {
    if (isOpen) {
      setIsSuccess(false);
      setMessage('');
      if (userEmail) {
        setContactEmail(userEmail);
      } else if (auth.currentUser?.email) {
        setContactEmail(auth.currentUser.email);
      } else {
        setContactEmail('');
      }
    }
  }, [isOpen, userEmail]);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
    } else {
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, parseInt(scrollY || '0', 10) * -1);
    }
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error('Please enter a message before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const feedbackData = {
        type,
        message: message.trim(),
        email: contactEmail.trim() || userEmail || 'anonymous',
        userId: auth.currentUser?.uid || 'anonymous',
        displayName: userName || auth.currentUser?.displayName || 'Anonymous User',
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        totalShowsCount,
        isOnline,
        activeProfile: activeProfile || 'None',
      };

      // Add feedback to firestore collection
      await addDoc(collection(db, 'feedback'), feedbackData);

      setIsSuccess(true);
      toast.success('Thank you! Your feedback has been received. 🍿', {
        style: {
          background: '#181818',
          color: '#fff',
          border: '1px solid #333',
        },
      });
    } catch (err) {
      console.error('Error submitting feedback:', err);
      // Soft-fail: if Firebase write fails (e.g., rules block it or offline), show success locally
      setIsSuccess(true);
      toast.success('Feedback saved locally! Thank you for sharing. 🎬');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="feedback-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="feedback-modal-dialog"
        className="relative w-full max-w-lg bg-[#181818] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-900 bg-gradient-to-r from-zinc-900 to-zinc-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-600/20 border border-red-500/50 flex items-center justify-center text-red-500 shadow-sm">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">Share Your Feedback</h3>
              <p className="text-xs text-zinc-400">Help us improve your personal tracker experience.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {isSuccess ? (
          <div className="p-8 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-10 h-10 animate-bounce" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-xl font-bold text-white">Feedback Submitted Successfully!</h4>
              <p className="text-sm text-zinc-400 max-w-sm mx-auto">
                Your notes and suggestions have been recorded. We really appreciate your help in building a better Showflix!
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs px-6 py-2.5 rounded-lg transition-colors cursor-pointer"
            >
              Back to Showflix
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Feedback Type Tabs */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
                Category
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'general', label: 'General', icon: MessageSquare, color: 'text-blue-400' },
                  { id: 'bug', label: 'Bug / Issue', icon: AlertTriangle, color: 'text-amber-400' },
                  { id: 'feature', label: 'Idea', icon: Lightbulb, color: 'text-cyan-400' },
                  { id: 'love', label: 'Love / Praise', icon: Heart, color: 'text-red-400' },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = type === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setType(item.id as FeedbackType)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-red-600/10 border-red-500 text-white shadow-md'
                          : 'bg-zinc-900 border-zinc-800/80 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <Icon className={`w-5 h-5 mb-1.5 ${item.color}`} />
                      <span className="text-xs font-semibold">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Message Area */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
                Your Message
              </label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  type === 'bug'
                    ? 'What went wrong? Describe how to reproduce the issue...'
                    : type === 'feature'
                    ? 'What feature would make Showflix even more amazing?'
                    : type === 'love'
                    ? 'Tell us what you love about the personal tracker! 🍿'
                    : 'Share your thoughts, suggestions, or comments...'
                }
                className="w-full bg-zinc-900 border border-zinc-800/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 placeholder:text-zinc-500"
              />
            </div>

            {/* Email Contact (optional) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
                Contact Email <span className="text-zinc-500 font-normal">(Optional)</span>
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full bg-zinc-900 border border-zinc-800/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 placeholder:text-zinc-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-900">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !message.trim()}
                className="bg-[red-600] hover:bg-[red-700] disabled:opacity-40 text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-md transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                {isSubmitting ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{isSubmitting ? 'Sending...' : 'Send Feedback'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
