import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Edit2, Trash2, MapPin, X, Check, Clock, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import * as xlsx from 'xlsx';

export interface LocationDoc {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface LocationRequestDoc {
  id: string;
  name: string;
  requestedBy: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
}

export function AdminLocations() {
  const { language, t } = useAuth();
  const [locations, setLocations] = useState<LocationDoc[]>([]);
  const [requests, setRequests] = useState<LocationRequestDoc[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState<LocationDoc | null>(null);
  const [deleteLoc, setDeleteLoc] = useState<LocationDoc | null>(null);
  
  const [name, setName] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = xlsx.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = xlsx.utils.sheet_to_json<any>(worksheet, { header: 1 });

      // Assuming row[0] = name, row[1] = lat, row[2] = lng
      // Skip header if first row is strings for lat/lng
      let startIndex = 0;
      if (json.length > 0 && typeof json[0][1] === 'string' && isNaN(parseFloat(json[0][1]))) {
        startIndex = 1;
      }

      const chunks = [];
      let currentChunk = [];
      for (let i = startIndex; i < json.length; i++) {
        const row = json[i];
        if (!row || !row[0]) continue;
        const name = String(row[0]).trim();
        const lat = parseFloat(row[1]);
        const lng = parseFloat(row[2]);

        if (name && !isNaN(lat) && !isNaN(lng)) {
          currentChunk.push({ name, lat, lng });
          if (currentChunk.length === 500) {
            chunks.push(currentChunk);
            currentChunk = [];
          }
        }
      }
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        for (const loc of chunk) {
          const docRef = doc(collection(db, 'locations'));
          batch.set(docRef, { ...loc, createdAt: serverTimestamp() });
        }
        await batch.commit();
      }

      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error(error);
      alert('Error importing Excel file');
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    const qLocs = query(collection(db, 'locations'), orderBy('name'));
    const unsubLocs = onSnapshot(qLocs, (snapshot) => {
      setLocations(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LocationDoc)));
    }, err => {
      handleFirestoreError(err, OperationType.LIST, 'locations');
    });

    const qReqs = query(collection(db, 'location_requests'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
    const unsubReqs = onSnapshot(qReqs, (snapshot) => {
      setRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LocationRequestDoc)));
      setLoading(false);
    }, err => {
      handleFirestoreError(err, OperationType.LIST, 'location_requests');
    });

    return () => {
      unsubLocs();
      unsubReqs();
    };
  }, []);

  const handleOpenModal = (loc: LocationDoc | null = null) => {
    if (loc) {
      setEditingLoc(loc);
      setName(loc.name);
      setLat(loc.lat.toString());
      setLng(loc.lng.toString());
    } else {
      setEditingLoc(null);
      setName('');
      setLat('');
      setLng('');
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !lat || !lng) return;
    setProcessing(true);
    try {
      const parsedLat = parseFloat(lat);
      const parsedLng = parseFloat(lng);
      
      if (isNaN(parsedLat) || isNaN(parsedLng)) {
        alert(t.invalidCoords);
        setProcessing(false);
        return;
      }

      if (editingLoc) {
        await updateDoc(doc(db, 'locations', editingLoc.id), {
          name: name.trim(),
          lat: parsedLat,
          lng: parsedLng
        });
      } else {
        await addDoc(collection(db, 'locations'), {
          name: name.trim(),
          lat: parsedLat,
          lng: parsedLng,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, editingLoc ? OperationType.UPDATE : OperationType.CREATE, 'locations');
    } finally {
      setProcessing(false);
    }
  };

  const confirmDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'locations', id));
      setDeleteLoc(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `locations/${id}`);
    }
  };

  const handleDelete = (location: LocationDoc) => {
    setDeleteLoc(location);
  };

  const handleApproveRequest = async (req: LocationRequestDoc) => {
    setName(req.name);
    setLat('');
    setLng('');
    setIsModalOpen(true);
    setEditingLoc(null);
    try {
      // Mark as approved (could do this after successful Add Location, but for simplicity here)
      await updateDoc(doc(db, 'location_requests', req.id), { status: 'approved' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `location_requests/${req.id}`);
    }
  };

  const handleRejectRequest = async (reqId: string) => {
    try {
      await updateDoc(doc(db, 'location_requests', reqId), { status: 'rejected' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `location_requests/${reqId}`);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-theme-white/50">{t.loading}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-black uppercase tracking-widest">{t.manageLocations}</h3>
        <div className="flex gap-2">
          <input 
            type="file" 
            accept=".xlsx, .xls, .csv" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleImportExcel} 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={processing}
            className="bg-amber-500/20 text-amber-500 border border-amber-500/30 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
          >
            <Upload size={16} />
            {processing ? t.savingAdmin : t.importExcelLocation}
          </button>
          <button 
            onClick={() => handleOpenModal()}
            className="bg-amber-500 text-theme-black px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-amber-400"
          >
            <Plus size={16} />
            {t.addLocation}
          </button>
        </div>
      </div>

      <div className="bg-[var(--theme-bg-body)] border border-theme-white/10 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-theme-white/5 text-xs font-black uppercase tracking-widest text-zinc-400">
              <tr>
                <th className="p-4">{t.name}</th>
                <th className="p-4">{t.latCol}</th>
                <th className="p-4">{t.lngCol}</th>
                <th className="p-4 text-right">{t.actionsCol}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-sm">
              {locations.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-zinc-500">
                    {t.noLocations}
                  </td>
                </tr>
              )}
              {locations.map((loc) => (
                <tr key={loc.id} className="hover:bg-theme-white/5 transition-colors">
                  <td className="p-4 font-bold">{loc.name}</td>
                  <td className="p-4 text-zinc-400 font-mono text-xs">{loc.lat}</td>
                  <td className="p-4 text-zinc-400 font-mono text-xs">{loc.lng}</td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                       <button 
                         onClick={() => handleOpenModal(loc)}
                         className="p-2 bg-village-green/20 text-village-green rounded-lg hover:bg-village-green/30 transition-colors"
                       >
                         <Edit2 size={16} />
                       </button>
                       <button 
                         onClick={() => handleDelete(loc)}
                         className="p-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 transition-colors"
                       >
                         <Trash2 size={16} />
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {requests.length > 0 && (
        <div className="space-y-4 pt-4">
          <h3 className="text-xl font-black uppercase tracking-widest text-amber-500 flex items-center gap-2">
            <Clock size={20} />
            {t.pendingRequests} ({requests.length})
          </h3>
          <div className="bg-[var(--theme-bg-body)] border border-amber-500/30 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-amber-500/10 text-xs font-black uppercase tracking-widest text-amber-500">
                  <tr>
                    <th className="p-4">{t.requestedName}</th>
                    <th className="p-4 text-right">{t.actionsCol}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-sm">
                  {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-theme-white/5 transition-colors">
                      <td className="p-4 font-bold">{req.name}</td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => handleApproveRequest(req)}
                            className="p-2 bg-village-green/20 text-village-green rounded-lg hover:bg-village-green/30 transition-colors flex items-center gap-1"
                            title={t.createAction}
                          >
                            <Plus size={16} />
                          </button>
                          <button 
                            onClick={() => handleRejectRequest(req.id)}
                            className="p-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 transition-colors flex items-center gap-1"
                            title={t.rejectAction}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-theme-black/80 backdrop-blur-sm"
          onClick={() => setIsModalOpen(false)}>
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="bg-zinc-900 border border-theme-white/10 rounded-[32px] p-6 max-w-sm w-full shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-black uppercase tracking-widest text-lg">
                {editingLoc ? t.editLocation : t.newLocation}
              </h4>
              <button onClick={() => setIsModalOpen(false)} className="p-2 glass rounded-full hover:bg-theme-white/10">
                <X size={16} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-zinc-500 block mb-2">{t.locationNameField}</label>
                <input 
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.locationNamePlaceholder}
                  className="w-full bg-[var(--theme-bg-body)] border border-theme-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-zinc-500 block mb-2">{t.latField}</label>
                <input 
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="33.8938"
                  className="w-full bg-[var(--theme-bg-body)] border border-theme-white/10 rounded-2xl p-4 text-sm font-mono focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-zinc-500 block mb-2">{t.lngField}</label>
                <input 
                  type="number"
                  step="any"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  placeholder="35.5018"
                  className="w-full bg-[var(--theme-bg-body)] border border-theme-white/10 rounded-2xl p-4 text-sm font-mono focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            <button 
              onClick={handleSave}
              disabled={processing || !name.trim() || !lat || !lng}
              className="w-full mt-4 bg-amber-500 text-theme-black py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-amber-400 disabled:opacity-50 transition-colors"
            >
              {processing ? t.savingAdmin : t.saveLocation}
            </button>
          </motion.div>
        </div>
      )}

      <AnimatePresence>
        {deleteLoc && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-theme-black/80 backdrop-blur-sm"
            onClick={() => setDeleteLoc(null)}
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
                  Delete Location
                </h4>
                <button onClick={() => setDeleteLoc(null)} className="p-2 text-zinc-500 hover:text-theme-white transition-colors bg-theme-white/5 rounded-full">
                 <X size={20} />
               </button>
              </div>
              <p className="text-sm font-medium text-zinc-400">
                {t.confirmDeleteLocation} {deleteLoc.name}?
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setDeleteLoc(null)}
                  className="flex-1 bg-theme-white/10 text-theme-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-theme-white/20 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirmDelete(deleteLoc.id)}
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
