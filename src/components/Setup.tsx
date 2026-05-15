import React, { useState, useEffect } from 'react';
import { doc, setDoc, serverTimestamp, collection, addDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Home, ArrowRight, User, Calendar, Plus, X, Phone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocations } from '../hooks/useLocations';
import { sendNotification } from '../services/notificationService';
import { SearchableSelect } from './SearchableSelect';

export function Setup() {
  const { t, language } = useAuth();
  const { locations } = useLocations();
  const [name, setName] = useState(auth.currentUser?.displayName || '');
  const [hometown, setHometown] = useState('');
  const [currentLocation, setCurrentLocation] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [birthDate, setBirthDate] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestLocationName, setRequestLocationName] = useState('');
  const [requestingLocation, setRequestingLocation] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);

  const handleRequestLocation = async () => {
    if (!requestLocationName.trim() || !auth.currentUser) return;
    setRequestingLocation(true);
    try {
      await addDoc(collection(db, 'location_requests'), {
        name: requestLocationName.trim(),
        requestedBy: auth.currentUser.uid,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      
      // Also notify all admins
      const adminsSnapshot = await getDocs(query(collection(db, 'users'), where('isAdmin', '==', true)));
      for (const adminDoc of adminsSnapshot.docs) {
        await sendNotification(adminDoc.id, {
          type: 'location_request',
          text: `New location request: ${requestLocationName.trim()}`,
          senderId: auth.currentUser?.uid,
          senderName: auth.currentUser?.displayName || 'User',
        });
      }

      setRequestSuccess(true);
      setTimeout(() => {
        setShowRequestModal(false);
        setRequestSuccess(false);
        setRequestLocationName('');
      }, 3000);
    } catch (error) {
       handleFirestoreError(error, OperationType.CREATE, 'location_requests');
    } finally {
      setRequestingLocation(false);
    }
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }, (err) => {
        console.error("Geolocation error:", err);
      });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !hometown || !currentLocation || !name.trim()) return;

    setLoading(true);
    try {
      const currentLocationData = locations.find(l => l.name === currentLocation);
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const privateInfoRef = doc(db, 'private_user_info', auth.currentUser.uid);
      
      const batch = writeBatch(db);
      
      batch.set(userRef, {
        uid: auth.currentUser.uid,
        name: name.trim(),
        photoURL: auth.currentUser.photoURL,
        hometown,
        currentLocation,
        hometownId: hometown.toLowerCase().replace(/\s+/g, '-'),
        language,
        coords: currentLocationData ? { lat: currentLocationData.lat, lng: currentLocationData.lng } : (coords || null),
        gender,
        birthDate,
        isAdmin: auth.currentUser.email === 'mahdihijazy4@gmail.com',
        createdAt: serverTimestamp(),
      });

      batch.set(privateInfoRef, {
        name: name.trim(),
        email: auth.currentUser.email,
        phoneNumber: phoneNumber.trim(),
        createdAt: serverTimestamp(),
      });

      await batch.commit();
    } catch (error) {
      console.error("Setup error:", error);
      handleFirestoreError(error, OperationType.WRITE, `users/${auth.currentUser.uid}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--theme-bg-body)] text-theme-white p-8 flex flex-col justify-center">
      <motion.div
        initial={{ opacity: 0, x: language === 'ar' ? 20 : -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="max-w-md mx-auto w-full space-y-8"
      >
        <div className="space-y-2">
          <h2 className="text-4xl font-bold tracking-tight text-start">{t.setupTitle}</h2>
          <p className="text-zinc-500 text-start">{t.setupDesc}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                 <User size={14} /> {t.displayName}
              </label>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full bg-zinc-900 border-none rounded-xl p-4 focus:ring-2 focus:ring-theme-white transition-all outline-none text-lg text-start"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                 <Home size={14} /> {t.hometown}
              </label>
              <SearchableSelect
                required
                value={hometown}
                onChange={(val) => setHometown(val)}
                options={locations.map(loc => ({ id: loc.id || loc.name, name: loc.name }))}
                placeholder={t.selectLocation}
                className="bg-zinc-900 border-none rounded-xl p-4 focus:ring-2 focus:ring-theme-white transition-all outline-none text-lg text-start"
              />
              <button 
                type="button" 
                onClick={() => setShowRequestModal(true)}
                className="text-[10px] uppercase font-black tracking-widest text-zinc-500 hover:text-theme-white transition-colors flex items-center gap-1 mt-1"
              >
                <Plus size={12} /> {t.villageNotFound}
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                <MapPin size={14} /> {t.displacement}
              </label>
              <SearchableSelect
                required
                value={currentLocation}
                onChange={(val) => setCurrentLocation(val)}
                options={locations.map(loc => ({ id: loc.id || loc.name, name: loc.name }))}
                placeholder={t.selectLocation}
                className="bg-zinc-900 border-none rounded-xl p-4 focus:ring-2 focus:ring-theme-white transition-all outline-none text-lg text-start"
              />
              <button 
                type="button" 
                onClick={() => setShowRequestModal(true)}
                className="text-[10px] uppercase font-black tracking-widest text-zinc-500 hover:text-theme-white transition-colors flex items-center gap-1 mt-1"
              >
                <Plus size={12} /> {t.villageNotFound}
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                <Phone size={14} /> {t.phoneNumber}
              </label>
              <input
                required
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+961 70 123 456"
                className="w-full bg-zinc-900 border-none rounded-xl p-4 focus:ring-2 focus:ring-theme-white transition-all outline-none text-lg text-start"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                   <User size={14} /> {t.gender}
                </label>
                <select
                  required
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  className="w-full bg-zinc-900 border-none rounded-xl p-4 focus:ring-2 focus:ring-theme-white transition-all outline-none text-lg text-start"
                >
                  <option value="male" className="bg-zinc-900">{t.male}</option>
                  <option value="female" className="bg-zinc-900">{t.female}</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                  <Calendar size={14} /> {t.birthDate}
                </label>
                <input
                  required
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full bg-zinc-900 border-none rounded-xl p-4 focus:ring-2 focus:ring-theme-white transition-all outline-none text-lg text-start"
                />
              </div>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={loading}
            className="w-full bg-theme-white text-theme-black py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? t.saving : t.startConnecting}
            <ArrowRight size={20} className={language === 'ar' ? 'rotate-180' : ''} />
          </motion.button>
        </form>
      </motion.div>

      {/* Location Request Modal */}
      <AnimatePresence>
        {showRequestModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-theme-black/80 backdrop-blur-sm" onClick={() => setShowRequestModal(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-zinc-900 border border-theme-white/10 rounded-[32px] p-6 max-w-sm w-full shadow-2xl space-y-4 relative"
            >
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-black uppercase tracking-widest text-lg">
                  {t.requestLocation}
                </h4>
                <button onClick={() => setShowRequestModal(false)} className="p-2 glass rounded-full hover:bg-theme-white/10">
                  <X size={16} />
                </button>
              </div>
              
              {requestSuccess ? (
                <div className="text-center py-6 text-green-500 font-bold">
                  {t.requestSent}
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-zinc-500 block">
                      {t.villageCityName}
                    </label>
                    <input 
                      type="text"
                      value={requestLocationName}
                      onChange={(e) => setRequestLocationName(e.target.value)}
                      placeholder={t.fullName}
                      className="w-full bg-[var(--theme-bg-body)] border border-theme-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                      autoFocus
                    />
                  </div>
                  <button 
                    onClick={handleRequestLocation}
                    disabled={requestingLocation || !requestLocationName.trim()}
                    className="w-full bg-amber-500 text-theme-black py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-amber-400 disabled:opacity-50 transition-colors mt-2"
                  >
                    {requestingLocation ? t.sending : t.send}
                  </button>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
