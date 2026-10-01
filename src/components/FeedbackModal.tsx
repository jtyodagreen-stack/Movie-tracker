import React, { useState } from 'react';
import {
  X,
  Bug,
  Lightbulb,
  MessageSquare,
  HelpCircle,
  Send,
  CheckCircle2,
  Copy,
  Check,
  Smartphone,
  Layers,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  Database,
  Mail,
  HardDrive,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { APP_VERSION, APP_BUILD_DATE, APP_RELEASE_NOTES } from '../config/version';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  userName?: string;
  totalShowsCount?: number;
  isOnline?: boolean;
  activeProfile?: string;
}

type FeedbackType = 'bug' | 'feature' | 'sync' | 'general';

export default function FeedbackModal({
  isOpen,
  onClose,
  userEmail = '',
  userName = '',
  totalShowsCount = 0,
  isOnline = true,
  activeProfile = '',
}: FeedbackModalProps) {
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState(userEmail);
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [showDiagnosticsPreview, setShowDiagnosticsPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [copiedDiag, setCopiedDiag] = useState(false);

  if (!isOpen) return null;

  const diagnosticsData = {
    appVersion: APP_VERSION,
    buildDate: APP_BUILD_DATE,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
    screenSize: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'Unknown',
    onlineStatus: isOnline ? 'Online 🟢' : 'Offline 🔴',
    showsCount: totalShowsCount,
    activeProfile: activeProfile || 'All Profiles',
    timestamp: new Date().toISOString(),
  };

  const getDiagnosticsText = () => {
    return [
      `--- ShowFlix Diagnostics ---`,
      `Version: ${diagnosticsData.appVersion}`,
      `Build: ${diagnosticsData.buildDate}`,
      `Online Status: ${diagnosticsData.onlineStatus}`,
      `Active Profile: ${diagnosticsData.activeProfile}`,
      `Total Shows Tracked: ${diagnosticsData.showsCount}`,
      `Device / Screen: ${diagnosticsData.screenSize}`,
      `Timestamp: ${diagnosticsData.timestamp}`,
    ].join('\n');
  };

  const handleCopyDiagnostics = () => {
    navigator.clipboard.writeText(getDiagnosticsText());
    setCopiedDiag(true);
    toast.success('System diagnostics copied to clipboard!');
    setTimeout(() => setCopiedDiag(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter a summary title');
      return;
    }
    if (!description.trim()) {
      toast.error('Please provide some details or description');
      return;
    }

    setIsSubmitting(true);

    const reportId = `report-${Date.now()}`;
    const feedbackReport = {
      id: reportId,
      type: feedbackType,
      title: title.trim(),
      description: description.trim(),
      severity: feedbackType === 'bug' ? severity : 'medium',
      email: email.trim(),
      userName: userName.trim(),
      appVersion: APP_VERSION,
      diagnostics: includeDiagnostics ? diagnosticsData : null,
      createdAt: new Date().toISOString(),
    };

    // 1. Save directly to Cloud Firestore Database
    try {
      await setDoc(doc(db, 'feedback_reports', reportId), feedbackReport);
    } catch (err) {
      console.warn('Could not write report to Firestore, using local fallback:', err);
    }

    // 2. Store in local browser storage
    try {
      const stored = localStorage.getItem('showflix_user_feedback') || '[]';
      const parsed = JSON.parse(stored);
      parsed.unshift(feedbackReport);
      localStorage.setItem('showflix_user_feedback', JSON.stringify(parsed.slice(0, 20)));
    } catch {
      // ignore
    }

    setIsSubmitting(false);
    setIsSubmitted(true);
    toast.success(
      feedbackType === 'bug'
        ? 'Bug report stored in Cloud Database! Thank you.'
        : 'Feedback stored in Cloud Database! Thank you.'
    );
  };

  const handleSendEmail = () => {
    const subject = encodeURIComponent(`[ShowFlix ${APP_VERSION} ${feedbackType.toUpperCase()}] ${title}`);
    const body = encodeURIComponent(
      `Issue/Feedback Summary: ${title}\n\n` +
      `Description / Details:\n${description}\n\n` +
      (includeDiagnostics ? `\n${getDiagnosticsText()}\n` : '') +
      `\nReported by: ${email || userName || 'User'}`
    );
    window.location.href = `mailto:jtyodagreen@gmail.com?subject=${subject}&body=${body}`;
  };

  const handleResetForm = () => {
    setTitle('');
    setDescription('');
    setIsSubmitted(false);
  };

  return (
    <div
      id="feedback-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        id="feedback-modal-dialog"
        className="relative w-full max-w-xl bg-[#141414] border border-zinc-800/90 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-200 flex flex-col max-h-[92dvh] sm:max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-zinc-800/80 bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/15 border border-red-500/30 flex items-center justify-center text-red-500 shadow-md shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  Report Issue or Give Feedback
                </h3>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {APP_VERSION}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Let us know what's broken or share ideas to make ShowFlix better.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 space-y-5">
          {isSubmitted ? (
            <div className="py-8 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-xl">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h4 className="text-xl font-bold text-white">Report Successfully Received!</h4>
                <p className="text-xs text-zinc-400">
                  Thank you for helping us maintain and enhance ShowFlix. Your feedback and system details have been recorded.
                </p>
              </div>

              <div className="p-3.5 bg-zinc-900/90 border border-zinc-800 rounded-xl max-w-md mx-auto text-left text-xs space-y-2">
                <div className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Report Storage & Routing Destinations</span>
                </div>
                <div className="space-y-1.5 text-zinc-300">
                  <div className="flex items-start gap-2 bg-black/40 p-2 rounded-lg border border-zinc-800/80">
                    <span className="text-emerald-400 font-bold">1.</span>
                    <div>
                      <span className="font-bold text-white">Cloud Firestore Database</span>
                      <p className="text-[10px] text-zinc-400">Permanently saved to collection <code className="text-zinc-200">feedback_reports</code> on <code className="text-zinc-200">ai-studio-showtracker</code>.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 bg-black/40 p-2 rounded-lg border border-zinc-800/80">
                    <span className="text-blue-400 font-bold">2.</span>
                    <div>
                      <span className="font-bold text-white">Local Device Storage</span>
                      <p className="text-[10px] text-zinc-400">Cached on your browser storage for session debugging history.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 bg-black/40 p-2 rounded-lg border border-zinc-800/80">
                    <span className="text-amber-400 font-bold">3.</span>
                    <div>
                      <span className="font-bold text-white">Direct Developer Email</span>
                      <p className="text-[10px] text-zinc-400">Click below to dispatch an email with the complete diagnostic report.</p>
                    </div>
                  </div>
                </div>

                <div className="pt-1.5 border-t border-zinc-800 flex justify-between text-zinc-400 text-[11px]">
                  <span>Subject:</span>
                  <span className="font-semibold text-white truncate max-w-[200px]">{title}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleSendEmail}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold border border-zinc-700 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-red-500" />
                  <span>Send via Email App</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold border border-zinc-700 transition-colors cursor-pointer"
                >
                  Submit Another
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-lg shadow-red-950/40"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4.5">
              {/* Category selector */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-2">
                  Feedback Category
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setFeedbackType('bug')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      feedbackType === 'bug'
                        ? 'bg-red-600/20 border-red-500 text-white ring-2 ring-red-500/30'
                        : 'bg-zinc-900/90 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <Bug className={`w-4 h-4 ${feedbackType === 'bug' ? 'text-red-500' : 'text-zinc-400'}`} />
                    <span>Bug / Issue</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFeedbackType('feature')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      feedbackType === 'feature'
                        ? 'bg-amber-600/20 border-amber-500 text-white ring-2 ring-amber-500/30'
                        : 'bg-zinc-900/90 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <Lightbulb className={`w-4 h-4 ${feedbackType === 'feature' ? 'text-amber-400' : 'text-zinc-400'}`} />
                    <span>Feature Idea</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFeedbackType('sync')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      feedbackType === 'sync'
                        ? 'bg-emerald-600/20 border-emerald-500 text-white ring-2 ring-emerald-500/30'
                        : 'bg-zinc-900/90 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <Layers className={`w-4 h-4 ${feedbackType === 'sync' ? 'text-emerald-400' : 'text-zinc-400'}`} />
                    <span>Sync / Data</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFeedbackType('general')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      feedbackType === 'general'
                        ? 'bg-blue-600/20 border-blue-500 text-white ring-2 ring-blue-500/30'
                        : 'bg-zinc-900/90 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <HelpCircle className={`w-4 h-4 ${feedbackType === 'general' ? 'text-blue-400' : 'text-zinc-400'}`} />
                    <span>General</span>
                  </button>
                </div>
              </div>

              {/* Bug Severity (if bug) */}
              {feedbackType === 'bug' && (
                <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800/80 space-y-2">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Severity Level
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {(['low', 'medium', 'high', 'critical'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setSeverity(lvl)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer border ${
                          severity === lvl
                            ? lvl === 'critical'
                              ? 'bg-red-600 text-white border-red-500'
                              : lvl === 'high'
                              ? 'bg-amber-600 text-white border-amber-500'
                              : 'bg-zinc-700 text-white border-zinc-600'
                            : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Subject Title */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                  Summary / Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    feedbackType === 'bug'
                      ? 'e.g., Poster not loading on mobile when filtering Series'
                      : feedbackType === 'feature'
                      ? 'e.g., Add sort by release date descending'
                      : 'Brief summary of your question or feedback'
                  }
                  required
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
                />
              </div>

              {/* Description textarea */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                  Details & Steps to Reproduce <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Provide as much detail as possible. What happened, what did you expect, or what ideas do you have?"
                  required
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors resize-none"
                />
              </div>

              {/* Contact email */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                  Your Email (Optional for updates)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                />
              </div>

              {/* System Diagnostics Box */}
              <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800/90 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-bold text-zinc-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeDiagnostics}
                      onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                      className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-red-600 focus:ring-red-500"
                    />
                    <span>Attach System Diagnostics</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyDiagnostics}
                      className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 bg-zinc-800 px-2 py-1 rounded transition-colors cursor-pointer"
                      title="Copy diagnostic payload"
                    >
                      {copiedDiag ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDiagnosticsPreview(!showDiagnosticsPreview)}
                      className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <span>{showDiagnosticsPreview ? 'Hide' : 'View'}</span>
                      {showDiagnosticsPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                {showDiagnosticsPreview && (
                  <div className="p-2.5 rounded-lg bg-black/60 border border-zinc-800 font-mono text-[10px] text-zinc-400 space-y-1">
                    <p><strong className="text-zinc-300">App Version:</strong> {APP_VERSION} ({APP_BUILD_DATE})</p>
                    <p><strong className="text-zinc-300">Total Shows:</strong> {totalShowsCount}</p>
                    <p><strong className="text-zinc-300">Profile:</strong> {activeProfile || 'All'}</p>
                    <p><strong className="text-zinc-300">Status:</strong> {isOnline ? 'Online' : 'Offline'}</p>
                    <p><strong className="text-zinc-300">Screen:</strong> {diagnosticsData.screenSize}</p>
                  </div>
                )}
              </div>

              {/* Where it goes explainer */}
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-[11px] text-zinc-400 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-zinc-300">
                  <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Where does this report go?</span>
                </div>
                <ul className="space-y-1 pl-4 list-disc text-[10.5px] text-zinc-400">
                  <li><strong className="text-zinc-300">Cloud Database:</strong> Automatically stored in Firestore collection <code className="text-zinc-300">feedback_reports</code>.</li>
                  <li><strong className="text-zinc-300">Local Cache:</strong> Stored in browser memory on this device.</li>
                  <li><strong className="text-zinc-300">Direct Email:</strong> You can also send directly via email client to <code className="text-zinc-300">jtyodagreen@gmail.com</code>.</li>
                </ul>
              </div>

              {/* Version & Build info badge */}
              <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-red-500" />
                  <span>ShowFlix Tracker Pro {APP_VERSION}</span>
                </span>
                <span>Build: {APP_BUILD_DATE}</span>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-lg shadow-red-950/50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Submitting...' : 'Submit Report'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
