import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { db, handleFirestoreError, OperationType } from "./lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDocFromServer,
} from "firebase/firestore";
import { Feed } from "./components/Feed";
import { Discovery } from "./components/Discovery";
import { Setup } from "./components/Setup";
import { Auth } from "./components/Auth";
import { Profile } from "./components/Profile";
import { Messages } from "./components/Messages";
import { Admin } from "./components/Admin";
import { Navigation } from "./components/Navigation";
import { Notifications } from "./components/Notifications";
import { CreatePost } from "./components/CreatePost";
import { Settings } from "./components/Settings";
import { PWAPrompt } from "./components/PWAPrompt";
import { PopupBroadcasts } from "./components/PopupBroadcasts";
import { AdsProvider } from "./context/AdsContext";
import { AnimatePresence, motion } from "motion/react";
import { MapPin, MessageCircle, User, Home, PlusSquare } from "lucide-react";

function AppContent() {
  const { user, profile, loading, isNewUser, t } = useAuth();

  useEffect(() => {
    const applyTheme = (mode: string) => {
      if (mode === "light") {
        document.documentElement.setAttribute("data-theme", "light");
      } else if (mode === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
      } else {
        if (
          window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: light)").matches
        ) {
          document.documentElement.setAttribute("data-theme", "light");
        } else {
          document.documentElement.setAttribute("data-theme", "dark");
        }
      }
    };
    applyTheme(profile?.themeMode || "light");
  }, [profile?.themeMode]);
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, "system", "ping"));
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("the client is offline")
        ) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);
  const [activeTab, setActiveTab] = useState<
    | "feed"
    | "notifications"
    | "messages"
    | "profile"
    | "create"
    | "admin"
    | "discovery"
    | "settings"
  >("feed");
  const [viewedUserId, setViewedUserId] = useState<string | null>(null);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [lastTab, setLastTab] = useState<
    | "feed"
    | "notifications"
    | "messages"
    | "profile"
    | "discovery"
    | "admin"
    | "settings"
  >("feed");

  const handleTabChange = (tab: any) => {
    if (tab === "create") {
      setShowCreate(true);
    } else {
      setLastTab(tab);
      setActiveTab(tab);
    }
  };

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "notifications"),
      where("read", "==", false),
    );
    const unsub = onSnapshot(
      q,
      (s) => {
        let msgCount = 0;
        let notifCount = 0;
        s.forEach((doc) => {
          const type = doc.data().type;
          if (type === "message") {
            msgCount++;
          } else if (type !== "popup") {
            notifCount++;
          }
        });
        setUnreadMessages(msgCount);
        setUnreadNotifs(notifCount);
      },
      (err) => {
        handleFirestoreError(
          err,
          OperationType.LIST,
          `users/${user.uid}/notifications`,
        );
      },
    );
    return () => unsub();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--theme-bg-body)]">
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-2xl font-bold tracking-tighter flex flex-col items-center gap-4 text-current"
        >
          <img
            src="/logo.png"
            alt={t.appName}
            className="w-24 h-24 object-contain"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
          {t.appName}
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  if (isNewUser) {
    return <Setup />;
  }

  const navigateToProfile = (userId: string) => {
    setViewedUserId(userId);
    setActiveTab("profile");
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[var(--theme-bg-body)] overflow-hidden font-sans">
      <main className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === "feed" && (
            <motion.div
              key="feed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              <Feed
                onUserClick={navigateToProfile}
                onCreatePost={() => setShowCreate(true)}
              />
            </motion.div>
          )}
          {activeTab === "notifications" && (
            <motion.div
              key="notifications"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="h-full overflow-y-auto"
            >
              <Notifications
                onNavigate={(tab, id) => {
                  if (id) setViewedUserId(id);
                  setActiveTab(tab as any);
                }}
              />
            </motion.div>
          )}
          {activeTab === "messages" && (
            <motion.div
              key="messages"
              initial={{ x: t.language === "ar" ? -300 : 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: t.language === "ar" ? 300 : -300, opacity: 0 }}
              className="h-full"
            >
              <Messages />
            </motion.div>
          )}
          {activeTab === "profile" && (
            <motion.div
              key="profile"
              initial={{ y: 300, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 300, opacity: 0 }}
              className="h-full overflow-y-auto"
            >
              <Profile
                userId={viewedUserId || user.uid}
                onBack={() => {
                  if (viewedUserId) {
                    setViewedUserId(null);
                    setActiveTab("feed");
                  }
                }}
                onNavigate={(tab) => {
                  setViewedUserId(null);
                  setActiveTab(tab as any);
                }}
              />
            </motion.div>
          )}
          {activeTab === "settings" && (
            <motion.div
              key="settings"
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              className="h-full"
            >
              <Settings onBack={() => setActiveTab("profile")} />
            </motion.div>
          )}
          {activeTab === "admin" && (
            <motion.div
              key="admin"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="h-full overflow-y-auto"
            >
              <Admin />
            </motion.div>
          )}
          {activeTab === "discovery" && (
            <motion.div
              key="discovery"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full"
            >
              <Discovery
                onUserClick={(id) => {
                  setViewedUserId(id);
                  setActiveTab("profile");
                }}
                onNavigate={(tab, id) => {
                  if (id) setViewedUserId(id);
                  setActiveTab(tab as any);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {showCreate && (
          <CreatePost
            onClose={() => setShowCreate(false)}
            onSuccess={() => {
              localStorage.removeItem("feedPostsCache");
              localStorage.removeItem("feedPostsCacheTime");
              setShowCreate(false);
              setActiveTab("feed");
            }}
          />
        )}
      </AnimatePresence>

      <PWAPrompt />
      <PopupBroadcasts />
      <Navigation
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        unreadNotifs={unreadNotifs}
        unreadMessages={unreadMessages}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AdsProvider>
        <AppContent />
      </AdsProvider>
    </AuthProvider>
  );
}
