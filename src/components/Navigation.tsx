import { Home, MessageCircle, User, Bell, ShieldCheck, Search, PlusSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useEffect, useState } from 'react';

interface NavigationProps {
  activeTab: 'feed' | 'notifications' | 'messages' | 'profile' | 'create' | 'admin' | 'discovery';
  setActiveTab: (tab: 'feed' | 'notifications' | 'messages' | 'profile' | 'create' | 'admin' | 'discovery') => void;
  unreadNotifs?: number;
  unreadMessages?: number;
}

export function Navigation({ activeTab, setActiveTab, unreadNotifs = 0, unreadMessages = 0 }: NavigationProps) {
  const { t, profile, user } = useAuth();
  const [unreadReports, setUnreadReports] = useState(0);

  useEffect(() => {
    if (!profile?.isAdmin) return;
    const q = query(collection(db, 'admin_notifications'), where('read', '==', false));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadReports(snapshot.size);
    }, (err) => {
      // Don't throw for background unread count to avoid crashing non-admins
      console.warn('Admin notifications listener failed:', err);
    });
    return () => unsubscribe();
  }, [profile]);

  const tabs = [
    { id: 'feed', icon: Home, label: t.feed },
    { id: 'discovery', icon: Search, label: t.explore },
    { id: 'messages', icon: MessageCircle, label: t.chat, badge: unreadMessages },
    { id: 'create', icon: PlusSquare, label: t.post, primary: true },
    { id: 'notifications', icon: Bell, label: t.notifications, badge: unreadNotifs },
    { id: 'profile', icon: User, label: t.profile },
  ] as any[];

  if (profile?.isAdmin || user?.email === 'mahdihijazy4@gmail.com') {
    tabs.splice(tabs.length - 1, 0, { id: 'admin', icon: ShieldCheck, label: t.admin, badge: unreadReports });
  }

  return (
    <div className="w-full bg-[var(--theme-bg-body)] border-t border-[var(--color-glass-white)] pb-2 shrink-0 relative z-50">
      <nav className="p-2 flex items-center justify-between max-w-md mx-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex flex-col items-center justify-center p-2 transition-all relative flex-1 gap-1",
                isActive ? "text-[--color-village-green]" : "text-current opacity-40"
              )}
            >
              {isActive && (
                <motion.div 
                  layoutId="tab-active-glow"
                  className="absolute inset-0 bg-village-green/10 rounded-2xl blur-md"
                />
              )}
              
              <div className="relative z-10 flex flex-col items-center">
                {tab.primary ? (
                  <div className="w-12 h-12 rounded-2xl bg-village-green flex items-center justify-center text-theme-black glow-green shadow-lg -mt-2 transition-transform active:scale-90">
                    <PlusSquare size={24} strokeWidth={2.5} />
                  </div>
                ) : (
                  <>
                    <tab.icon 
                      size={24} 
                      strokeWidth={isActive ? 2.5 : 2} 
                      className={cn("transition-all", isActive && "drop-shadow-[0_0_8px_rgba(46,204,113,0.5)]")}
                    />
                    {'badge' in tab && tab.badge > 0 && (
                      <div className="absolute -top-1 -end-1 w-4 h-4 bg-red-600 rounded-full flex items-center justify-center text-[8px] font-black text-theme-white glow-green">
                        {tab.badge > 9 ? '9+' : tab.badge}
                      </div>
                    )}
                  </>
                )}
              </div>
              
              {isActive && !tab.primary && (
                <motion.div 
                  layoutId="tab-dot"
                  className="w-1 h-1 bg-village-green rounded-full mt-0.5 glow-green"
                />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
