import { useState } from 'react';
import { collection, query, getDocs, where, writeBatch, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Megaphone, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocations } from '../hooks/useLocations';

export function AdminBroadcast() {
  const { t, profile, language } = useAuth();
  const { locations } = useLocations();
  const [broadcastAudience, setBroadcastAudience] = useState<'all' | 'hometown' | 'location'>('all');
  const [broadcastType, setBroadcastType] = useState<'system' | 'popup'>('system');
  const [targetString, setTargetString] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const handleBroadcast = async () => {
    if (!broadcastMessage.trim() || !profile) return;
    setBroadcasting(true);

    try {
      let q = query(collection(db, 'users'));
      if (broadcastAudience === 'hometown') {
        q = query(collection(db, 'users'), where('hometown', '==', targetString.trim()));
      } else if (broadcastAudience === 'location') {
        q = query(collection(db, 'users'), where('currentLocation', '==', targetString.trim()));
      }

      const snapshot = await getDocs(q);
      const serverTime = new Date(); 

      const batches = [];
      let batch = writeBatch(db);
      let count = 0;

      snapshot.docs.forEach(d => {
        const prefs = d.data().notificationPreferences;
        if (prefs && broadcastType === 'system' && !prefs.system) return;

        const notifRef = doc(collection(db, `users/${d.id}/notifications`));
        batch.set(notifRef, {
          recipientId: d.id,
          senderId: profile.uid,
          senderName: profile.name || 'Admin',
          type: broadcastType,
          text: broadcastMessage.trim(),
          read: false,
          createdAt: serverTime
        });
        count++;
        if (count === 490) { 
          batches.push(batch);
          batch = writeBatch(db);
          count = 0;
        }
      });
      
      if (count > 0) {
        batches.push(batch);
      }

      await Promise.all(batches.map(b => b.commit()));

      setSuccess(t.messageSent || 'Message sent successfully');
      setBroadcastMessage('');
      setTargetString('');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error("[ADMIN] Broadcast failed:", error);
      alert(t.failedPrefix + error.message);
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div className="bg-zinc-900/50 rounded-[40px] p-8 border border-zinc-800/50 space-y-8">
      <div className="flex items-center gap-4">
        <Megaphone className="text-zinc-500" />
        <h3 className="text-2xl font-black italic tracking-tighter uppercase">{t.sendBroadcast || 'Send Broadcast Message'}</h3>
      </div>
      
      <AnimatePresence>
        {success && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 bg-green-500/20 border border-green-500/30 rounded-2xl flex items-center gap-3 text-green-500"
          >
            <CheckCircle size={20} />
            <span className="font-bold text-sm">{success}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        <div className="space-y-3">
          <label className="text-xs font-black uppercase tracking-widest text-zinc-500">{t.messageType}</label>
          <div className="flex gap-3">
             <button 
                onClick={() => setBroadcastType('system')}
                className={`p-4 flex-1 text-sm font-bold rounded-2xl text-center transition-all ${broadcastType === 'system' ? 'bg-amber-500 text-theme-black border border-amber-500' : 'bg-[var(--theme-bg-body)] text-zinc-400 border border-transparent hover:bg-zinc-800'}`}
             >
                {t.normalNotification}
             </button>
             <button 
                onClick={() => setBroadcastType('popup')}
                className={`p-4 flex-1 text-sm font-bold rounded-2xl text-center transition-all ${broadcastType === 'popup' ? 'bg-amber-500 text-theme-black border border-amber-500' : 'bg-[var(--theme-bg-body)] text-zinc-400 border border-transparent hover:bg-zinc-800'}`}
             >
                {t.popupWindow}
             </button>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-xs font-black uppercase tracking-widest text-zinc-500">{t.targetAudience || 'Target Audience'}</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
             <button 
                onClick={() => setBroadcastAudience('all')}
                className={`p-4 text-sm font-bold rounded-2xl text-center transition-all ${broadcastAudience === 'all' ? 'bg-amber-500 text-theme-black border border-amber-500' : 'bg-[var(--theme-bg-body)] text-zinc-400 border border-transparent hover:bg-zinc-800'}`}
             >
                {t.allUsers || 'All Users'}
             </button>
             <button 
                onClick={() => setBroadcastAudience('hometown')}
                className={`p-4 text-sm font-bold rounded-2xl text-center transition-all ${broadcastAudience === 'hometown' ? 'bg-amber-500 text-theme-black border border-amber-500' : 'bg-[var(--theme-bg-body)] text-zinc-400 border border-transparent hover:bg-zinc-800'}`}
             >
                {t.byHometown || 'By Hometown'}
             </button>
             <button 
                onClick={() => setBroadcastAudience('location')}
                className={`p-4 text-sm font-bold rounded-2xl text-center transition-all ${broadcastAudience === 'location' ? 'bg-amber-500 text-theme-black border border-amber-500' : 'bg-[var(--theme-bg-body)] text-zinc-400 border border-transparent hover:bg-zinc-800'}`}
             >
                {t.byLocation || 'By Current Residence'}
             </button>
          </div>
        </div>

        {broadcastAudience !== 'all' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2 relative overflow-hidden">
             <label className="text-xs font-black uppercase tracking-widest text-zinc-500">{broadcastAudience === 'hometown' ? t.byHometown : t.byLocation}</label>
             <select
                value={targetString}
                onChange={(e) => setTargetString(e.target.value)}
                className="w-full bg-[var(--theme-bg-body)] border-none rounded-2xl p-4 focus:ring-2 focus:ring-amber-500 transition-all outline-none text-theme-white"
             >
                <option value="">{t.selectLocationAdmin}</option>
                {locations.map(loc => (
                  <option key={loc.name} value={loc.name} className="bg-zinc-900">{loc.name}</option>
                ))}
             </select>
          </motion.div>
        )}

        <div className="space-y-3">
          <label className="text-xs font-black uppercase tracking-widest text-zinc-500">{t.messageContent || 'Message Content'}</label>
          <textarea
            value={broadcastMessage}
            onChange={(e) => setBroadcastMessage(e.target.value)}
            placeholder="Type your message here..."
            className="w-full bg-[var(--theme-bg-body)] border-none rounded-2xl p-5 min-h-[160px] focus:ring-2 focus:ring-amber-500 transition-all outline-none text-theme-white resize-none placeholder-zinc-700 font-bold"
          />
        </div>

        <button
          onClick={handleBroadcast}
          disabled={broadcasting || !broadcastMessage.trim() || (broadcastAudience !== 'all' && !targetString.trim())}
          className="w-full bg-amber-500 text-theme-black font-black uppercase tracking-widest py-5 rounded-2xl hover:opacity-90 disabled:opacity-50 transition-all mt-4"
        >
          {broadcasting ? (
             <div className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-theme-black/30 border-t-black rounded-full animate-spin" />
                <span>{t.saving || 'Sending...'}</span>
             </div>
          ) : (
             t.send || 'Send'
          )}
        </button>
      </div>
    </div>
  );
}
