import { useState, useEffect } from 'react';
import { collection, query, getDocs, updateDoc, doc, deleteDoc, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { UserProfile } from '../types';
import { ShieldCheck, UserX, UserCheck, Trash2, Edit2, Check, X, Search } from 'lucide-react';
import { format } from 'date-fns';

export function AdminUsers() {
  const { t, language, profile: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({});

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      // getDocs doesn't support generic string searching well, so we'll fetch heavily and filter client side
      // for a small to medium app.
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => doc.data() as UserProfile);
      setUsers(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAdmin = async (userId: string, currentStatus: boolean) => {
    if (userId === currentUser?.uid) return; // Prevent removing own admin
    try {
      await updateDoc(doc(db, 'users', userId), { isAdmin: !currentStatus });
      setUsers(users.map(u => u.uid === userId ? { ...u, isAdmin: !currentStatus } : u));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  const confirmDeleteUser = async (userId: string) => {
    try {
      await deleteDoc(doc(db, 'users', userId));
      setUsers(users.filter(u => u.uid !== userId));
      setUserToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
    }
  };

  const handleDeleteUser = (userId: string) => {
    if (userId === currentUser?.uid) return; 
    setUserToDelete(userId);
  };

  const startEditing = (user: UserProfile) => {
    setEditingUser(user.uid);
    setEditForm({
      name: user.name,
      hometown: user.hometown,
      currentLocation: user.currentLocation,
    });
  };

  const saveEdit = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), editForm);
      setUsers(users.map(u => u.uid === userId ? { ...u, ...editForm } : u));
      setEditingUser(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.hometown?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.currentLocation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-theme-white/5 rounded-3xl p-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
           <h2 className="text-xl font-black uppercase tracking-widest">{t.userManagement} ({filteredUsers.length})</h2>
           <div className="relative w-full md:w-64">
             <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
             <input
               type="text"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               placeholder={t.searchUsers}
               className="w-full bg-[var(--theme-bg-body)] border-none rounded-2xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-amber-500 transition-all outline-none"
             />
           </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map((user) => (
              <div key={user.uid} className="bg-theme-black/40 border border-theme-white/5 p-4 rounded-2xl flex flex-col md:flex-row gap-4 md:items-center justify-between">
                
                {editingUser === user.uid ? (
                   <div className="flex-1 space-y-3">
                     <input 
                       value={editForm.name || ''} 
                       onChange={e => setEditForm({...editForm, name: e.target.value})} 
                       className="w-full bg-zinc-900 px-3 py-2 rounded-xl text-sm border-none outline-none focus:ring-1 focus:ring-amber-500" 
                       placeholder="Name"
                     />
                     <div className="flex gap-2">
                       <input 
                         value={editForm.hometown || ''} 
                         onChange={e => setEditForm({...editForm, hometown: e.target.value})} 
                         className="flex-1 bg-zinc-900 px-3 py-2 rounded-xl text-sm border-none outline-none" 
                         placeholder="Hometown"
                       />
                       <input 
                         value={editForm.currentLocation || ''} 
                         onChange={e => setEditForm({...editForm, currentLocation: e.target.value})} 
                         className="flex-1 bg-zinc-900 px-3 py-2 rounded-xl text-sm border-none outline-none" 
                         placeholder="Current Location"
                       />
                     </div>
                   </div>
                ) : (
                   <div className="flex items-center gap-4 flex-1">
                     <div className="w-12 h-12 rounded-full overflow-hidden bg-zinc-800 flex-shrink-0">
                       {user.photoURL ? (
                         <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
                       ) : (
                         <div className="w-full h-full flex items-center justify-center text-zinc-500 font-bold uppercase">{user.name?.[0]}</div>
                       )}
                     </div>
                     <div>
                        <div className="flex items-center gap-2">
                           <h4 className="font-bold text-sm tracking-wide">{user.name}</h4>
                           {user.isAdmin && <ShieldCheck size={14} className="text-amber-500" />}
                        </div>
                        <div className="text-xs text-zinc-500 truncate max-w-[200px] md:max-w-[400px]">
                           {user.email} • {language === 'ar' ? 'من' : 'From'} {user.hometown || '?'} {language === 'ar' ? 'إلى' : 'to'} {user.currentLocation || '?'}
                        </div>
                        {user.createdAt && (
                           <div className="text-[10px] text-zinc-600 font-medium tracking-wider mt-0.5">
                             Joined {format(user.createdAt.toDate(), 'PP')}
                           </div>
                        )}
                     </div>
                   </div>
                )}

                <div className="flex items-center gap-2 self-end md:self-auto border-t border-theme-white/5 md:border-t-0 pt-3 md:pt-0 mt-3 md:mt-0 w-full md:w-auto justify-end">
                   {editingUser === user.uid ? (
                      <>
                        <button onClick={() => saveEdit(user.uid)} className="p-2 bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded-xl transition-colors">
                          <Check size={16} />
                        </button>
                        <button onClick={() => setEditingUser(null)} className="p-2 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 rounded-xl transition-colors">
                          <X size={16} />
                        </button>
                      </>
                   ) : (
                      <>
                        <button onClick={() => startEditing(user)} className="p-2 bg-zinc-800 text-zinc-400 hover:text-theme-white rounded-xl transition-colors" title="Edit User">
                           <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleToggleAdmin(user.uid, !!user.isAdmin)} 
                          className={`p-2 rounded-xl transition-colors flex items-center gap-2 text-xs font-bold ${user.isAdmin ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' : 'bg-zinc-800 text-zinc-400 hover:text-theme-white'}`}
                          title="Toggle Admin"
                          disabled={user.uid === currentUser?.uid}
                        >
                           {user.isAdmin ? <UserX size={16} /> : <UserCheck size={16} />}
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(user.uid)} 
                          className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl transition-colors disabled:opacity-50"
                          title="Delete User"
                          disabled={user.uid === currentUser?.uid}
                        >
                           <Trash2 size={16} />
                        </button>
                      </>
                   )}
                </div>
              </div>
            ))}
            {filteredUsers.length === 0 && (
              <div className="text-center py-12 text-zinc-500 text-sm font-bold tracking-widest uppercase">
                 No users found.
              </div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {userToDelete && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-theme-black/80 backdrop-blur-sm"
            onClick={() => setUserToDelete(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900 border border-theme-white/10 rounded-[32px] p-6 max-w-sm w-full shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center">
                <h4 className="font-black uppercase tracking-widest text-lg text-theme-white">
                  Delete User Profile
                </h4>
                <button onClick={() => setUserToDelete(null)} className="p-2 text-zinc-500 hover:text-theme-white transition-colors bg-theme-white/5 rounded-full">
                 <X size={20} />
               </button>
              </div>
              <p className="text-sm font-medium text-zinc-400">
                Are you sure you want to delete this user's profile data? Their auth account will remain.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setUserToDelete(null)}
                  className="flex-1 bg-theme-white/10 text-theme-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-theme-white/20 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirmDeleteUser(userToDelete)}
                  className="flex-1 bg-red-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-400 transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
