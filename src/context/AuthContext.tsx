import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, collection, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, Notification as NotificationType } from '../types';
import { Language, translations } from '../translations';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isNewUser: boolean;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations.ar;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isNewUser: false,
  language: 'ar',
  setLanguage: () => {},
  t: translations.ar,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);
  const [language, setLanguageState] = useState<Language>('ar');

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    if (user) {
      await updateDoc(doc(db, 'users', user.uid), { language: lang });
    }
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        // Verify and sync admin status
        const isDesignatedAdmin = user.email === 'mahdihijazy4@gmail.com';
        if (isDesignatedAdmin && !data.isAdmin) {
          data.isAdmin = true;
          updateDoc(doc(db, 'users', user.uid), { isAdmin: true })
            .catch(e => console.error("Failed to sync admin status:", e));
        }
        setProfile(data);
        if (data.language) setLanguageState(data.language);
        
        // Ban check
        if (data.isBanned) {
          auth.signOut();
          alert(translations[data.language || 'en'].bannedMessage);
        }

        setIsNewUser(false);
      } else {
        setProfile(null);
        setIsNewUser(true);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      setLoading(false);
    });

    return () => unsubscribeProfile();
  }, [user]);

  useEffect(() => {
    if (!user || isNewUser) return;
    
    let debounceTimer: NodeJS.Timeout;
    const updatePresence = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (document.visibilityState === 'visible') {
          updateDoc(doc(db, 'users', user.uid), { lastActive: serverTimestamp() }).catch(() => {});
        }
      }, 1000);
    };
    
    updatePresence();
    const intervalId = setInterval(updatePresence, 3 * 60 * 1000); // 3 minutes
    window.addEventListener('visibilitychange', updatePresence);
    window.addEventListener('focus', updatePresence);
    
    return () => {
      clearInterval(intervalId);
      clearTimeout(debounceTimer);
      window.removeEventListener('visibilitychange', updatePresence);
      window.removeEventListener('focus', updatePresence);
    };
  }, [user, isNewUser]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    let isInitial = true;

    const q = query(
      collection(db, 'users', user.uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubNotifs = onSnapshot(q, (snapshot) => {
      if (isInitial) {
        isInitial = false;
        return;
      }
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const n = change.doc.data() as NotificationType;
          if ('Notification' in window && Notification.permission === 'granted') {
             let title = translations[language].appName;
             let body = '';
             if (n.type === 'like') body = `${n.senderName} ${translations[language].likedYourPost}`;
             if (n.type === 'comment') body = `${n.senderName} ${translations[language].commentedYourPost}`;
             if (n.type === 'message') body = `${n.senderName} ${translations[language].sentYouMessage}`;
             if (n.type === 'follow') body = `${n.senderName} ${translations[language].startedFollowingYou}`;
             if (n.type === 'system') body = n.text || translations[language].systemUpdated;
             
             if (body) {
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistration().then(reg => {
                    if (reg) {
                      reg.showNotification(title, { body, icon: '/logo.svg' });
                    } else {
                      new Notification(title, { body, icon: '/logo.svg' });
                    }
                  });
                } else {
                  new Notification(title, { body, icon: '/logo.svg' });
                }
             }
          }
        }
      });
    });

    return () => unsubNotifs();
  }, [user, language]);

  const t = translations[language];

  return (
    <AuthContext.Provider value={{ user, profile, loading, isNewUser, language, setLanguage, t }}>
      <div dir={language === 'ar' ? 'rtl' : 'ltr'}>
        {children}
      </div>
    </AuthContext.Provider>
  );
};
