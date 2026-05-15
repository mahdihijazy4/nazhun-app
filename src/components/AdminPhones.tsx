import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Download, Users } from 'lucide-react';

interface CombinedUserInfo {
  id: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  hometown?: string;
  birthDate?: string;
  gender?: string;
  createdAt?: any;
}

export const AdminPhones: React.FC = () => {
  const { language, t } = useAuth();
  const [usersInfo, setUsersInfo] = useState<CombinedUserInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        // Fetch private info
        const privateQ = query(collection(db, 'private_user_info'));
        const privateSnapshot = await getDocs(privateQ);
        const privateData = new Map(privateSnapshot.docs.map(doc => [
          doc.id, 
          doc.data()
        ]));

        // Fetch public user info
        const usersQ = query(collection(db, 'users'));
        const usersSnapshot = await getDocs(usersQ);
        const mergedData = usersSnapshot.docs.map(doc => {
          const publicData = doc.data();
          const privateInfo = privateData.get(doc.id) || {};
          
          return {
            id: doc.id,
            name: publicData.name || privateInfo.name,
            email: privateInfo.email || publicData.email,
            phoneNumber: privateInfo.phoneNumber,
            hometown: publicData.hometown,
            birthDate: publicData.birthDate,
            gender: publicData.gender,
            createdAt: publicData.createdAt || privateInfo.createdAt
          } as CombinedUserInfo;
        });

        // Also add users that might only exist in private_user_info
        privateData.forEach((priData: any, id: string) => {
          if (!mergedData.find(u => u.id === id)) {
            mergedData.push({
              id,
              name: priData.name,
              email: priData.email,
              phoneNumber: priData.phoneNumber,
              createdAt: priData.createdAt
            });
          }
        });

        setUsersInfo(mergedData);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'users/private_user_info');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const exportToCsv = () => {
    const headers = ['Name', 'Email', 'Phone Number', 'Village/Hometown', 'Birth Date', 'Gender', 'User ID'];
    const rows = usersInfo.map(u => [
      `"${u.name || ''}"`,
      `"${u.email || ''}"`,
      `"${u.phoneNumber || ''}"`,
      `"${u.hometown || ''}"`,
      `"${u.birthDate || ''}"`,
      `"${u.gender || ''}"`,
      `"${u.id}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'users_data.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
     return (
       <div className="flex justify-center py-20">
         <div className="w-8 h-8 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
       </div>
     );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-theme-white">
          <Users size={20} className="text-zinc-400" />
          <h3 className="text-sm font-bold">{usersInfo.length} {t.registeredUsers}</h3>
        </div>
        
        <button 
          onClick={exportToCsv}
          className="flex items-center gap-2 bg-village-green text-theme-black px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] hover:opacity-90 transition-opacity"
        >
          <Download size={14} />
          {t.exportExcel}
        </button>
      </div>

      <div className="bg-zinc-900/50 rounded-[30px] border border-zinc-800 overflow-hidden">
         <div className="overflow-x-auto">
           <table className="w-full text-left text-sm text-zinc-300">
             <thead className="text-[10px] uppercase font-black tracking-widest text-zinc-500 bg-zinc-900 border-b border-zinc-800 whitespace-nowrap">
               <tr>
                 <th className="px-6 py-4">{t.name}</th>
                 <th className="px-6 py-4">{t.email}</th>
                 <th className="px-6 py-4">{t.phone}</th>
                 <th className="px-6 py-4">{t.village}</th>
                 <th className="px-6 py-4">{t.birthDateTab}</th>
                 <th className="px-6 py-4">{t.genderTab}</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-zinc-800/50">
               {usersInfo.map((u) => (
                 <tr key={u.id} className="hover:bg-theme-white/5 transition-colors whitespace-nowrap">
                   <td className="px-6 py-4 font-medium text-theme-white">{u.name || '-'}</td>
                   <td className="px-6 py-4">{u.email || '-'}</td>
                   <td className="px-6 py-4 font-mono">{u.phoneNumber || '-'}</td>
                   <td className="px-6 py-4">{u.hometown || '-'}</td>
                   <td className="px-6 py-4 font-mono">{u.birthDate || '-'}</td>
                   <td className="px-6 py-4">
                     {u.gender === 'male' ? t.male : 
                      u.gender === 'female' ? t.female : 
                      u.gender ? u.gender : '-'}
                   </td>
                 </tr>
               ))}
               {usersInfo.length === 0 && (
                 <tr>
                   <td colSpan={6} className="px-6 py-10 text-center text-zinc-500 italic">
                     {t.noData}
                   </td>
                 </tr>
               )}
             </tbody>
           </table>
         </div>
      </div>
    </div>
  );
};

