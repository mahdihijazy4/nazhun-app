import React, { useState, useRef } from "react";
import {
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "motion/react";
import { cn, compressImageToDataUrl, compressImageToFile } from "../lib/utils";
import {
  X,
  Image as ImageIcon,
  Send,
  Link as LinkIcon,
  Film,
  Loader2,
} from "lucide-react";

interface CreatePostProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function CreatePost({ onClose, onSuccess }: CreatePostProps) {
  const { profile, t, language } = useAuth();
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setLoading(true);
    setError(null);
    setUploadProgress(0);

    let base64Str = "";

    if (file.type.startsWith("video/")) {
      setError(
        "Local video upload is disabled in preview environments. Please use a link instead.",
      );
      setLoading(false);
      return;
    }

    if (file.type.startsWith("image/")) {
      try {
        const compressedFile = await compressImageToFile(file, 0.3, 1200); // compress to ~300KB

        const formData = new FormData();
        formData.append("file", compressedFile);

        // Simulating progress
        const interval = setInterval(() => {
          setUploadProgress((p) => (p < 90 ? p + 10 : p));
        }, 100);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        clearInterval(interval);
        setUploadProgress(100);

        if (!response.ok) {
          throw new Error("Upload failed");
        }

        const data = await response.json();
        setMediaUrl(data.url); // Use CDN URL
        setMediaType("image");
        setLoading(false);
      } catch (error: any) {
        console.error("Compression/Upload failed", error);
        setError("Image upload failed");
        setLoading(false);
        return;
      }
    } else {
      // General file fallback (though only images/videos expected)
      try {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        if (!response.ok) throw new Error("Upload failed");
        const data = await response.json();
        setMediaUrl(data.url);
        setMediaType("image");
        setLoading(false);
      } catch (err: any) {
        console.error("Upload failed", err);
        setError(err.message || "Upload failed. Please try again.");
        setLoading(false);
      }
    }
  };

  const handleCreate = async () => {
    if (!profile || (!content.trim() && !mediaUrl)) return;
    setLoading(true);

    try {
      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);

      await addDoc(collection(db, "posts"), {
        authorId: profile.uid,
        authorName: profile.name,
        authorPhotoURL: profile.photoURL || null,
        authorHometown: profile.hometown,
        authorCurrentLocation: profile.currentLocation,
        authorHometownId: profile.hometownId,
        content: content,
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
        coords: profile.coords || null,
        likesCount: 0,
        commentsCount: 0,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.CREATE, "posts");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-theme-black/90 backdrop-blur-md z-[100] flex flex-col justify-end sm:justify-center items-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
        className="w-full max-w-2xl bg-[var(--theme-bg-body)] sm:rounded-3xl rounded-t-[32px] flex flex-col h-[92vh] sm:h-[80vh] border border-theme-white/10 shadow-2xl overflow-hidden relative"
      >
        <div className="flex justify-between items-center p-4 sm:p-6 bg-[var(--theme-bg-body)]/80 backdrop-blur-md z-10 sticky top-0 border-b border-theme-white/5">
          <button
            onClick={onClose}
            className="p-3 bg-theme-white/5 rounded-full hover:bg-theme-white/10 transition-colors text-zinc-400 hover:text-theme-white"
          >
            <X size={20} />
          </button>
          <div className="text-xs font-black tracking-widest uppercase text-theme-white/50">
            {t.createPost}
          </div>
          <button
            onClick={handleCreate}
            disabled={(!content.trim() && !mediaUrl) || loading}
            className="bg-theme-white text-theme-black px-6 py-2.5 rounded-full font-black uppercase tracking-widest text-xs sm:text-sm disabled:opacity-30 disabled:bg-theme-white/20 disabled:text-theme-white transition-all hover:bg-zinc-200 hover:scale-105 active:scale-95 flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? "..." : t.post}
          </button>
        </div>

        <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto scrollbar-hide">
          <div className="flex gap-4">
            {profile?.photoURL ? (
              <img
                src={profile.photoURL}
                alt="Profile"
                className="w-12 h-12 rounded-full object-cover shrink-0 ring-2 ring-theme-white/10"
              />
            ) : (
              <div className="w-12 h-12 bg-theme-white/5 rounded-full flex items-center justify-center shrink-0 ring-2 ring-theme-white/10">
                <ImageIcon className="text-theme-white/40" size={20} />
              </div>
            )}
            <div className="flex-1 mt-2">
              <textarea
                autoFocus
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t.shareSomething}
                className="w-full bg-transparent border-none text-2xl sm:text-3xl font-medium tracking-tight text-theme-white focus:ring-0 resize-none outline-none text-start min-h-[160px] placeholder:text-theme-white/20"
              />
            </div>
          </div>

          {loading && uploadProgress > 0 && uploadProgress < 100 && (
            <div className="w-full h-1 bg-theme-white/10 rounded-full overflow-hidden mt-4">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
                className="h-full bg-theme-white shadow-[0_0_10px_rgba(255,255,255,0.5)]"
              />
            </div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs uppercase font-bold tracking-widest p-4 rounded-2xl flex items-center gap-3 mt-4"
            >
              <span className="shrink-0 text-lg">⚠️</span>
              <p>{error}</p>
            </motion.div>
          )}

          <AnimatePresence>
            {mediaUrl && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative rounded-3xl overflow-hidden bg-[var(--theme-bg-body)] border border-theme-white/10 w-full mt-6 group shadow-2xl"
              >
                {mediaType === "video" ? (
                  <video
                    src={mediaUrl}
                    className="w-full max-h-[500px] object-contain bg-theme-black/50"
                    controls
                  />
                ) : (
                  <img
                    src={mediaUrl}
                    alt="Preview"
                    className="w-full max-h-[500px] object-cover"
                  />
                )}
                <button
                  onClick={() => {
                    setMediaUrl("");
                    setMediaType(null);
                  }}
                  className="absolute top-4 right-4 p-3 bg-theme-black/50 backdrop-blur-md border border-theme-white/20 rounded-full text-theme-white hover:bg-theme-black/70 hover:scale-110 active:scale-95 transition-all opacity-0 group-hover:opacity-100"
                >
                  <X size={18} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-4 sm:p-6 bg-[var(--theme-bg-body)]/80 backdrop-blur-md flex items-center justify-between z-10 sticky bottom-0 border-t border-theme-white/5">
          <div className="flex gap-3">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*,video/*"
              onChange={handleFileChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "px-4 py-3 sm:px-5 sm:py-3.5 rounded-full flex items-center gap-2 transition-all font-bold text-xs shadow-lg",
                mediaUrl && fileInputRef.current?.value
                  ? "bg-theme-white text-theme-black shadow-theme-white/20"
                  : "bg-theme-white/10 text-theme-white hover:bg-theme-white/20 border border-theme-white/5",
              )}
            >
              <ImageIcon size={18} />
              <span className="hidden sm:inline">{t.mediaFile}</span>
            </button>
          </div>
          <div className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-theme-white/40 flex items-center gap-2 bg-theme-white/5 px-4 py-2.5 rounded-full border border-theme-white/5">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-theme-white animate-pulse shadow-[0_0_10px_rgba(255,255,255,1)]" />
            <span className="opacity-80">{t.ephemeral}</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
