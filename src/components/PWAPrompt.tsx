import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Bell, X, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function PWAPrompt() {
  const { language, t } = useAuth();
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(true); // default to true so it doesn't flash
  const [needsNotification, setNeedsNotification] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  const [showInstallInstructions, setShowInstallInstructions] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setShowPrompt(false);
        localStorage.setItem('pwaPromptDismissed', 'true');
      }
    };
    if (showPrompt) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showPrompt]);

  useEffect(() => {
    // Check if dismissed previously
    if (localStorage.getItem('pwaPromptDismissed') === 'true') {
      return;
    }

    // Check if running as standalone PWA
    const mqStandAlone = window.matchMedia('(display-mode: standalone)');
    setIsStandalone(mqStandAlone.matches);
    
    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    // Track beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!mqStandAlone.matches) setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check notifications
    if ('Notification' in window && Notification.permission !== 'granted') {
      setNeedsNotification(true);
      setShowPrompt(true);
    } else if (!mqStandAlone.matches) {
      setShowPrompt(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        if (!needsNotification) setShowPrompt(false);
      }
    } else {
       setShowInstallInstructions(true);
    }
  };

  const handleNotificationClick = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNeedsNotification(false);
        if (isStandalone) setShowPrompt(false);
      }
    }
  };

  if (!showPrompt) return null;
  if (isStandalone && !needsNotification) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={popupRef}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-[80px] left-4 right-4 z-[100] md:bottom-6 md:left-auto md:right-6 md:w-96 glass-dark border border-amber-500/30 rounded-3xl p-5 shadow-2xl flex flex-col gap-4"
      >
        <button 
          onClick={() => {
            setShowPrompt(false);
            localStorage.setItem('pwaPromptDismissed', 'true');
          }}
          className="absolute top-4 right-4 p-1 glass rounded-full opacity-60 hover:opacity-100"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-3 text-amber-500">
          <Info size={24} />
          <h4 className="font-black tracking-tighter uppercase text-sm">
            {t.enableFullExperience}
          </h4>
        </div>

        <p className="text-xs text-theme-white/70 font-semibold leading-relaxed">
          {t.fullExperienceDesc}
        </p>

        <div className="flex flex-col gap-2 mt-2">
          {showInstallInstructions ? (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl"
            >
              <p className="text-sm font-bold text-blue-400 mb-2">
                {t.howToInstall}
              </p>
              <p className="text-xs text-theme-white/80 leading-relaxed whitespace-pre-line">
                {isIOS 
                  ? t.installIos
                  : t.installAndroid}
              </p>
            </motion.div>
          ) : !isStandalone && (
             <button
               onClick={handleInstallClick}
               className="bg-zinc-800 hover:bg-zinc-700 text-theme-white p-3 rounded-2xl flex items-center justify-between transition-colors text-xs font-bold uppercase tracking-widest"
             >
               <span className="flex items-center gap-2"><Download size={16} /> {t.installApp}</span>
               {isIOS && <span className="text-[10px] opacity-60 bg-[var(--theme-bg-body)] px-2 py-1 rounded-lg">iOS Info</span>}
             </button>
          )}

          {needsNotification && (
             <button
               onClick={handleNotificationClick}
               className="bg-amber-500 text-theme-black p-3 rounded-2xl flex items-center gap-2 hover:bg-amber-400 transition-colors text-xs font-black uppercase tracking-widest"
             >
               <Bell size={16} /> {t.enableNotifications}
             </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
