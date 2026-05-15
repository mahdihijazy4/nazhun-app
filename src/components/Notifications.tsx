import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, writeBatch, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Notification, Post } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Heart, MessageCircle, UserPlus, Check, X, Megaphone, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../lib/utils';
import { PostCard } from './PostCard';

interface NotificationsProps {
  onNavigate: (tab: 'feed' | 'notifications' | 'messages' | 'profile' | 'create' | 'discovery' | 'admin', userId?: string) => void;
}

export function Notifications({ onNavigate }: NotificationsProps) {
  const { user, t, language } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'users', user.uid, 'notifications'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (s) => {
      setNotifications(s.docs.map(d => ({ id: d.id, ...d.data() })) as Notification[]);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/notifications`));

    return () => unsub();
  }, [user]);

  const markRead = async (id: string) => {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'notifications', id), { read: true });
  };

  const markAllRead = async () => {
    if (!user) return;
    const batch = writeBatch(db);
    notifications.filter(n => !n.read).forEach(n => {
      batch.update(doc(db, 'users', user.uid, 'notifications', n.id), { read: true });
    });
    await batch.commit();
  };

  const [selectedSystemNotification, setSelectedSystemNotification] = useState<Notification | null>(null);
  const [selectedPostNotification, setSelectedPostNotification] = useState<Notification | null>(null);
  const [fetchedPost, setFetchedPost] = useState<Post | null>(null);
  const [isFetchingPost, setIsFetchingPost] = useState(false);

  const handleNotificationClick = async (n: Notification) => {
    if (!n.read) await markRead(n.id);
    
    if (n.type === 'location_request') {
      onNavigate('admin'); 
      setTimeout(() => window.dispatchEvent(new CustomEvent('go-admin-locations')), 100);
    } else if (n.type === 'system') {
      setSelectedSystemNotification(n);
    } else if (n.type === 'message') {
      onNavigate('messages');
    } else if ((n.type === 'like' || n.type === 'comment') && n.postId) {
      setSelectedPostNotification(n);
      setIsFetchingPost(true);
      try {
        const postDoc = await getDoc(doc(db, 'posts', n.postId));
        if (postDoc.exists()) {
          setFetchedPost({ id: postDoc.id, ...postDoc.data() } as Post);
        } else {
          setFetchedPost(null);
        }
      } catch (err) {
        console.error("Failed to fetch post", err);
        setFetchedPost(null);
      } finally {
        setIsFetchingPost(false);
      }
    } else {
      onNavigate('profile', n.senderId);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart size={18} className="text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" fill="currentColor" />;
      case 'comment': return <MessageCircle size={18} className="text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]" fill="currentColor" />;
      case 'message': return <MessageCircle size={18} className="text-village-green drop-shadow-[0_0_8px_rgba(46,204,113,0.5)]" fill="currentColor" />;
      case 'follow': return <UserPlus size={18} className="text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />;
      case 'system': return <Megaphone size={18} className="text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />;
      case 'location_request': return <Megaphone size={18} className="text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />;
      default: return <Bell size={18} className="text-theme-white/40" />;
    }
  };

  const getMessage = (n: Notification) => {
    switch (n.type) {
      case 'like': return t.likedYourPost;
      case 'comment': return t.commentedYourPost;
      case 'message': return t.sentYouMessage;
      case 'follow': return t.startedFollowingYou;
      case 'system': return n.text || t.systemUpdated;
      case 'location_request': return n.text || t.newLocationRequest;
      default: return '';
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
        <Bell size={32} className="text-village-green/20" />
      </motion.div>
    </div>
  );

  const filters = [
    { id: 'all', label: t.allFilter },
    { id: 'interactions', label: t.interactionsFilter },
    { id: 'messages', label: t.messagesFilter },
    { id: 'system', label: t.systemFilter },
  ];

  const filteredNotifications = notifications.filter(n => {
    if (n.type === 'popup') return false;
    if (activeFilter === 'all') return true;
    if (activeFilter === 'interactions') return n.type === 'like' || n.type === 'comment' || n.type === 'follow';
    if (activeFilter === 'messages') return n.type === 'message';
    if (activeFilter === 'system') return n.type === 'system' || n.type === 'location_request';
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-[var(--theme-bg-body)]">
      <div className="p-8 pb-4 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-black tracking-tight opacity-90">{t.notifications}</h1>
          <button 
            onClick={markAllRead}
            className="p-2 glass-dark rounded-xl text-theme-white/40 hover:text-village-green transition-colors"
          >
            <Check size={20} />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
          {filters.map(filter => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={cn(
                "px-5 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border",
                activeFilter === filter.id 
                  ? "bg-village-green text-theme-black border-village-green glow-green" 
                  : "glass opacity-40 border-[var(--color-glass-white)] hover:border-current"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 space-y-3 pb-32 scrollbar-hide mt-2">
        {filteredNotifications.map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => handleNotificationClick(n)}
            className={cn(
              "p-5 rounded-[28px] flex items-center gap-5 cursor-pointer transition-all active:scale-[0.98] border shadow-lg relative group",
              n.read 
                ? "glass-dark border-transparent opacity-60" 
                : "glass border-[var(--color-glass-white)] glow-green bg-[var(--color-glass-white)]"
            )}
          >
            <div className="w-14 h-14 rounded-full bg-zinc-800 flex-shrink-0 overflow-hidden border-2 border-[var(--color-glass-white)]">
               <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${n.senderId}`} alt={n.senderName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="flex-1 space-y-1">
               <div className="flex justify-between items-start">
                 <p className="text-sm leading-tight">
                   <span className="font-bold block mb-0.5">{n.senderName}</span>
                   <span className="opacity-60 font-medium">{getMessage(n)}</span>
                 </p>
                 <span className="text-[10px] uppercase font-black tracking-wider opacity-20 whitespace-nowrap pt-1">
                   {n.createdAt && typeof n.createdAt.toDate === 'function' ? formatDistanceToNow(n.createdAt.toDate()) : ''}
                 </span>
               </div>
            </div>
            <div className="ps-2">
              {getIcon(n.type)}
            </div>
            
            {!n.read && (
              <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-1.5 h-8 bg-village-green rounded-full glow-green" />
            )}
          </motion.div>
        ))}
        
        {filteredNotifications.length === 0 && (
          <div className="py-24 text-center">
             <div className="w-20 h-20 bg-village-green/5 border border-village-green/10 rounded-full mx-auto mb-6 flex items-center justify-center text-village-green/10">
                <Bell size={40} />
             </div>
             <p className="font-bold text-lg opacity-20 mb-1">{t.noNotifications}</p>
             <p className="text-xs uppercase tracking-[0.2em] font-black opacity-10">Clear skies ahead</p>
          </div>
        )}
      </div>

      <div className="h-20 shrink-0" />

      <AnimatePresence>
        {selectedSystemNotification && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[var(--theme-bg-body)] opacity-95 backdrop-blur-sm"
            onClick={() => setSelectedSystemNotification(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm glass-dark rounded-[40px] p-8 shadow-2xl relative"
            >
              <button
                onClick={() => setSelectedSystemNotification(null)}
                className="absolute top-6 right-6 p-2 rounded-full glass hover:bg-theme-white/10 transition-colors"
                style={{ zIndex: 10 }}
              >
                <X size={20} className="text-theme-white/60" />
              </button>
              
              <div className="space-y-6">
                <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-3xl flex items-center justify-center border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                  <Megaphone size={32} />
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-black">{selectedSystemNotification.senderName || t.adminMessage}</h3>
                    <p className="text-xs font-bold uppercase tracking-widest text-amber-500 mt-1">
                      {selectedSystemNotification.createdAt && typeof selectedSystemNotification.createdAt.toDate === 'function' ? selectedSystemNotification.createdAt.toDate().toLocaleDateString() : ''}
                    </p>
                  </div>
                  
                  <div className="bg-[var(--color-glass-white)] p-6 rounded-[24px] border border-[var(--color-glass-white)]">
                    <p className="text-sm font-medium opacity-80 leading-relaxed whitespace-pre-wrap">
                      {selectedSystemNotification.text}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => setSelectedSystemNotification(null)}
                  className="w-full py-4 rounded-2xl bg-theme-white/5 hover:bg-theme-white/10 text-theme-white font-bold tracking-widest uppercase text-xs transition-colors"
                >
                  {t.closeBtn}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {selectedPostNotification && (
          <div 
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-6 bg-[var(--theme-bg-body)] opacity-95 backdrop-blur-sm overflow-y-auto"
            onClick={() => {
              setSelectedPostNotification(null);
              setFetchedPost(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg relative bg-[var(--theme-bg-body)] rounded-[40px] shadow-2xl my-auto"
            >
              <button
                onClick={() => {
                  setSelectedPostNotification(null);
                  setFetchedPost(null);
                }}
                className="absolute top-4 right-4 p-2 rounded-full glass hover:bg-theme-white/10 transition-colors z-50 bg-theme-black/50 text-theme-white border border-theme-white/10"
              >
                <X size={20} />
              </button>
              
              <div className="w-full overflow-hidden rounded-[40px]">
                {isFetchingPost ? (
                  <div className="flex flex-col items-center justify-center min-h-[300px] border border-theme-white/10 bg-zinc-950">
                    <Loader2 size={32} className="text-village-green font-bold animate-spin mb-4" />
                    <p className="text-sm text-zinc-400 font-bold tracking-widest uppercase">{t.saving || 'Please wait...'}</p>
                  </div>
                ) : fetchedPost ? (
                  <div className="max-h-[85vh] overflow-y-auto scrollbar-hide">
                    <PostCard 
                      post={fetchedPost} 
                      onUserClick={(userId) => {
                        setSelectedPostNotification(null);
                        setFetchedPost(null);
                        onNavigate('profile', userId);
                      }}
                      isActive={true}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-12 min-h-[300px] border border-theme-white/10 bg-zinc-950 text-center space-y-4">
                    <p className="text-zinc-500 font-bold uppercase tracking-widest">{t.postDeleted}</p>
                    <button
                      onClick={() => {
                        setSelectedPostNotification(null);
                        setFetchedPost(null);
                      }}
                      className="py-3 px-6 rounded-2xl bg-theme-white/5 hover:bg-theme-white/10 text-theme-white font-bold tracking-widest uppercase text-xs transition-colors mt-4"
                    >
                      {t.closeBtn}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
