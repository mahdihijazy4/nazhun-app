import { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs, doc, getDoc, limit, or, setDoc, updateDoc, increment, writeBatch } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Conversation, Message, UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Send, ArrowLeft, Phone, Video, MoreVertical, MessageCircle } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '../lib/utils';
import { sendNotification } from '../services/notificationService';

export function Messages() {
  const { user, t, profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.uid),
      orderBy('lastMessageAt', 'desc')
    );

    const userCache: Record<string, {name: string, photoURL: string}> = {};

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const convos = await Promise.all(snapshot.docs.map(async (d) => {
        const data = d.data() as Conversation;
        data.id = d.id;
        
        const otherId = data.participants.find(p => p !== user.uid);
        if (otherId) {
          if (!userCache[otherId]) {
            const otherDoc = await getDoc(doc(db, 'users', otherId));
            if (otherDoc.exists()) {
              userCache[otherId] = {
                name: otherDoc.data().name,
                photoURL: otherDoc.data().photoURL
              };
            }
          }
          if (userCache[otherId]) {
            data.participantDetails = {
              [otherId]: userCache[otherId]
            };
          }
        }
        return data;
      }));

      // Filter out blocked users
      const filteredConvos = convos.filter(convo => {
        const otherId = convo.participants.find(p => p !== user.uid);
        return !profile?.blockedUsers?.includes(otherId || '');
      });

      setConversations(filteredConvos);
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'conversations'));

    return () => unsubscribe();
  }, [user]);

  const [activeOtherProfile, setActiveOtherProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!selectedConvo || !user) return;
    const otherId = selectedConvo.participants.find(p => p !== user.uid);
    if (!otherId) return;

    const unsub = onSnapshot(doc(db, 'users', otherId), (docSnap) => {
      if (docSnap.exists()) {
        setActiveOtherProfile(docSnap.data() as UserProfile);
      }
    });
    return () => unsub();
  }, [selectedConvo, user]);

  useEffect(() => {
    if (!selectedConvo || !user) return;

    if (selectedConvo.unreadCount && selectedConvo.unreadCount[user.uid] && selectedConvo.unreadCount[user.uid] > 0) {
      updateDoc(doc(db, 'conversations', selectedConvo.id), {
        [`unreadCount.${user.uid}`]: 0
      }).catch(e => console.error("Failed to reset unread count:", e));
    }

    // Also mark notifications as read
    const otherParticipantId = selectedConvo.participants.find(p => p !== user.uid);
    if (otherParticipantId) {
      const qNotifs = query(
        collection(db, 'users', user.uid, 'notifications'),
        where('type', '==', 'message'),
        where('senderId', '==', otherParticipantId),
        where('read', '==', false)
      );
      getDocs(qNotifs).then(snapshot => {
        if (!snapshot.empty) {
          const batch = writeBatch(db);
          snapshot.forEach(docSnap => {
            batch.update(docSnap.ref, { read: true });
          });
          batch.commit().catch(e => console.error("Failed to mark messages as read:", e));
        }
      });
    }

    const q = query(
      collection(db, 'conversations', selectedConvo.id, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Message[]);
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `conversations/${selectedConvo.id}/messages`));

    return () => unsubscribe();
  }, [selectedConvo]);

  const handleSendMessage = async () => {
    if (!selectedConvo || !newMessage.trim() || !user) return;
    try {
      const otherId = selectedConvo.participants.find(p => p !== user.uid);
      const msgData = {
        conversationId: selectedConvo.id,
        senderId: user.uid,
        text: newMessage,
        createdAt: serverTimestamp(),
      };
      const path = `conversations/${selectedConvo.id}/messages`;
      await addDoc(collection(db, 'conversations', selectedConvo.id, 'messages'), msgData).catch(e => handleFirestoreError(e, OperationType.CREATE, path));
      
      await updateDoc(doc(db, 'conversations', selectedConvo.id), {
        lastMessage: newMessage,
        lastMessageAt: serverTimestamp(),
        ...(otherId ? { [`unreadCount.${otherId}`]: increment(1) } : {})
      }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `conversations/${selectedConvo.id}`));

      // Notification
      if (otherId) {
        await sendNotification(otherId, {
          senderId: user.uid,
          senderName: profile?.name || 'Someone',
          type: 'message',
        });
      }

      setNewMessage('');
    } catch (error) {
      console.error('Send message failed:', error);
    }
  };

  const getOtherParticipant = (convo: Conversation) => {
    const otherId = convo.participants.find(p => p !== user?.uid);
    return convo.participantDetails && otherId ? convo.participantDetails[otherId] : { name: 'Unknown User' };
  };

  if (selectedConvo) {
    const other = getOtherParticipant(selectedConvo);
    return (
      <div className="flex flex-col h-full bg-[var(--theme-bg-body)] relative">
        <div className="absolute inset-0 bg-[var(--theme-bg-body)] opacity-60 -z-10" />
        
        {/* Chat Header */}
        <div className="px-6 py-4 glass-dark sticky top-0 z-20 flex items-center gap-4 border-b border-[var(--color-glass-white)]">
          <button onClick={() => setSelectedConvo(null)} className="p-2 hover:bg-theme-white/5 rounded-2xl transition-colors">
            <ArrowLeft size={24} className={t.language === 'ar' ? 'rotate-180' : ''} />
          </button>
          <div className="relative">
            <div className="w-11 h-11 rounded-2xl bg-zinc-800 overflow-hidden border border-theme-white/10">
              {other.photoURL && <img src={other.photoURL} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />}
            </div>
            {activeOtherProfile?.lastActive && (Date.now() - activeOtherProfile.lastActive.toMillis() < 5 * 60 * 1000) && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-village-green rounded-full border-2 border-black glow-green" />
            )}
          </div>
          <div className="flex-1">
             <h3 className="font-bold text-base leading-tight">{other.name}</h3>
             {activeOtherProfile?.lastActive && (Date.now() - activeOtherProfile.lastActive.toMillis() < 5 * 60 * 1000) && (
               <span className="text-[10px] text-village-green font-bold uppercase tracking-wider glow-text-green">{t.activeNow}</span>
             )}
          </div>
          <div className="flex gap-4 opacity-60">
             {/* Call buttons removed since they are not implemented */}
          </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
           {messages.map((m) => (
             <div key={m.id} className={`flex ${m.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}>
                <div className="flex flex-col gap-1 max-w-[75%]">
                  <div className={cn(
                    "px-5 py-3 rounded-[24px] text-sm font-medium leading-relaxed shadow-lg whitespace-pre-wrap",
                    m.senderId === user?.uid 
                      ? "bg-village-green text-theme-black rounded-tr-none glow-green" 
                      : "glass text-current rounded-tl-none border border-[var(--color-glass-white)]"
                  )}>
                     {m.text}
                  </div>
                  <span className={cn(
                    "text-[10px] opacity-40 font-bold uppercase tracking-wider px-2",
                    m.senderId === user?.uid ? "text-right" : "text-left"
                  )}>
                    {m.createdAt && typeof m.createdAt.toDate === 'function' ? format(m.createdAt.toDate(), 'h:mm a') : ''}
                  </span>
                </div>
             </div>
           ))}
           <div ref={scrollRef} />
        </div>

        {/* Input Area */}
        <div className="p-6 bg-transparent pb-32">
           <div className="glass-dark rounded-[28px] p-2 flex gap-2 items-center border border-[var(--color-glass-white)] shadow-2xl">
             <textarea 
               value={newMessage}
               onChange={(e) => setNewMessage(e.target.value)}
               placeholder={t.messageDot}
               rows={1}
               className="flex-1 bg-transparent px-4 py-3 text-sm outline-none text-current placeholder-current placeholder-opacity-50 resize-none max-h-32 scrollbar-hide"
               onKeyDown={(e) => {
                 if (e.key === 'Enter' && !e.shiftKey) {
                   e.preventDefault();
                   handleSendMessage();
                 }
               }}
             />
             <motion.button 
               whileTap={{ scale: 0.9 }}
               onClick={handleSendMessage}
               disabled={!newMessage.trim()}
               className="bg-village-green text-theme-black px-6 py-3 rounded-2xl disabled:opacity-50 glow-green transition-all shadow-lg font-bold"
             >
               <Send size={20} className={t.language === 'ar' ? 'rotate-180' : ''} />
             </motion.button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--theme-bg-body)]">
       <div className="p-8 pb-4 space-y-6">
          <h1 className="text-3xl font-black tracking-tight opacity-90">{t.conversations}</h1>
          
          <div className="relative">
             <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" />
             <input
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               placeholder={t.searchConversations}
               className="w-full bg-[var(--color-glass-white)] border border-[var(--color-glass-white)] rounded-2xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-village-green transition-colors bg-transparent text-current"
             />
          </div>
       </div>

       <div className="flex-1 overflow-y-auto px-6 pb-40 scrollbar-hide space-y-3">
          {conversations.filter(c => {
             if (!searchQuery.trim()) return true;
             const other = getOtherParticipant(c);
             return other.name.toLowerCase().includes(searchQuery.toLowerCase());
          }).map((convo) => {
            const other = getOtherParticipant(convo);
            const myUnreadCount = convo.unreadCount && user ? convo.unreadCount[user.uid] || 0 : 0;
            return (
              <button 
                key={convo.id}
                onClick={() => setSelectedConvo(convo)}
                className="w-full flex items-center gap-5 p-5 glass-dark rounded-[32px] border border-[var(--color-glass-white)] hover:border-current transition-all group"
              >
                <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex-shrink-0 relative overflow-hidden border border-[var(--color-glass-white)] group-hover:border-village-green/30 transition-all">
                  {other.photoURL ? (
                    <img src={other.photoURL} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600 bg-zinc-900 font-bold uppercase">
                      {other.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-1 overflow-hidden">
                   <div className="flex justify-between items-center">
                      <h4 className="font-bold text-base opacity-90">{other.name}</h4>
                      <span className="text-[10px] opacity-30 uppercase font-black">
                        {convo.lastMessageAt && typeof convo.lastMessageAt.toDate === 'function' ? formatDistanceToNow(convo.lastMessageAt.toDate()) : ''}
                      </span>
                   </div>
                   <div className="flex justify-between items-center">
                      <p className={cn("text-sm truncate font-medium flex-1 text-start", myUnreadCount > 0 ? "opacity-100" : "opacity-40")}>
                        {convo.lastMessage || 'Start a new conversation'}
                      </p>
                      {myUnreadCount > 0 && (
                        <div className="w-5 h-5 bg-village-green rounded-full flex items-center justify-center text-[10px] font-black text-theme-black glow-green scale-75">
                          {myUnreadCount > 99 ? '99+' : myUnreadCount}
                        </div>
                      )}
                   </div>
                </div>
              </button>
            );
          })}
          {conversations.length === 0 && !loading && (
             <div className="py-20 text-center">
                <div className="w-20 h-20 bg-village-green/5 border border-village-green/10 rounded-[32px] mx-auto mb-6 flex items-center justify-center text-village-green/20">
                   <MessageCircle size={40} />
                </div>
                <p className="font-black italic text-xl mb-2 text-theme-white/10">{t.noMessages}</p>
                <p className="text-[10px] uppercase tracking-[0.2em] font-black text-theme-white/20">{t.findSomeone}</p>
             </div>
          )}
       </div>
    </div>
  );
}
