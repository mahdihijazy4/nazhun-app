import React, { useState, useEffect, useRef } from "react";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
  addDoc,
  arrayUnion,
  arrayRemove,
  writeBatch,
} from "firebase/firestore";
import { db, auth, handleFirestoreError, OperationType } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { UserProfile, Post as PostType } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import {
  MapPin,
  Home,
  ArrowLeft,
  MessageSquare,
  LogOut,
  Grid,
  Bookmark,
  Languages,
  Edit2,
  Check,
  X,
  User,
  Calendar,
  Info,
  Loader2,
  Ban,
  Plus,
  Phone,
  Settings as SettingsIcon,
  ShieldAlert,
} from "lucide-react";
import { logout } from "../lib/firebase";
import { useLocations } from "../hooks/useLocations";
import { updateDoc } from "firebase/firestore";

import { PostCard } from "./PostCard";
import { compressImageToDataUrl } from "../lib/utils";
import { sendNotification } from "../services/notificationService";
import { SearchableSelect } from "./SearchableSelect";

interface ProfileProps {
  userId: string;
  onBack?: () => void;
  onNavigate?: (
    tab:
      | "feed"
      | "notifications"
      | "messages"
      | "profile"
      | "create"
      | "discovery"
      | "settings",
  ) => void;
}

