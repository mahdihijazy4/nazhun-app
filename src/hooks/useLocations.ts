import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { LocationData, LEBANESE_LOCATIONS } from '../locations';

// In-memory cache to avoid flashing empty lists
let cachedLocations: LocationData[] | null = null;

export function useLocations() {
  const [locations, setLocations] = useState<LocationData[]>(cachedLocations || LEBANESE_LOCATIONS);
  const [loading, setLoading] = useState(!cachedLocations);

  useEffect(() => {
    const q = query(collection(db, 'locations'), orderBy('name'));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({
        name: d.data().name,
        lat: d.data().lat,
        lng: d.data().lng
      } as LocationData));
      
      // If the list is empty, perhaps we haven't bootstrapped it yet. We can fallback to LEBANESE_LOCATIONS or just show empty.
      // Let's fallback to LEBANESE_LOCATIONS if empty, so the app doesn't break initially.
      const finalLocations = docs.length > 0 ? docs : LEBANESE_LOCATIONS;
      
      cachedLocations = finalLocations;
      setLocations(finalLocations);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'locations');
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return { locations, loading };
}
