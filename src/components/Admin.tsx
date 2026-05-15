import { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, limit, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Users, FileText, MapPin, Activity, ShieldCheck, Settings, TrendingUp, Trash2, AlertTriangle, Megaphone, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { AdminPanel } from './AdminPanel';
import { AdminBroadcast } from './AdminBroadcast';
import { AdminLocations } from './AdminLocations';
import { AdminUsers } from './AdminUsers';
import { AdminPhones } from './AdminPhones';
import { AdminAds } from './AdminAds';

export function Admin() {
  const { t, profile, language } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'stats' | 'users' | 'reports' | 'posts' | 'broadcast' | 'services' | 'locations' | 'phones' | 'ads'>('stats');

  useEffect(() => {
    const handleGoLocations = () => setActiveSubTab('locations');
    window.addEventListener('go-admin-locations', handleGoLocations);
    return () => window.removeEventListener('go-admin-locations', handleGoLocations);
  }, []);

  const [stats, setStats] = useState({
    users: 0,
    posts: 0,
    villages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [allPosts, setAllPosts] = useState<any[]>([]);

  useEffect(() => {
    if (!profile?.isAdmin) return;

    // Fetch all posts for management
    const unsubAllPosts = onSnapshot(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(100)), (s) => {
      setAllPosts(s.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'posts');
    });

    // Fetch config
    const unsubConfig = onSnapshot(doc(db, 'system', 'config'), (d) => {
      if (d.exists()) {
        const data = d.data();
        setServices(data.services || []);
      } else if (profile?.uid) {
        // Initial setup - only if not exists and current user is Admin
        const initialServices = [
          { id: 'posts', name: 'Post Creation', status: 'Active' },
          { id: 'comments', name: 'Comments & Replies', status: 'Active' },
          { id: 'media', name: 'Media Uploads', status: 'Active' },
          { id: 'chats', name: 'Real-time Chat', status: 'Active' },
        ];
        setDoc(doc(db, 'system', 'config'), { services: initialServices })
          .catch(error => handleFirestoreError(error, OperationType.WRITE, 'system/config'));
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'system/config'));

    const unsubUsers = onSnapshot(collection(db, 'users'), (s) => {
      setStats(prev => ({ ...prev, users: s.size }));
      // Process chart data for users
      updateChartData(s.docs, 'users');
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    const unsubPosts = onSnapshot(collection(db, 'posts'), (s) => {
      setStats(prev => ({ ...prev, posts: s.size }));
      // Process chart data for posts
      updateChartData(s.docs, 'posts');
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'posts'));

    const updateChartData = (docs: any[], type: 'users' | 'posts') => {
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return {
          name: d.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'short' }),
          dateStr: d.toDateString(),
          users: 0,
          posts: 0
        };
      });

      const counts = new Map<string, number>();
      docs.forEach(doc => {
        const data = doc.data();
        if (data.createdAt && typeof data.createdAt.toDate === 'function') {
          const date = data.createdAt.toDate().toDateString();
          counts.set(date, (counts.get(date) || 0) + 1);
        }
      });

      setChartData(prev => {
        const newChartData = last7Days.map(day => {
          const count = counts.get(day.dateStr) || 0;
          const existingDay = prev.find(p => p.dateStr === day.dateStr);
          
          return {
            ...day,
            users: type === 'users' ? count : (existingDay?.users || 0),
            posts: type === 'posts' ? count : (existingDay?.posts || 0)
          };
        });
        return newChartData;
      });
    };

    // Villages calculation - we'd normally use a unique set
    const fetchVillages = async () => {
      try {
        const q = query(collection(db, 'users'));
        const s = await getDocs(q);
        const villages = new Set(s.docs.map(d => d.data().hometown));
        setStats(prev => ({ ...prev, villages: villages.size }));
        setLoading(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    };

    fetchVillages();

    return () => {
      unsubUsers();
      unsubPosts();
      unsubConfig();
      unsubAllPosts();
    };
  }, [profile, language]);

  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  const handleDeletePost = async (postId: string) => {
    try {
      await deleteDoc(doc(db, 'posts', postId));
      setDeletingPostId(null);
    } catch (error: any) {
      console.error("Admin delete failed:", error);
      alert(t.deleteFailed + error.message);
      handleFirestoreError(error, OperationType.DELETE, `posts/${postId}`);
    }
  };

  const toggleService = async (serviceId: string) => {
    try {
      const updated = services.map(s => {
        if (s.id === serviceId) {
          return { ...s, status: s.status === 'Active' ? 'Restricted' : 'Active' };
        }
        return s;
      });
      await setDoc(doc(db, 'system', 'config'), { services: updated });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'system/config');
    }
  };

  if (!profile?.isAdmin) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-center space-y-4">
        <ShieldCheck size={64} className="text-zinc-800" />
        <h2 className="text-2xl font-black italic tracking-tighter uppercase">{t.admin} Restricted</h2>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 bg-[var(--theme-bg-body)] text-theme-white min-h-full pb-24">
      <div className="space-y-2">
        <h1 className="text-5xl font-black italic tracking-tighter uppercase">{t.admin}</h1>
        <p className="text-zinc-500 font-bold tracking-widest text-[10px] uppercase">Control Center</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {[
          { id: 'stats', label: t.stats, icon: Activity },
          { id: 'users', label: t.usersMenu, icon: Users },
          { id: 'phones', label: t.userDataMenu, icon: Users },
          { id: 'reports', label: t.manageReports, icon: AlertTriangle },
          { id: 'posts', label: t.postsMenu, icon: FileText },
          { id: 'broadcast', label: t.broadcastMessage || 'Broadcast Message', icon: Megaphone },
          { id: 'ads', label: t.ads || 'Ads', icon: DollarSign },
          { id: 'services', label: t.services, icon: Settings },
          { id: 'locations', label: t.locationsMenu, icon: MapPin },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl whitespace-nowrap transition-all font-black uppercase tracking-widest text-[10px] ${
              activeSubTab === tab.id ? 'bg-theme-white text-theme-black' : 'bg-zinc-900 text-zinc-500 border border-theme-white/5'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeSubTab === 'stats' && (
          <motion.div
            key="stats"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-zinc-900/50 p-8 rounded-[40px] border border-zinc-800/50 space-y-4">
                <div className="w-12 h-12 bg-theme-white/5 rounded-2xl flex items-center justify-center">
                  <Users className="text-theme-white" />
                </div>
                <div>
                  <div className="text-4xl font-black italic tracking-tighter">{stats.users}</div>
                  <div className="text-[10px] uppercase font-black tracking-widest text-zinc-500">{t.totalUsers}</div>
                </div>
              </div>

              <div className="bg-zinc-900/50 p-8 rounded-[40px] border border-zinc-800/50 space-y-4">
                <div className="w-12 h-12 bg-theme-white/5 rounded-2xl flex items-center justify-center">
                  <FileText className="text-theme-white" />
                </div>
                <div>
                  <div className="text-4xl font-black italic tracking-tighter">{stats.posts}</div>
                  <div className="text-[10px] uppercase font-black tracking-widest text-zinc-500">{t.totalPosts}</div>
                </div>
              </div>

              <div className="bg-zinc-900/50 p-8 rounded-[40px] border border-zinc-800/50 space-y-4">
                <div className="w-12 h-12 bg-theme-white/5 rounded-2xl flex items-center justify-center">
                  <MapPin className="text-theme-white" />
                </div>
                <div>
                  <div className="text-4xl font-black italic tracking-tighter">{stats.villages}</div>
                  <div className="text-[10px] uppercase font-black tracking-widest text-zinc-500">{t.activeLocations}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-zinc-900/50 p-8 rounded-[40px] border border-zinc-800/50 space-y-6">
                 <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black italic tracking-tighter uppercase flex items-center gap-2">
                       <TrendingUp size={20} className="text-green-500" />
                       Growth Trend
                    </h3>
                 </div>
                 <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={chartData}>
                          <defs>
                             <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--theme-white)" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="var(--theme-white)" stopOpacity={0}/>
                             </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--theme-zinc-600)" vertical={false} />
                          <XAxis dataKey="name" stroke="var(--theme-zinc-500)" fontSize={10} axisLine={false} tickLine={false} />
                          <YAxis stroke="var(--theme-zinc-500)" fontSize={10} axisLine={false} tickLine={false} />
                          <Tooltip 
                             contentStyle={{ border: 'none', borderRadius: '16px', background: 'var(--theme-zinc-900)', color: 'var(--theme-zinc-100)' }}
                             itemStyle={{ color: 'var(--theme-white)', fontSize: '12px', fontWeight: 'bold' }}
                          />
                          <Area type="monotone" dataKey="users" stroke="var(--theme-white)" fillOpacity={1} fill="url(#colorUsers)" strokeWidth={3} />
                       </AreaChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              <div className="bg-zinc-900/50 p-8 rounded-[40px] border border-zinc-800/50 space-y-6">
                 <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black italic tracking-tighter uppercase flex items-center gap-2">
                       <Activity size={20} className="text-blue-500" />
                       Post Activity
                    </h3>
                 </div>
                 <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--theme-zinc-600)" vertical={false} />
                          <XAxis dataKey="name" stroke="var(--theme-zinc-500)" fontSize={10} axisLine={false} tickLine={false} />
                          <YAxis stroke="var(--theme-zinc-500)" fontSize={10} axisLine={false} tickLine={false} />
                          <Tooltip 
                             contentStyle={{ border: 'none', borderRadius: '16px', background: 'var(--theme-zinc-900)', color: 'var(--theme-zinc-100)' }}
                             cursor={{ fill: 'var(--theme-zinc-500)', opacity: 0.1 }}
                          />
                          <Bar dataKey="posts" fill="var(--theme-white)" radius={[4, 4, 0, 0]} />
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeSubTab === 'users' && (
          <motion.div
            key="users"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <AdminUsers />
          </motion.div>
        )}

        {activeSubTab === 'phones' && (
          <motion.div
            key="phones"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <AdminPhones />
          </motion.div>
        )}

        {activeSubTab === 'reports' && (
          <motion.div
            key="reports"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <AdminPanel />
          </motion.div>
        )}

        {activeSubTab === 'posts' && (
          <motion.div 
            key="posts"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-zinc-900/50 p-8 rounded-[40px] border border-zinc-800/50 space-y-8"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <FileText className="text-zinc-500" />
                <h3 className="text-2xl font-black italic tracking-tighter uppercase">{t.managePosts}</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto scrollbar-hide">
              {allPosts.map(post => (
                <div key={post.id} className="bg-theme-black/40 p-4 rounded-3xl border border-theme-white/5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 overflow-hidden">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-800 overflow-hidden flex-shrink-0">
                      {post.mediaUrl ? (
                        <img src={post.mediaUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-600"><FileText size={20} /></div>
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="font-bold text-sm truncate">{post.content}</p>
                      <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest truncate">{post.authorName} • {post.authorHometown}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setDeletingPostId(post.id)}
                    className="p-3 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-theme-white transition-all shadow-lg"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
              {allPosts.length === 0 && (
                <p className="text-center text-zinc-500 py-10 font-bold uppercase tracking-widest text-[10px]">No posts found</p>
              )}
            </div>
          </motion.div>
        )}

        {activeSubTab === 'broadcast' && (
          <motion.div
            key="broadcast"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <AdminBroadcast />
          </motion.div>
        )}

        {activeSubTab === 'services' && (
          <motion.div 
            key="services"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-zinc-900/50 p-8 rounded-[40px] border border-zinc-800/50 space-y-8"
          >
            <div className="flex items-center gap-4">
              <Settings className="text-zinc-500" />
              <h3 className="text-2xl font-black italic tracking-tighter uppercase">{t.services}</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {services.map(service => (
                <button 
                  key={service.id} 
                  onClick={() => toggleService(service.id)}
                  className="w-full flex items-center justify-between p-6 bg-theme-black/30 rounded-3xl border border-zinc-800/20 hover:bg-theme-black/50 transition-colors"
                >
                  <div className="font-bold">{service.name}</div>
                  <div className={`text-[10px] uppercase font-black tracking-widest px-3 py-1 rounded-full ${service.status === 'Active' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'}`}>
                    {service.status}
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {activeSubTab === 'locations' && (
          <motion.div 
            key="locations"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <AdminLocations />
          </motion.div>
        )}

        {activeSubTab === 'ads' && (
          <motion.div 
            key="ads"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <AdminAds />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingPostId && (
          <div 
            className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-theme-black/80 backdrop-blur-md"
            onClick={() => setDeletingPostId(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900 border border-theme-white/10 p-8 rounded-[40px] max-w-sm w-full space-y-6 shadow-2xl"
            >
              <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <Trash2 size={32} />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black uppercase tracking-tighter">{t.deletePostAdmin}</h3>
                <p className="text-zinc-500 text-sm font-medium">{t.areYouSureDelete}</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => handleDeletePost(deletingPostId)}
                  className="flex-1 bg-red-500 text-theme-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-red-500/20"
                >
                  {t.yesDelete}
                </button>
                <button 
                  onClick={() => setDeletingPostId(null)}
                  className="flex-1 bg-zinc-800 text-theme-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px]"
                >
                  {t.cancel}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
