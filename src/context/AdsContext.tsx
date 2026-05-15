import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { AdSettings } from '../types';

interface AdsContextType {
  settings: AdSettings | null;
}

const AdsContext = createContext<AdsContextType>({
  settings: null,
});

export const useAds = () => useContext(AdsContext);

export function AdsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AdSettings | null>(null);

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, "system", "adSettings"), (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data() as AdSettings);
      } else {
        setSettings({
          adMode: 'google',
          feedFrequency: 5,
          searchFrequency: 3,
          googleAdClient: '',
          googleFeedAdSlot: '',
          googleSearchAdSlot: '',
        });
      }
    });

    return () => unsubSettings();
  }, []);

  return (
    <AdsContext.Provider value={{ settings }}>
      {children}
    </AdsContext.Provider>
  );
}
