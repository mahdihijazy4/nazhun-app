import { motion } from 'motion/react';
import { signInWithGoogle } from '../lib/firebase';
import { LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Auth() {
  const { t } = useAuth();
  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error("Google sign-in error:", error);
      alert(t.signInFailed);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--theme-bg-body)] text-theme-white p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4 mb-12"
      >
        <img src="/logo.png" alt={t.appName} className="w-48 h-48 mx-auto -mb-4 object-contain filter drop-shadow-2xl" onError={(e) => (e.currentTarget.style.display = 'none')} />
        <h1 className="text-6xl font-black tracking-tighter italic">{t.appName}</h1>
        <p className="text-zinc-500 max-w-xs mx-auto">
          {t.tagline}
        </p>
      </motion.div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleSignIn}
        className="flex items-center gap-3 bg-theme-white text-theme-black px-8 py-4 rounded-full font-bold text-lg shadow-xl"
      >
        <LogIn size={20} />
        {t.continueGoogle}
      </motion.button>

      <div className="mt-12 grid grid-cols-2 gap-4 text-center">
        <div className="p-4 border border-zinc-800 rounded-2xl">
          <div className="text-2xl font-bold">24h</div>
          <div className="text-xs text-zinc-500 uppercase tracking-widest">{t.ephemeral}</div>
        </div>
        <div className="p-4 border border-zinc-800 rounded-2xl">
          <div className="text-2xl font-bold">{t.villageFirst}</div>
          <div className="text-xs text-zinc-500 uppercase tracking-widest">{t.villageFirst}</div>
        </div>
      </div>
    </div>
  );
}
