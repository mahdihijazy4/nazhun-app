import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { motion } from "motion/react";
import {
  Settings as SettingsIcon,
  Bell,
  ChevronLeft,
  Save,
  LogOut,
  Globe,
  Moon,
  Sun,
  Monitor,
} from "lucide-react";
import { NotificationPreferences } from "../types";

interface SettingsProps {
  onBack: () => void;
}

export function Settings({ onBack }: SettingsProps) {
  const { user, profile, t, logout, setLanguage } = useAuth();
  const [saving, setSaving] = useState(false);
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">(
    profile?.themeMode || "light",
  );

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
    applyTheme(themeMode);
  }, [themeMode]);

  const [prefs, setPrefs] = useState<NotificationPreferences>(
    profile?.notificationPreferences || {
      likes: true,
      comments: true,
      messages: true,
      follows: true,
      system: true,
    },
  );

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        notificationPreferences: prefs,
        themeMode,
      });
      onBack();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--theme-bg-body)] text-theme-white">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-theme-white/10">
        <button
          onClick={onBack}
          className="p-2 hover:bg-theme-white/10 rounded-full transition-colors"
        >
          <ChevronLeft
            size={24}
            className={t.language === "ar" ? "rotate-180" : ""}
          />
        </button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <SettingsIcon size={20} />
          {t.settings}
        </h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="p-2 bg-theme-white text-theme-black rounded-full hover:bg-theme-white/90 transition-colors disabled:opacity-50"
        >
          {saving ? (
            <Save size={20} className="animate-spin" />
          ) : (
            <Save size={20} />
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-8">
        {/* Theme Section */}
        <section className="space-y-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
            <Moon size={14} />
            Appearance
          </h2>
          <div className="flex gap-2">
            {(["light", "dark", "system"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setThemeMode(mode)}
                className={`flex-1 py-3 rounded-2xl font-bold transition-all capitalize flex flex-col items-center gap-2 ${
                  themeMode === mode
                    ? "bg-theme-white text-theme-black shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                    : "bg-zinc-900 text-zinc-400 border border-theme-white/5"
                }`}
              >
                {mode === "system" && <Monitor size={20} />}
                {mode === "light" && <Sun size={20} />}
                {mode === "dark" && <Moon size={20} />}
                {mode === "system"
                  ? "System"
                  : mode === "light"
                    ? "Light"
                    : "Dark"}
              </button>
            ))}
          </div>
        </section>

        {/* Language Section */}
        <section className="space-y-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
            <Globe size={14} />
            {t.language}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setLanguage("ar")}
              className={`flex-1 py-3 rounded-2xl font-bold transition-all ${
                t.language === "ar"
                  ? "bg-theme-white text-theme-black shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                  : "bg-zinc-900 text-zinc-400 border border-theme-white/5"
              }`}
            >
              {t.arabic}
            </button>
            <button
              onClick={() => setLanguage("en")}
              className={`flex-1 py-3 rounded-2xl font-bold transition-all ${
                t.language === "en"
                  ? "bg-theme-white text-theme-black shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                  : "bg-zinc-900 text-zinc-400 border border-theme-white/5"
              }`}
            >
              {t.english}
            </button>
          </div>
        </section>

        {/* Notifications Section */}
        <section className="space-y-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
            <Bell size={14} />
            {t.notificationSettings}
          </h2>
          <div className="space-y-2">
            {[
              { key: "likes", label: t.likesNotif },
              { key: "comments", label: t.commentsNotif },
              { key: "messages", label: t.messagesNotif },
              { key: "follows", label: t.followsNotif },
              { key: "system", label: t.systemNotif },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() =>
                  handleToggle(item.key as keyof NotificationPreferences)
                }
                className="w-full p-4 rounded-3xl bg-zinc-900 border border-theme-white/5 flex items-center justify-between group hover:border-theme-white/20 transition-all"
              >
                <span className="font-bold">{item.label}</span>
                <div
                  className={`w-12 h-6 rounded-full relative transition-colors ${prefs[item.key as keyof NotificationPreferences] ? "bg-theme-white" : "bg-zinc-800"}`}
                >
                  <motion.div
                    animate={{
                      x: prefs[item.key as keyof NotificationPreferences]
                        ? 24
                        : 4,
                    }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className={`absolute top-1 w-4 h-4 rounded-full ${prefs[item.key as keyof NotificationPreferences] ? "bg-[var(--theme-bg-body)]" : "bg-zinc-500"}`}
                  />
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Logout Section */}
        <button
          onClick={logout}
          className="w-full p-4 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-500 font-bold flex items-center justify-center gap-2 hover:bg-red-500/20 transition-all mt-8"
        >
          <LogOut size={20} />
          {t.logout}
        </button>
      </div>
    </div>
  );
}