export function Profile({ userId, onBack, onNavigate }: ProfileProps) {
  const {
    user,
    profile: currentUserProfile,
    t,
    language,
    setLanguage,
  } = useAuth();
  const { locations } = useLocations();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<PostType[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<UserProfile>>({});
  const [saving, setSaving] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<PostType | null>(null);
  const profileFileInputRef = useRef<HTMLInputElement>(null);
  const [phoneNumber, setPhoneNumber] = useState("");

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestLocationName, setRequestLocationName] = useState("");
  const [requestingLocation, setRequestingLocation] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);

  const handleRequestLocation = async () => {
    if (!requestLocationName.trim() || !user) return;
    setRequestingLocation(true);
    try {
      await addDoc(collection(db, "location_requests"), {
        name: requestLocationName.trim(),
        requestedBy: user.uid,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      // Also notify all admins
      const adminsSnapshot = await getDocs(
        query(collection(db, "users"), where("isAdmin", "==", true)),
      );
      for (const adminDoc of adminsSnapshot.docs) {
        await sendNotification(adminDoc.id, {
          type: "location_request",
          text: `New location request: ${requestLocationName.trim()}`,
          senderId: user?.uid,
          senderName: currentUserProfile?.name || "User",
        });
      }

      setRequestSuccess(true);
      setTimeout(() => {
        setShowRequestModal(false);
        setRequestSuccess(false);
        setRequestLocationName("");
      }, 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "location_requests");
    } finally {
      setRequestingLocation(false);
    }
  };

  const handleProfilePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setSaving(true);
    setError(null);
    setUploadProgress(0);

    let base64Str = "";
    if (file.type.startsWith("image/")) {
      try {
        base64Str = await compressImageToDataUrl(file, 0.1, 500);
      } catch (error) {
        console.warn("Compression failed", error);
        setError("Image compression failed");
        setSaving(false);
        return;
      }
    }

    try {
      if (!base64Str) {
        base64Str = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (error) => reject(error);
        });
      }

      setEditData((prev) => ({ ...prev, photoURL: base64Str }));
      setSaving(false);
      setUploadProgress(0);
    } catch (err: any) {
      console.error("Upload failed", err);
      setError(err.message || "Upload failed");
      setSaving(false);
    }
  };

  const isOwnProfile = user?.uid === userId;
  const isBlocked = currentUserProfile?.blockedUsers?.includes(userId);

  useEffect(() => {
    setLoading(true);
    const unsubProfile = onSnapshot(
      doc(db, "users", userId),
      (docSnap) => {
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        }
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `users/${userId}`);
        setLoading(false);
      },
    );

    if (user && isOwnProfile) {
      getDoc(doc(db, "private_user_info", user.uid))
        .then((docSnap) => {
          if (docSnap.exists() && docSnap.data().phoneNumber) {
            setPhoneNumber(docSnap.data().phoneNumber);
          }
        })
        .catch((err) => {
          console.error(err);
        });
    }

    const followersQ = query(
      collection(db, "users", userId, "followers"),
      where("sourceUserId", ">=", ""),
    );
    const followingQ = query(
      collection(db, "users", userId, "follows"),
      where("followedId", ">=", ""),
    );

    const unsubFollowers = onSnapshot(
      followersQ,
      (s) => setFollowersCount(s.size),
      (err) =>
        handleFirestoreError(
          err,
          OperationType.LIST,
          `users/${userId}/followers`,
        ),
    );
    const unsubFollowing = onSnapshot(
      followingQ,
      (s) => setFollowingCount(s.size),
      (err) =>
        handleFirestoreError(
          err,
          OperationType.LIST,
          `users/${userId}/follows`,
        ),
    );

    let unsubIsFollowing = () => {};
    if (user && !isOwnProfile) {
      unsubIsFollowing = onSnapshot(
        doc(db, "users", user.uid, "follows", userId),
        (d) => setIsFollowing(d.exists()),
        (err) =>
          handleFirestoreError(
            err,
            OperationType.GET,
            `users/${user.uid}/follows/${userId}`,
          ),
      );
    }

    const loadProfilePosts = async () => {
      try {
        const q = query(
          collection(db, "posts"),
          where("authorId", "==", userId),
          orderBy("expiresAt", "desc"),
        );
        const snapshot = await getDocs(q);
        setPosts(
          snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as PostType[],
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, "posts");
      }
    };
    loadProfilePosts();

    return () => {
      unsubProfile();
      unsubFollowers();
      unsubFollowing();
      unsubIsFollowing();
    };
  }, [userId, user, isOwnProfile]);

  const handleFollow = async () => {
    if (!user || isOwnProfile) return;
    try {
      const followRef = doc(db, "users", user.uid, "follows", userId);
      const followerRef = doc(db, "users", userId, "followers", user.uid);

      if (isFollowing) {
        await deleteDoc(followRef);
        await deleteDoc(followerRef);
      } else {
        await setDoc(followRef, {
          followerId: user.uid,
          followedId: userId,
          createdAt: serverTimestamp(),
        });
        await setDoc(followerRef, {
          sourceUserId: user.uid,
          createdAt: serverTimestamp(),
        });

        // Notification
        await sendNotification(userId, {
          senderId: user.uid,
          senderName: currentUserProfile?.name || user.displayName || "Someone",
          type: "follow",
        });
      }
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.WRITE,
        `users/${user.uid}/follows/${userId}`,
      );
    }
  };

  const [showBlockConfirm, setShowBlockConfirm] = useState(false);

  const executeBlock = async () => {
    if (!user || isOwnProfile) return;
    setBlocking(true);
    setShowBlockConfirm(false);
    try {
      const currentUserRef = doc(db, "users", user.uid);
      await updateDoc(currentUserRef, {
        blockedUsers: arrayUnion(userId),
      });

      // If blocking, also unfollow
      if (isFollowing) {
        await handleFollow();
      }
    } catch (error) {
      console.error("Block error:", error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setBlocking(false);
    }
  };

  const handleBlock = async () => {
    if (!user || isOwnProfile || blocking) return;

    if (!isBlocked) {
      setShowBlockConfirm(true);
      return;
    }

    setBlocking(true);
    try {
      const currentUserRef = doc(db, "users", user.uid);
      await updateDoc(currentUserRef, {
        blockedUsers: arrayRemove(userId),
      });
    } catch (error) {
      console.error("Block error:", error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setBlocking(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user || !isOwnProfile) return;
    setSaving(true);
    try {
      // Filter out undefined values to prevent Firestore error
      const updatePayload = Object.fromEntries(
        Object.entries(editData).filter(([_, v]) => v !== undefined),
      );

      const batch = writeBatch(db);
      batch.update(doc(db, "users", user.uid), {
        ...updatePayload,
        updatedAt: serverTimestamp(),
      });
      batch.set(
        doc(db, "private_user_info", user.uid),
        {
          phoneNumber: phoneNumber,
          name: updatePayload.name || profile?.name,
        },
        { merge: true },
      );

      await batch.commit();

      setProfile((prev) => (prev ? { ...prev, ...updatePayload } : null));
      setIsEditing(false);
    } catch (error) {
      console.error("Update profile error:", error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setSaving(false);
    }
  };

  const startEditing = () => {
    if (!profile) return;
    setEditData({
      name: profile.name,
      photoURL: profile.photoURL,
      hometown: profile.hometown,
      hometownId: profile.hometownId,
      currentLocation: profile.currentLocation,
      gender: profile.gender,
      birthDate: profile.birthDate,
      bio: profile.bio,
      coords: profile.coords,
    });
    setIsEditing(true);
  };

  if (loading) return <div className="p-8 font-bold">{t.saving}</div>;
  if (!profile) return <div className="p-8">User not found.</div>;

  return (
    <div className="flex flex-col min-h-full bg-[var(--theme-bg-body)] text-theme-white pb-24">
      <div className="p-6 flex items-center justify-between sticky top-0 bg-[var(--theme-bg-body)]/80 backdrop-blur-md z-20">
        <div className="flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="p-2 bg-zinc-900 rounded-xl">
              <ArrowLeft
                size={20}
                className={language === "ar" ? "rotate-180" : ""}
              />
            </button>
          )}
          <h2 className="font-black uppercase tracking-[0.2em] text-[10px] italic">
            {t.profile}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {isOwnProfile && !isEditing && (
            <button
              onClick={startEditing}
              className="p-2 bg-theme-white/5 text-theme-white rounded-xl hover:bg-theme-white/10 transition-colors"
            >
              <Edit2 size={20} />
            </button>
          )}
          {isOwnProfile && (
            <button
              onClick={() => onNavigate?.("settings")}
              className="p-2 bg-theme-white/5 text-theme-white rounded-xl hover:bg-theme-white/10 transition-colors"
            >
              <SettingsIcon size={20} />
            </button>
          )}
          {isOwnProfile && (
            <button
              onClick={logout}
              className="p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-colors"
            >
              <LogOut size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="px-8 pt-4 space-y-8">
        <div className="flex items-center gap-6">
          <input
            type="file"
            ref={profileFileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleProfilePhotoUpload}
          />
          <div
            onClick={() =>
              isEditing && isOwnProfile && profileFileInputRef.current?.click()
            }
            className={cn(
              "w-24 h-24 rounded-[32px] bg-zinc-800 border-4 border-zinc-900 overflow-hidden shadow-2xl flex-shrink-0 relative group flex items-center justify-center",
              isEditing && isOwnProfile && "cursor-pointer",
            )}
          >
            <img
              src={
                isEditing
                  ? editData.photoURL ||
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`
                  : profile.photoURL ||
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`
              }
              alt={profile.name}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              loading="eager"
            />
            {isEditing && isOwnProfile && (
              <div className="absolute inset-0 bg-theme-black/60 flex flex-col items-center justify-center transition-opacity p-2">
                {saving ? (
                  <Loader2 className="animate-spin text-theme-white" size={16} />
                ) : (
                  <Edit2 size={16} className="text-theme-white mb-1" />
                )}
                <div className="text-[6px] font-black uppercase text-theme-white tracking-widest text-center leading-tight">
                  {saving ? t.saving : t.editPhoto}
                </div>
              </div>
            )}
          </div>
          <div className="flex-1 space-y-4 text-start">
            {saving && uploadProgress > 0 && uploadProgress < 100 && (
              <div className="w-full h-1 bg-theme-white/10 rounded-full overflow-hidden mb-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  className="h-full bg-village-green glow-green"
                />
              </div>
            )}
            {error && (
              <div className="bg-red-500/10 border border-red-500/10 text-red-500 text-[8px] uppercase font-black tracking-widest p-2 rounded-lg mb-2">
                {error}
              </div>
            )}
            {isEditing ? (
              <input
                value={editData.name || ""}
                onChange={(e) =>
                  setEditData({ ...editData, name: e.target.value })
                }
                className="text-2xl font-black italic tracking-tighter bg-zinc-900 border-none rounded-xl p-2 w-full outline-none focus:ring-2 focus:ring-theme-white text-start"
              />
            ) : (
              <h1 className="text-4xl font-black italic tracking-tighter">
                {profile.name}
              </h1>
            )}
            <div className="flex gap-6 justify-start">
              <div className="text-center">
                <div className="font-black text-xl">{posts.length}</div>
                <div className="text-[10px] uppercase text-zinc-600 font-black tracking-widest">
                  {t.post}
                </div>
              </div>
              <div className="text-center">
                <div className="font-black text-xl">{followersCount}</div>
                <div className="text-[10px] uppercase text-zinc-600 font-black tracking-widest">
                  {t.followers}
                </div>
              </div>
              <div className="text-center">
                <div className="font-black text-xl">{followingCount}</div>
                <div className="text-[10px] uppercase text-zinc-600 font-black tracking-widest">
                  {t.following}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/50 rounded-[40px] p-6 space-y-6 border border-zinc-800/50 relative overflow-hidden">
          <AnimatePresence mode="wait">
            {isEditing ? (
              <motion.div
                key="editing"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4 text-start"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-black tracking-widest opacity-50 px-2">
                      {t.hometown}
                    </label>
                    <SearchableSelect
                      value={editData.hometown || ""}
                      onChange={(val) => {
                        setEditData({
                          ...editData,
                          hometown: val,
                          hometownId: val.toLowerCase().replace(/\s+/g, "-"),
                        });
                      }}
                      options={locations.map(loc => ({ id: loc.id || loc.name, name: loc.name }))}
                      placeholder={t.selectLocation}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRequestModal(true)}
                      className="text-[10px] uppercase font-black tracking-widest text-zinc-500 hover:text-theme-white transition-colors flex items-center gap-1 mt-1 px-2"
                    >
                      <Plus size={12} /> {t.villageNotFound}
                    </button>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-black tracking-widest opacity-50 px-2">
                      {t.displacement}
                    </label>
                    <SearchableSelect
                      value={editData.currentLocation || ""}
                      onChange={(val) => {
                        const loc = locations.find((l) => l.name === val);
                        setEditData({
                          ...editData,
                          currentLocation: val,
                          coords: loc
                            ? { lat: loc.lat, lng: loc.lng }
                            : editData.coords,
                        });
                      }}
                      options={locations.map(loc => ({ id: loc.id || loc.name, name: loc.name }))}
                      placeholder={t.selectLocation}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRequestModal(true)}
                      className="text-[10px] uppercase font-black tracking-widest text-zinc-500 hover:text-theme-white transition-colors flex items-center gap-1 mt-1 px-2"
                    >
                      <Plus size={12} /> {t.villageNotFound}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-black tracking-widest opacity-50 px-2">
                      {t.gender}
                    </label>
                    <select
                      value={editData.gender || "male"}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          gender: e.target.value as any,
                        })
                      }
                      className="w-full bg-theme-black/40 rounded-2xl p-3 text-sm font-bold border-none outline-none focus:ring-1 focus:ring-theme-white text-start"
                    >
                      <option value="male" className="bg-zinc-900">
                        {t.male}
                      </option>
                      <option value="female" className="bg-zinc-900">
                        {t.female}
                      </option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-black tracking-widest opacity-50 px-2">
                      {t.birthDate}
                    </label>
                    <input
                      type="date"
                      value={editData.birthDate || ""}
                      onChange={(e) =>
                        setEditData({ ...editData, birthDate: e.target.value })
                      }
                      className="w-full bg-theme-black/40 rounded-2xl p-3 text-sm font-bold border-none outline-none focus:ring-1 focus:ring-theme-white text-start"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-widest opacity-50 px-2">
                    {t.phoneNumber}
                  </label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-theme-black/40 rounded-2xl p-3 text-sm font-bold border-none outline-none focus:ring-1 focus:ring-theme-white text-start"
                    placeholder="+961 70 123 456"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-widest opacity-50 px-2">
                    {t.bio}
                  </label>
                  <textarea
                    value={editData.bio || ""}
                    onChange={(e) =>
                      setEditData({ ...editData, bio: e.target.value })
                    }
                    rows={2}
                    className="w-full bg-theme-black/40 rounded-2xl p-4 text-sm font-bold border-none outline-none focus:ring-1 focus:ring-theme-white resize-none text-start"
                    placeholder="..."
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleUpdateProfile}
                    disabled={saving}
                    className="flex-1 bg-theme-white text-theme-black py-3 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      "..."
                    ) : (
                      <>
                        <Check size={16} /> {t.saveChanges}
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="p-3 bg-theme-white/5 rounded-2xl hover:bg-theme-white/10"
                  >
                    <X size={16} />
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="viewing"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="space-y-6 text-start"
              >
                {profile.bio && (
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-black tracking-widest opacity-50 px-1">
                      {t.bio}
                    </span>
                    <p className="text-sm font-medium leading-relaxed italic">
                      {profile.bio}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                  <div className="flex items-center gap-4 text-zinc-500">
                    <div className="w-10 h-10 bg-theme-white/5 rounded-2xl flex items-center justify-center text-theme-white">
                      <Home size={20} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-black tracking-widest opacity-50">
                        {t.homeVillage}
                      </span>
                      <span className="text-base text-theme-white font-bold">
                        {profile.hometown}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-zinc-500">
                    <div className="w-10 h-10 bg-theme-white/5 rounded-2xl flex items-center justify-center text-theme-white">
                      <MapPin size={20} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-black tracking-widest opacity-50">
                        {t.displacement}
                      </span>
                      <span className="text-base text-theme-white font-bold">
                        {profile.currentLocation}
                      </span>
                    </div>
                  </div>
                  {profile.gender && (
                    <div className="flex items-center gap-4 text-zinc-500">
                      <div className="w-10 h-10 bg-theme-white/5 rounded-2xl flex items-center justify-center text-theme-white">
                        <User size={20} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-black tracking-widest opacity-50">
                          {t.gender}
                        </span>
                        <span className="text-base text-theme-white font-bold">
                          {profile.gender === "male" ? t.male : t.female}
                        </span>
                      </div>
                    </div>
                  )}
                  {profile.birthDate && (
                    <div className="flex items-center gap-4 text-zinc-500">
                      <div className="w-10 h-10 bg-theme-white/5 rounded-2xl flex items-center justify-center text-theme-white">
                        <Calendar size={20} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-black tracking-widest opacity-50">
                          {t.birthDate}
                        </span>
                        <span className="text-base text-theme-white font-bold">
                          {profile.birthDate}
                        </span>
                      </div>
                    </div>
                  )}
                  {isOwnProfile && phoneNumber && (
                    <div className="flex items-center gap-4 text-zinc-500">
                      <div className="w-10 h-10 bg-theme-white/5 rounded-2xl flex items-center justify-center text-theme-white">
                        <Phone size={20} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-black tracking-widest opacity-50">
                          {t.phoneNumber}
                        </span>
                        <span className="text-base text-theme-white font-bold">
                          {phoneNumber}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {isOwnProfile && (
                  <div className="flex items-center gap-4 text-zinc-500 pt-4 border-t border-zinc-800/50">
                    <div className="w-10 h-10 bg-theme-white/5 rounded-2xl flex items-center justify-center text-theme-white">
                      <Languages size={20} />
                    </div>
                    <div className="flex-1 flex gap-2">
                      <button
                        onClick={() => setLanguage("ar")}
                        className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${language === "ar" ? "bg-theme-white text-theme-black ring-4 ring-theme-white/10" : "bg-zinc-800"}`}
                      >
                        {t.arabic}
                      </button>
                      <button
                        onClick={() => setLanguage("en")}
                        className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${language === "en" ? "bg-theme-white text-theme-black ring-4 ring-theme-white/10" : "bg-zinc-800"}`}
                      >
                        {t.english}
                      </button>
                    </div>
                  </div>
                )}

                {!isOwnProfile && (
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleFollow}
                      className={`flex-1 py-4 rounded-[20px] font-black uppercase tracking-widest text-xs transition-all ${isFollowing ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-theme-white text-theme-black shadow-xl ring-4 ring-theme-white/10"}`}
                    >
                      {isFollowing ? t.unfollow : t.follow}
                    </button>
                    <button
                      onClick={async () => {
                        if (!user) return;
                        try {
                          const convoId = [user.uid, userId].sort().join("_");
                          const convoRef = doc(db, "conversations", convoId);
                          const convoDoc = await getDoc(convoRef).catch((e) =>
                            handleFirestoreError(
                              e,
                              OperationType.GET,
                              `conversations/${convoId}`,
                            ),
                          );
                          if (convoDoc && !convoDoc.exists()) {
                            await setDoc(convoRef, {
                              participants: [user.uid, userId],
                              lastMessageAt: serverTimestamp(),
                              lastMessage: "",
                              unreadCount: {
                                [user.uid]: 0,
                                [userId]: 0,
                              },
                            }).catch((e) =>
                              handleFirestoreError(
                                e,
                                OperationType.CREATE,
                                `conversations/${convoId}`,
                              ),
                            );
                          }
                          onNavigate?.("messages");
                        } catch (error) {
                          console.error("Chat initialization failed:", error);
                        }
                      }}
                      className="bg-zinc-800 p-4 rounded-[20px] hover:bg-zinc-700 transition-colors"
                    >
                      <MessageSquare size={24} />
                    </button>

                    <button
                      onClick={handleBlock}
                      disabled={blocking}
                      className={cn(
                        "p-4 rounded-[20px] transition-all flex items-center justify-center",
                        isBlocked
                          ? "bg-red-500 text-theme-white"
                          : "bg-zinc-800 text-red-500 hover:bg-red-500/10",
                      )}
                      title={isBlocked ? t.unblockUser : t.blockUser}
                    >
                      {blocking ? (
                        <Loader2 size={24} className="animate-spin" />
                      ) : (
                        <Ban size={24} />
                      )}
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {isBlocked ? (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 opacity-40">
            <Ban size={48} />
            <p className="text-xs font-black uppercase tracking-[0.2em]">
              {t.userBlocked}
            </p>
          </div>
        ) : (
          <div className="h-4"></div>
        )}
      </div>

      {/* Location Request Modal */}
      <AnimatePresence>
        {showRequestModal && (
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-theme-black/80 backdrop-blur-sm"
            onClick={() => setShowRequestModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900 border border-theme-white/10 rounded-[32px] p-6 max-w-sm w-full shadow-2xl space-y-4 relative"
            >
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-black uppercase tracking-widest text-lg">
                  {t.requestLocation}
                </h4>
                <button
                  onClick={() => setShowRequestModal(false)}
                  className="p-2 glass rounded-full hover:bg-theme-white/10"
                >
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
                    className="w-full bg-amber-500 text-theme-black py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-amber-400 disabled:opacity-50 transition-colors mt-2"
                  >
                    {requestingLocation ? t.sending : t.send}
                  </button>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showBlockConfirm && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-theme-black/80 backdrop-blur-sm"
            onClick={() => setShowBlockConfirm(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900 border border-theme-white/10 rounded-[32px] p-6 max-w-sm w-full shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center">
                <h4 className="font-black uppercase tracking-widest text-lg text-theme-white flex items-center gap-2">
                  <ShieldAlert size={20} className="text-red-500" />
                  {t.blockUser}
                </h4>
                <button onClick={() => setShowBlockConfirm(false)} className="p-2 text-zinc-500 hover:text-theme-white transition-colors bg-theme-white/5 rounded-full">
                 <X size={20} />
               </button>
              </div>
              <p className="text-sm font-medium text-zinc-400">
                {t.blockingConfirm}
              </p>
              <div className="flex gap-4 mt-8">
                <button
                  onClick={() => setShowBlockConfirm(false)}
                  className="flex-1 bg-theme-white/10 text-theme-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-theme-white/20 transition-colors"
                >
                  {t.cancel || "Cancel"}
                </button>
                <button
                  onClick={executeBlock}
                  className="flex-1 bg-red-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-400 transition-colors"
                >
                  {t.block || "Block"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
