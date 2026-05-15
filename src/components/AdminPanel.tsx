import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDoc, writeBatch, where, getDocs } from 'firebase/firestore';
import { Report, Post, UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, AlertTriangle, CheckCircle, Trash2, UserX, Clock, ChevronRight, ChevronDown, ExternalLink } from 'lucide-react';
import { AdminPhones } from './AdminPhones';

export const AdminPanel: React.FC = () => {
  const { profile, t, language } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [targetPost, setTargetPost] = useState<Post | null>(null);
  const [actioning, setActioning] = useState(false);
  const [activeTab, setActiveTab] = useState<'reports' | 'broadcast'>('reports');

  // Broadcast state
  const [broadcastAudience, setBroadcastAudience] = useState<'all' | 'hometown' | 'location'>('all');
  const [targetString, setTargetString] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  useEffect(() => {
    if (!profile?.isAdmin) return;

    // Mark notifications as read
    const markAsRead = async () => {
      const q = query(collection(db, 'admin_notifications'), where('read', '==', false));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach(d => {
        batch.update(d.ref, { read: true });
      });
      await batch.commit();
    };
    markAsRead();

    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reportsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
      setReports(reportsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reports');
    });

    return () => unsubscribe();
  }, [profile]);

  const fetchPost = async (postId: string) => {
    if (!postId) return;
    setTargetPost(null);
    try {
      const postDoc = await getDoc(doc(db, 'posts', postId));
      if (postDoc.exists()) {
        setTargetPost({ id: postDoc.id, ...postDoc.data() } as Post);
      }
    } catch (e) {
      console.error("Error fetching post:", e);
    }
  };

  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleAction = async (reportId: string, action: 'dismiss' | 'delete_post' | 'ban_user') => {
    setActioning(true);
    const report = reports.find(r => r.id === reportId);
    if (!report) {
      console.error("[ADMIN] Report not found:", reportId);
      setActioning(false);
      return;
    }

    try {
      console.log(`[ADMIN] Executing ${action} on ${reportId}`);
      const reportRef = doc(db, 'reports', reportId);

      if (action === 'dismiss') {
        await updateDoc(reportRef, { status: 'dismissed' });
        console.log("[ADMIN] Report dismissed");
      } else if (action === 'delete_post') {
        if (report.targetId) {
          const postRef = doc(db, 'posts', report.targetId);
          await deleteDoc(postRef).catch(e => console.warn("[ADMIN] Post delete failed (might be already gone):", e));
        }
        await updateDoc(reportRef, { status: 'reviewed' });
        console.log("[ADMIN] Post deleted and report reviewed");
      } else if (action === 'ban_user') {
        if (!report.authorId) throw new Error("Missing authorId");
        
        if (report.targetId) {
          const postRef = doc(db, 'posts', report.targetId);
          await deleteDoc(postRef).catch(e => console.warn("[ADMIN] Post delete failed during ban:", e));
        }
        
        const userRef = doc(db, 'users', report.authorId);
        await updateDoc(userRef, { isBanned: true });
        await updateDoc(reportRef, { status: 'reviewed' });
        console.log("[ADMIN] User banned and report reviewed");
      }

      setSuccess(t.successOp);
      setExpandedReport(null);
    } catch (error: any) {
      console.error("[ADMIN] Action failed:", error);
      alert(t.failedPrefix + error.message);
    } finally {
      setActioning(false);
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastMessage.trim()) return;
    setBroadcasting(true);

    try {
      let q = query(collection(db, 'users'));
      if (broadcastAudience === 'hometown') {
        q = query(collection(db, 'users'), where('hometown', '==', targetString.trim()));
      } else if (broadcastAudience === 'location') {
        q = query(collection(db, 'users'), where('currentLocation', '==', targetString.trim()));
      }

      const snapshot = await getDocs(q);
      const serverTime = new Date(); // Close enough for client-side batches

      // Firestore batches can hold up to 500 writes
      const batches = [];
      let batch = writeBatch(db);
      let count = 0;

      snapshot.docs.forEach(d => {
        const prefs = d.data().notificationPreferences;
        if (prefs && !prefs.system) return;

        const notifRef = doc(collection(db, `users/${d.id}/notifications`));
        batch.set(notifRef, {
          recipientId: d.id,
          senderId: profile.uid,
          senderName: profile.name || 'Admin',
          type: 'system',
          text: broadcastMessage.trim(),
          read: false,
          createdAt: serverTime
        });
        count++;
        if (count === 490) { // Keep just under 500
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
    } catch (error: any) {
      console.error("[ADMIN] Broadcast failed:", error);
      alert(t.failedPrefix + error.message);
    } finally {
      setBroadcasting(false);
    }
  };

  if (!profile?.isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-[var(--theme-bg-body)]">
        <Shield size={64} className="text-zinc-800 mb-6" />
        <h2 className="text-2xl font-black uppercase tracking-tighter italic mb-2">Access Denied</h2>
        <p className="text-zinc-500 text-sm">This area is reserved for village elders only.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--theme-bg-body)]">
      <header className="p-6 border-b border-theme-white/5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Shield size={20} className="text-theme-black" />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter italic">
              {t.adminPanel}
            </h2>
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] mt-0.5">
              {t.moderationReports}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('reports')}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'reports' ? 'bg-amber-500 text-theme-black' : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800'}`}
          >
            {t.manageReports}
          </button>
          <button 
            onClick={() => setActiveTab('broadcast')}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'broadcast' ? 'bg-amber-500 text-theme-black' : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800'}`}
          >
            {t.broadcastMessage || 'Broadcast Message'}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {success && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-village-green text-theme-black px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] text-center shadow-lg glow-green mb-4"
            >
              {success}
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab === 'reports' && (
          <>
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="w-8 h-8 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
              </div>
            ) : reports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                <CheckCircle className="w-12 h-12 mb-4" />
                <p className="font-bold uppercase tracking-widest text-xs">No pending reports</p>
              </div>
            ) : (
              reports.map((report) => (
                <div 
                  key={report.id}
                  className={`bg-zinc-900/50 border ${report.status === 'pending' ? 'border-amber-500/30' : 'border-zinc-800'} rounded-[30px] overflow-hidden transition-all`}
                >
                  <button 
                    onClick={() => {
                      if (expandedReport === report.id) {
                        setExpandedReport(null);
                      } else {
                        setExpandedReport(report.id);
                        fetchPost(report.targetId);
                      }
                    }}
                    className="w-full p-5 flex items-center gap-4 text-start hover:bg-theme-white/5 transition-colors"
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${report.status === 'pending' ? 'bg-amber-500/10 text-amber-500' : 'bg-zinc-800 text-zinc-500'}`}>
                      {report.status === 'pending' ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-black uppercase tracking-widest text-zinc-400">Report from</span>
                        <span className="text-xs font-bold text-theme-white truncate">{report.reporterName}</span>
                      </div>
                      <h3 className="font-bold text-sm text-zinc-300 truncate">{report.reason}</h3>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1">
                        <Clock size={10} />
                        {report.createdAt?.toDate().toLocaleDateString()}
                      </div>
                      {expandedReport === report.id ? <ChevronDown size={16} className="text-zinc-600" /> : <ChevronRight size={16} className="text-zinc-600" />}
                    </div>
                  </button>

                  <AnimatePresence>
                    {expandedReport === report.id && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-theme-white/5 bg-zinc-900/40"
                      >
                        <div className="p-6 space-y-6">
                          <div className="space-y-3">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-500/70">Reported Content</h4>
                            {targetPost ? (
                              <div className="bg-theme-black/40 rounded-2xl p-4 border border-theme-white/5 space-y-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-lg bg-zinc-800 overflow-hidden">
                                    {targetPost.authorPhotoURL && <img src={targetPost.authorPhotoURL} className="w-full h-full object-cover" alt="" />}
                                  </div>
                                  <span className="text-xs font-bold text-zinc-400">{targetPost.authorName}</span>
                                </div>
                                <p className="text-sm text-zinc-200">{targetPost.content}</p>
                                {targetPost.mediaUrl && (
                                  <div className="mt-2 rounded-xl overflow-hidden bg-zinc-800">
                                    {targetPost.mediaType === 'video' ? (
                                      <video src={targetPost.mediaUrl} className="w-full max-h-40 object-cover" />
                                    ) : (
                                      <img src={targetPost.mediaUrl} className="w-full max-h-40 object-cover" alt="" />
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="p-4 bg-zinc-950 rounded-2xl border border-theme-white/5 text-center italic text-xs text-zinc-600">
                                Post may have been deleted or expired
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <button 
                              onClick={() => handleAction(report.id, 'dismiss')}
                              disabled={actioning || report.status !== 'pending'}
                              className="flex flex-col items-center justify-center p-4 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 rounded-2xl transition-all gap-2"
                            >
                              <CheckCircle size={20} className="text-zinc-400" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Keep</span>
                            </button>
                            <button 
                              onClick={() => handleAction(report.id, 'delete_post')}
                              disabled={actioning || report.status !== 'pending'}
                              className="flex flex-col items-center justify-center p-4 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-30 rounded-2xl transition-all border border-red-500/20 gap-2"
                            >
                              <Trash2 size={20} className="text-red-500" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Delete Post</span>
                            </button>
                            <button 
                              onClick={() => handleAction(report.id, 'ban_user')}
                              disabled={actioning || report.status !== 'pending' || !report.authorId}
                              className="flex flex-col items-center justify-center p-4 bg-red-900/20 hover:bg-red-900/30 disabled:opacity-30 rounded-2xl transition-all border border-red-900/30 gap-2"
                            >
                              <UserX size={20} className="text-red-600" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-red-600">Ban User</span>
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === 'broadcast' && (
          <div className="bg-zinc-900/50 rounded-[30px] p-6 border border-zinc-800 space-y-6">
            <h3 className="text-sm font-bold text-theme-white">{t.sendBroadcast || 'Send Broadcast Message'}</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">{t.targetAudience || 'Target Audience'}</label>
                <div className="grid grid-cols-1 gap-2">
                  <button 
                    onClick={() => setBroadcastAudience('all')}
                    className={`p-3 text-sm font-bold rounded-xl text-start transition-all ${broadcastAudience === 'all' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-[var(--theme-bg-body)] text-zinc-400 border border-transparent'}`}
                  >
                    {t.allUsers || 'All Users'}
                  </button>
                  <button 
                    onClick={() => setBroadcastAudience('hometown')}
                    className={`p-3 text-sm font-bold rounded-xl text-start transition-all ${broadcastAudience === 'hometown' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-[var(--theme-bg-body)] text-zinc-400 border border-transparent'}`}
                  >
                    {t.byHometown || 'By Hometown'}
                  </button>
                  <button 
                    onClick={() => setBroadcastAudience('location')}
                    className={`p-3 text-sm font-bold rounded-xl text-start transition-all ${broadcastAudience === 'location' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-[var(--theme-bg-body)] text-zinc-400 border border-transparent'}`}
                  >
                    {t.byLocation || 'By Current Residence'}
                  </button>
                </div>
              </div>

              {broadcastAudience !== 'all' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">{broadcastAudience === 'hometown' ? t.byHometown : t.byLocation}</label>
                  <input
                    type="text"
                    value={targetString}
                    onChange={(e) => setTargetString(e.target.value)}
                    placeholder="E.g. Beirut, Tripoli..."
                    className="w-full bg-[var(--theme-bg-body)] border-none rounded-xl p-4 focus:ring-2 focus:ring-amber-500 transition-all outline-none text-theme-white placeholder-zinc-700"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">{t.messageContent || 'Message Content'}</label>
                <textarea
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Type your message here..."
                  className="w-full bg-[var(--theme-bg-body)] border-none rounded-xl p-4 min-h-[120px] focus:ring-2 focus:ring-amber-500 transition-all outline-none text-theme-white resize-none placeholder-zinc-700"
                />
              </div>

              <button
                onClick={handleBroadcast}
                disabled={broadcasting || !broadcastMessage.trim() || (broadcastAudience !== 'all' && !targetString.trim())}
                className="w-full bg-amber-500 text-theme-black font-black uppercase tracking-widest py-4 rounded-2xl hover:opacity-90 disabled:opacity-50 transition-all mt-4"
              >
                {broadcasting ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-theme-black/30 border-t-black rounded-full animate-spin" />
                    <span>{t.saving || 'Sending...'}</span>
                  </div>
                ) : (
                  t.send || 'Send'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
