import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { AdSettings } from "../types";
import {
  Settings,
  Save,
} from "lucide-react";

export function AdminAds() {
  const { t, language } = useAuth();
  const [settings, setSettings] = useState<AdSettings>({
    adMode: "google",
    feedFrequency: 5,
    searchFrequency: 3,
    googleAdClient: "",
    googleFeedAdSlot: "",
    googleSearchAdSlot: "",
  });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    // Fetch Settings
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "system", "adSettings");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(docSnap.data() as AdSettings);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, "system/adSettings");
      }
    };
    fetchSettings();
  }, []);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await setDoc(doc(db, "system", "adSettings"), settings);
      alert("Settings saved!");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "system/adSettings");
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Settings Panel */}
      <div className="bg-zinc-900/50 p-6 rounded-[32px] border border-theme-white/10 space-y-6">
        <div className="flex items-center gap-3">
          <div className="bg-theme-white/10 p-3 rounded-2xl">
            <Settings size={20} className="text-theme-white" />
          </div>
          <h2 className="text-xl font-black uppercase tracking-widest text-theme-white">Ad Settings</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-zinc-500">Ad Mode</label>
            <select
              value={settings.adMode}
              onChange={(e) => setSettings({ ...settings, adMode: e.target.value as any })}
              className="w-full bg-zinc-900 border border-theme-white/10 text-theme-white p-4 rounded-2xl outline-none"
            >
              <option value="off">Off (No Ads)</option>
              <option value="google">Google Ads</option>
            </select>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-zinc-500">Feed Ad Frequency (every N posts)</label>
              <input
                type="number"
                value={settings.feedFrequency}
                onChange={(e) => setSettings({ ...settings, feedFrequency: parseInt(e.target.value) || 5 })}
                className="w-full bg-zinc-900 border border-theme-white/10 text-theme-white p-4 rounded-2xl outline-none"
              />
            </div>
          </div>
        </div>

        {(settings.adMode === 'google') && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-theme-white/5">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-zinc-500">Google Ad Client</label>
              <input
                placeholder="ca-pub-1234567890"
                value={settings.googleAdClient}
                onChange={(e) => setSettings({ ...settings, googleAdClient: e.target.value })}
                className="w-full bg-zinc-900 border border-theme-white/10 text-theme-white p-4 rounded-2xl outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-zinc-500">Feed Ad Slot</label>
              <input
                placeholder="1234567890"
                value={settings.googleFeedAdSlot}
                onChange={(e) => setSettings({ ...settings, googleFeedAdSlot: e.target.value })}
                className="w-full bg-zinc-900 border border-theme-white/10 text-theme-white p-4 rounded-2xl outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-zinc-500">Search Ad Slot</label>
              <input
                placeholder="0987654321"
                value={settings.googleSearchAdSlot}
                onChange={(e) => setSettings({ ...settings, googleSearchAdSlot: e.target.value })}
                className="w-full bg-zinc-900 border border-theme-white/10 text-theme-white p-4 rounded-2xl outline-none"
              />
            </div>
          </div>
        )}

        <button
          onClick={handleSaveSettings}
          disabled={savingSettings}
          className="w-full p-4 rounded-2xl bg-village-green text-theme-black font-black uppercase tracking-widest flex justify-center items-center gap-2 glow-green disabled:opacity-50"
        >
          <Save size={20} />
          {savingSettings ? "Saving..." : "Save Settings"}
        </button>
      </div>

    </div>
  );
}
