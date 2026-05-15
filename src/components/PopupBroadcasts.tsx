import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Megaphone, X } from 'lucide-react';

interface PopupNotification {
  id: string;
  text: string;
  senderName: string;
}

export function PopupBroadcasts() {
  const { user, language, t } = useAuth();
  const [popups, setPopups] = useState<PopupNotification[]>([]);
  const [currentPopup, setCurrentPopup] = useState<PopupNotification | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, 'users', user.uid, 'notifications'),
      where('read', '==', false),
      where('type', '==', 'popup')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, text: d.data().text || '', senderName: d.data().senderName || 'Admin' }));
      setPopups(docs);
      if (docs.length > 0) {
        setCurrentPopup(docs[0]);
      } else {
        setCurrentPopup(null);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/notifications`);
    });

    return () => unsub();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        handleDismiss();
      }
    };
    if (currentPopup) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [currentPopup]);

  const handleDismiss = async () => {
    if (!user || !currentPopup) return;
    const popupId = currentPopup.id;
    setCurrentPopup(null); // Optimistic UI hide
    try {
      await updateDoc(doc(db, 'users', user.uid, 'notifications', popupId), {
        read: true
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/notifications/${popupId}`);
    }
  };

  if (!currentPopup) return null;

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
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1 glass rounded-full opacity-60 hover:opacity-100"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-3 text-amber-500">
          <Megaphone size={24} />
          <h4 className="font-black tracking-tighter uppercase text-sm whitespace-nowrap overflow-hidden text-ellipsis mr-4 pr-4">
             {t.importantAdminMessage}
          </h4>
        </div>

        <p className="text-sm text-amber-500/90 font-semibold leading-relaxed whitespace-pre-line mt-2">
          {currentPopup.text}
        </p>

        <div className="flex flex-col gap-2 mt-2">
           <button
             onClick={handleDismiss}
             className="bg-amber-500 text-theme-black p-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-amber-400 transition-colors text-xs font-black uppercase tracking-widest"
           >
             {t.okayGotIt}
           </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
