import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'full';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'compact' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={
          variant === 'full'
            ? 'w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white active:scale-[0.98] transition-transform hover:bg-emerald-800 whitespace-nowrap'
            : 'min-h-[40px] flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white active:scale-[0.98] transition-transform hover:bg-emerald-800 whitespace-nowrap shrink-0'
        }
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={
            variant === 'full'
              ? 'w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 active:scale-[0.98] transition-transform hover:bg-slate-50 whitespace-nowrap'
              : 'min-h-[40px] flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0'
          }
        >
          <Share className="w-3.5 h-3.5 shrink-0" />
          <span>Install</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4">
            <div className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl bg-white p-6 shadow-xl pb-safe">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Install TyreBook on iPhone</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close install instructions"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <ol className="mt-4 space-y-3 text-sm text-slate-700 list-decimal pl-5">
                <li>
                  Tap the <strong className="text-slate-900">Share</strong> icon in Safari at the bottom of your screen.
                </li>
                <li>
                  Scroll down and tap <strong className="text-slate-900">Add to Home Screen</strong>.
                </li>
                <li>
                  Tap <strong className="text-slate-900">Add</strong> so TyreBook works offline like a native app.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full min-h-[48px] rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white active:scale-[0.98] transition-transform"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
