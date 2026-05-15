import { useState, useEffect, useRef } from "react";
import { Post, Comment as CommentType, View } from "../types";
import { motion, AnimatePresence } from "motion/react";
import {
  Heart,
  MessageCircle,
  Send,
  MapPin,
  Home,
  UserPlus,
  UserCheck,
  MoreHorizontal,
  Clock,
  X,
  Eye,
  Edit3,
  Trash2,
  ArrowUpCircle,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { db, auth, handleFirestoreError, OperationType } from "../lib/firebase";
import {
  doc,
  updateDoc,
  increment,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  setDoc,
  deleteDoc,
  where,
  getDoc,
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { cn } from "../lib/utils";
import { useLocations } from "../hooks/useLocations";
import { sendNotification } from "../services/notificationService";

interface PostCardProps {
  post: Post;
  onUserClick: (userId: string) => void;
  isActive: boolean;
}

// Haversine formula
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function PostCard({ post, onUserClick, isActive }: PostCardProps) {
  const { user, profile, t, language } = useAuth();
  const { locations } = useLocations();
  const [liked, setLiked] = useState(false);
  const [following, setFollowing] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentType[]>([]);
  const [newComment, setNewComment] = useState("");
  const [viewsCount, setViewsCount] = useState(0);
  const [viewers, setViewers] = useState<View[]>([]);
  const [showViewers, setShowViewers] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [savingEdit, setSavingEdit] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const likeRef = doc(db, "posts", post.id, "likes", user.uid);
    const unsubLike = onSnapshot(
      likeRef,
      (doc) => setLiked(doc.exists()),
      (err) =>
        handleFirestoreError(
          err,
          OperationType.GET,
          `posts/${post.id}/likes/${user.uid}`,
        ),
    );

    const followRef = doc(db, "users", user.uid, "follows", post.authorId);
    const unsubFollow = onSnapshot(
      followRef,
      (doc) => setFollowing(doc.exists()),
      (err) =>
        handleFirestoreError(
          err,
          OperationType.GET,
          `users/${user.uid}/follows/${post.authorId}`,
        ),
    );

    const viewsRef = collection(db, "posts", post.id, "views");
    const unsubViews = onSnapshot(viewsRef, (snapshot) => {
      setViewsCount(snapshot.size);
      if (user?.uid === post.authorId) {
        setViewers(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as View[],
        );
      }
    });

    const q = query(
      collection(db, "posts", post.id, "comments"),
      where("userId", ">=", ""), // Satisfies resource.data.userId != null
      orderBy("createdAt", "desc"),
    );
    const unsubComments = onSnapshot(
      q,
      (snapshot) => {
        setComments(
          snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as CommentType[],
        );
      },
      (err) =>
        handleFirestoreError(
          err,
          OperationType.LIST,
          `posts/${post.id}/comments`,
        ),
    );

    return () => {
      unsubLike();
      unsubFollow();
      unsubViews();
      unsubComments();
    };
  }, [post.id, post.authorId, user]);

  useEffect(() => {
    if (isActive && user && user.uid !== post.authorId && profile) {
      const markViewed = async () => {
        const viewRef = doc(db, "posts", post.id, "views", user.uid);
        const viewDoc = await getDoc(viewRef);
        if (!viewDoc.exists()) {
          await setDoc(viewRef, {
            userId: user.uid,
            userName: profile.name,
            photoURL: profile.photoURL || null,
            createdAt: serverTimestamp(),
          }).catch((e) => console.error("View tracking failed", e));
        }
      };
      markViewed();
    }
  }, [isActive, user, post.id, post.authorId, profile]);

  const handleLike = async () => {
    if (!user || !profile) return;
    const likeRef = doc(db, "posts", post.id, "likes", user.uid);
    const postRef = doc(db, "posts", post.id);

    if (liked) {
      await deleteDoc(likeRef);
      await updateDoc(postRef, { likesCount: increment(-1) });
    } else {
      await setDoc(likeRef, { userId: user.uid, createdAt: serverTimestamp() });
      await updateDoc(postRef, { likesCount: increment(1) });

      // Notification
      if (user.uid !== post.authorId) {
        await sendNotification(post.authorId, {
          senderId: user.uid,
          senderName: profile.name,
          type: "like",
          postId: post.id,
        });
      }
    }
  };

  const handleFollow = async () => {
    if (!user || user.uid === post.authorId) return;
    const followRef = doc(db, "users", user.uid, "follows", post.authorId);
    const followerRef = doc(db, "users", post.authorId, "followers", user.uid);

    if (following) {
      await deleteDoc(followRef);
      await deleteDoc(followerRef);
    } else {
      await setDoc(followRef, {
        followerId: user.uid,
        followedId: post.authorId,
        createdAt: serverTimestamp(),
      });
      await setDoc(followerRef, {
        sourceUserId: user.uid,
        createdAt: serverTimestamp(),
      });
    }
  };

  const handleAddComment = async () => {
    if (!user || !profile || !newComment.trim()) return;
    try {
      await addDoc(collection(db, "posts", post.id, "comments"), {
        userId: user.uid,
        userName: profile.name,
        text: newComment,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "posts", post.id), {
        commentsCount: increment(1),
      });

      // Notification
      if (user.uid !== post.authorId) {
        await sendNotification(post.authorId, {
          senderId: user.uid,
          senderName: profile.name,
          type: "comment",
          postId: post.id,
        });
      }
      setNewComment("");
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateContent = async () => {
    if (!editContent.trim() || editContent === post.content) {
      setIsEditing(false);
      return;
    }
    setSavingEdit(true);
    try {
      await updateDoc(doc(db, "posts", post.id), {
        content: editContent,
        editedAt: serverTimestamp(),
      });
      setIsEditing(false);
    } catch (error) {
      console.error(error);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeletePost = async () => {
    try {
      setSavingEdit(true);
      console.log("Deleting post:", post.id);
      const postRef = doc(db, "posts", post.id);
      await deleteDoc(postRef);
      console.log("Post deleted successfully");
      setShowMenu(false);
    } catch (error: any) {
      console.error("Delete failed:", error);
      alert(t.deleteFailed + error.message);
      handleFirestoreError(error, OperationType.DELETE, `posts/${post.id}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleReportPost = async () => {
    if (!user || !profile || !reportReason.trim()) return;
    setReporting(true);
    try {
      const reportRef = await addDoc(collection(db, "reports"), {
        reporterId: user.uid,
        reporterName: profile.name,
        targetId: post.id,
        authorId: post.authorId,
        reason: reportReason,
        type: "post",
        status: "pending",
        createdAt: serverTimestamp(),
      });

      // Send Admin Notification
      await addDoc(collection(db, "admin_notifications"), {
        reportId: reportRef.id,
        reporterName: profile.name,
        type: "new_report",
        read: false,
        createdAt: serverTimestamp(),
      });

      setShowReportModal(false);
      setReportReason("");
      alert(t.reportSubmitted);
    } catch (error) {
      console.error("Report failed:", error);
      handleFirestoreError(error, OperationType.CREATE, "reports");
    } finally {
      setReporting(false);
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startHold = () => {
    holdTimeoutRef.current = setTimeout(() => {
      setIsHolding(true);
      window.dispatchEvent(new CustomEvent('post-hold-start'));
    }, 200);
  };

  const endHold = () => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    setIsHolding(false);
    window.dispatchEvent(new CustomEvent('post-hold-end'));
  };

  const timeToExpiry =
    post.expiresAt && typeof post.expiresAt.toDate === "function"
      ? formatDistanceToNow(post.expiresAt.toDate())
      : "";

  const authorLocation = locations.find(l => l.name === post.authorCurrentLocation);
  const readerLocation = locations.find(l => l.name === profile?.currentLocation);

  const authorCoords = authorLocation ? { lat: authorLocation.lat, lng: authorLocation.lng } : post.coords;
  const readerCoords = readerLocation ? { lat: readerLocation.lat, lng: readerLocation.lng } : profile?.coords;

  const distance =
    readerCoords && authorCoords
      ? calculateDistance(
          readerCoords.lat,
          readerCoords.lng,
          authorCoords.lat,
          authorCoords.lng,
        ).toFixed(1)
      : null;

  return (
    <div 
      className="h-full w-full relative overflow-hidden bg-[var(--theme-bg-body)] flex flex-col pb-6 justify-between select-none"
      onPointerDown={startHold}
      onPointerUp={endHold}
      onPointerLeave={endHold}
      onPointerCancel={endHold}
      onContextMenu={(e) => {
        if (post.mediaUrl) e.preventDefault();
      }}
    >
      {/* Media Stack */}
      {post.mediaUrl && (
        <div className="absolute inset-0 z-10 pointer-events-none">
          {/* Blurred Background */}
          <div
            className="absolute inset-0 bg-cover bg-center blur-3xl opacity-40 z-0 scale-110"
            style={{ backgroundImage: `url(${post.mediaUrl})` }}
          />

          {post.mediaType === "video" ? (
            <video
              src={post.mediaUrl}
              className="w-full h-full object-contain relative z-20"
              autoPlay
              muted
              loop
              playsInline
              referrerPolicy="no-referrer"
            />
          ) : (
            <img
              src={post.mediaUrl}
              alt="Post content"
              className="w-full h-full object-contain relative z-20"
              referrerPolicy="no-referrer"
              loading="eager"
            />
          )}

          {/* Overlay Gradients */}
          <div className={cn("absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/30 to-transparent z-[25] pointer-events-none transition-opacity duration-300", isHolding ? "opacity-0" : "opacity-100")} />
          <div className={cn("absolute inset-x-0 bottom-0 h-80 bg-gradient-to-t from-black/50 to-transparent z-[25] pointer-events-none transition-opacity duration-300", isHolding ? "opacity-0" : "opacity-100")} />
        </div>
      )}

      {/* Top Header Information */}
      <div className={cn("relative z-50 flex items-center justify-between gap-4 py-6 px-6 transition-opacity duration-300", !post.mediaUrl ? "bg-[var(--theme-bg-body)] border-b border-theme-white/5 py-8" : "bg-white/10 backdrop-blur-xl border-b border-white/20 pt-10 shadow-lg", isHolding ? "opacity-0 pointer-events-none" : "opacity-100")}>
        <div className="flex items-center gap-4 flex-1">
          <button
            onClick={() => onUserClick(post.authorId)}
            className="w-14 h-14 rounded-[24px] glass border border-theme-white/20 flex-shrink-0 overflow-hidden relative shadow-2xl"
          >
            <img
              src={
                post.authorPhotoURL ||
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.authorId}`
              }
              alt={post.authorName}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 border-[3px] border-village-green/20 rounded-[24px]" />
          </button>
          <div className="text-start">
            <div className="flex items-center gap-3">
              <h3 className={cn("font-bold text-lg drop-shadow-md", post.mediaUrl ? "text-white" : "text-theme-white")}>
                {post.authorName}
              </h3>
              {user && user.uid !== post.authorId && (
                <button
                  onClick={handleFollow}
                  className={cn(
                    "text-[9px] px-4 py-1.5 rounded-full font-black transition-all uppercase tracking-widest",
                    following
                      ? (post.mediaUrl ? "glass text-white/60 border-white/10" : "glass text-theme-white/40 border-theme-white/5")
                      : "bg-village-green text-theme-black shadow-lg glow-green",
                  )}
                >
                  {following ? t.following : t.follow}
                </button>
              )}
            </div>
            <div className={cn("flex flex-col text-[10px] uppercase tracking-[0.2em] font-black mt-1 gap-1", post.mediaUrl ? "text-white/60 drop-shadow-md" : "text-theme-white/40")}>
              <span className="flex items-center gap-1.5">
                <Home size={10} className="text-village-green" />{" "}
                {post.authorHometown}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin size={10} className="text-village-green" />{" "}
                {post.authorCurrentLocation}{" "}
                {distance && `• ${distance} ${t.km}`}
              </span>
              <div className="flex items-center gap-1.5 text-village-green font-black">
                <Clock size={10} />
                <span>{timeToExpiry}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={cn("relative z-50 px-6 transition-opacity duration-300", !post.mediaUrl ? "flex-1 flex py-6" : "", isHolding ? "opacity-0 pointer-events-none" : "opacity-100")}>
        <div className={cn("flex justify-between gap-4 w-full", !post.mediaUrl ? "items-stretch" : "items-end")}>
          <div className={cn("flex-1", !post.mediaUrl ? "flex flex-col justify-center px-4" : "space-y-6")}>
            {isEditing ? (
              <div className="space-y-3 glass-dark p-4 rounded-[32px] border border-theme-white/10">
                <textarea
                  autoFocus
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className={cn("w-full bg-transparent border-none p-0 text-theme-white font-medium outline-none placeholder-theme-white/20", !post.mediaUrl ? "text-center text-2xl" : "text-start text-lg")}
                  rows={3}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleUpdateContent}
                    className="flex-1 bg-village-green text-theme-black py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest glow-green"
                  >
                    {savingEdit ? "..." : t.update}
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-6 glass text-theme-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest"
                  >
                    {t.cancel}
                  </button>
                </div>
              </div>
            ) : (
              <div className={cn("font-semibold leading-relaxed tracking-tight drop-shadow-2xl", post.mediaUrl ? "text-white text-2xl text-start" : "text-theme-white text-3xl sm:text-4xl text-center")}>
                {post.content}
              </div>
            )}

            <div className="flex items-center gap-3"></div>
          </div>

          <div className={cn("flex flex-col gap-7 pt-4 items-center", !post.mediaUrl ? "justify-end pb-2" : "")}>
            <div className="flex flex-col items-center gap-1.5">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.8 }}
                onClick={handleLike}
                className={cn(
                  "w-14 h-14 rounded-3xl flex items-center justify-center border transition-all shadow-2xl backdrop-blur-md",
                  liked
                    ? "text-red-500 border-red-500/30 bg-red-500/20"
                    : (post.mediaUrl
                        ? "text-white border-white/30 bg-white/10 hover:bg-white/20 drop-shadow-[0_0_8px_rgba(0,0,0,0.5)]"
                        : "text-theme-white border-theme-white/20 bg-theme-white/5 hover:bg-theme-white/10")
                )}
              >
                <Heart
                  size={28}
                  fill={liked ? "currentColor" : "none"}
                  strokeWidth={liked ? 0 : 2.5}
                />
              </motion.button>
              <span className={cn("text-[10px] font-black", post.mediaUrl ? "text-white drop-shadow-md" : "text-theme-white/60")}>
                {post.likesCount}
              </span>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.8 }}
                onClick={() => setShowComments(true)}
                className={cn(
                  "w-14 h-14 rounded-3xl flex items-center justify-center border transition-all shadow-2xl backdrop-blur-md",
                  post.mediaUrl
                    ? "text-white border-white/30 bg-white/10 hover:bg-white/20 drop-shadow-[0_0_8px_rgba(0,0,0,0.5)]"
                    : "text-theme-white border-theme-white/20 bg-theme-white/5 hover:bg-theme-white/10"
                )}
              >
                <MessageCircle size={28} />
              </motion.button>
              <span className={cn("text-[10px] font-black", post.mediaUrl ? "text-white drop-shadow-md" : "text-theme-white/60")}>
                {post.commentsCount}
              </span>
            </div>

            {user?.uid === post.authorId && (
              <div className="flex flex-col items-center gap-1.5">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.8 }}
                  onClick={() => setShowViewers(true)}
                  className={cn(
                    "w-14 h-14 rounded-3xl flex items-center justify-center border transition-all shadow-2xl backdrop-blur-md",
                    post.mediaUrl
                      ? "text-white/90 border-white/30 bg-white/10 hover:bg-white/20 drop-shadow-[0_0_8px_rgba(0,0,0,0.5)]"
                      : "text-theme-white/80 border-theme-white/20 bg-theme-white/5 hover:bg-theme-white/10"
                  )}
                >
                  <Eye size={28} />
                </motion.button>
                <span className={cn("text-[10px] font-black", post.mediaUrl ? "text-white drop-shadow-md" : "text-theme-white/40")}>
                  {viewsCount}
                </span>
              </div>
            )}

            <div className="relative overflow-visible">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowMenu(!showMenu)}
                className={cn(
                  "w-14 h-11 rounded-2xl flex items-center justify-center border transition-all shadow-2xl backdrop-blur-md",
                  post.mediaUrl
                    ? "text-white/90 border-white/30 bg-white/10 hover:bg-white/20 drop-shadow-[0_0_8px_rgba(0,0,0,0.5)]"
                    : "text-theme-white/80 border-theme-white/10 bg-theme-white/5 hover:bg-theme-white/10"
                )}
              >
                <MoreHorizontal size={20} />
              </motion.button>

              <AnimatePresence>
                {showMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-[998]"
                      onClick={() => setShowMenu(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        "absolute bottom-full mb-4 glass-dark border border-theme-white/10 rounded-[32px] p-4 shadow-2xl min-w-[200px] z-[999] flex flex-col gap-2",
                        language === "ar" ? "left-0" : "right-0",
                      )}
                    >
                    {(user?.uid === post.authorId || profile?.isAdmin) && (
                      <>
                        {user?.uid === post.authorId && (
                          <button
                            onClick={() => {
                              setIsEditing(true);
                              setShowMenu(false);
                            }}
                            className="flex items-center justify-start gap-3 p-4 hover:bg-theme-white/5 rounded-2xl transition-colors text-right w-full"
                          >
                            <span className="text-xs font-bold uppercase tracking-widest">
                              {t.editPost}
                            </span>
                            <Edit3 size={18} className="text-village-green" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setShowDeleteConfirm(true);
                            setShowMenu(false);
                          }}
                          className="flex items-center justify-start gap-3 p-4 hover:bg-red-500/10 text-red-500 rounded-2xl transition-colors text-right w-full"
                        >
                          <span className="text-xs font-bold uppercase tracking-widest">
                            {t.delete}
                          </span>
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                    {user?.uid !== post.authorId && (
                      <button
                        onClick={() => {
                          setShowReportModal(true);
                          setShowMenu(false);
                        }}
                        className="flex items-center justify-start gap-3 p-4 hover:bg-amber-500/10 text-amber-500 rounded-2xl transition-colors text-right w-full"
                      >
                        <span className="text-xs font-bold uppercase tracking-widest">
                          {t.reportButton}
                        </span>
                        <AlertTriangle size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => setShowMenu(false)}
                      className="p-3 glass rounded-[20px] text-xs font-black uppercase tracking-widest text-center mt-2 border border-theme-white/10 hover:bg-theme-white/5"
                    >
                      {t.cancel}
                    </button>
                  </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showDeleteConfirm && (
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-theme-black/80 backdrop-blur-md"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900 border border-theme-white/10 p-8 rounded-[40px] max-w-sm w-full space-y-6 shadow-2xl"
            >
              <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <Trash2 size={32} />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black uppercase tracking-tighter">
                  {t.deletePostAdmin}
                </h3>
                <p className="text-zinc-500 text-sm font-medium">
                  {t.areYouSureDelete}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleDeletePost}
                  disabled={savingEdit}
                  className="flex-1 bg-red-500 text-theme-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-red-500/20 disabled:opacity-50"
                >
                  {savingEdit ? "..." : t.yesDelete}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 bg-zinc-800 text-theme-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px]"
                >
                  {t.cancel}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showReportModal && (
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-theme-black/80 backdrop-blur-md"
            onClick={() => setShowReportModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900 border border-theme-white/10 p-8 rounded-[40px] max-w-sm w-full space-y-6 shadow-2xl"
            >
              <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle size={32} />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black uppercase tracking-tighter">
                  {t.reportContent}
                </h3>
                <p className="text-zinc-500 text-sm font-medium">
                  {t.whyReport}
                </p>
              </div>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder={t.enterReason}
                className="w-full bg-theme-black/40 rounded-3xl p-4 text-sm font-medium border border-theme-white/5 outline-none focus:ring-1 focus:ring-amber-500 text-start min-h-[100px]"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleReportPost}
                  disabled={reporting || !reportReason.trim()}
                  className="flex-1 bg-amber-500 text-theme-black py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-amber-500/20 disabled:opacity-50"
                >
                  {reporting ? "..." : t.submitReport}
                </button>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="flex-1 bg-zinc-800 text-theme-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px]"
                >
                  {t.cancel}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showComments && (
          <div
            className="fixed inset-0 z-[200] flex flex-col justify-end bg-theme-black/60 backdrop-blur-sm"
            onClick={() => setShowComments(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              onClick={(e) => e.stopPropagation()}
              className="mt-20 flex-1 bg-zinc-950 rounded-t-[40px] flex flex-col p-8 border-t border-zinc-900"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black italic tracking-tighter uppercase">
                  {t.comments}
                </h3>
                <button
                  onClick={() => setShowComments(false)}
                  className="w-10 h-10 flex items-center justify-center bg-zinc-900 rounded-full"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 mb-4 scrollbar-hide">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-4 items-start">
                    <div className="w-10 h-10 rounded-[14px] bg-zinc-900 flex-shrink-0" />
                    <div className="flex-1 space-y-1">
                      <div className="text-xs font-black uppercase tracking-widest flex gap-2 items-center text-zinc-500">
                        <span className="text-theme-white font-bold">
                          {comment.userName}
                        </span>
                        <div className="w-1 h-1 bg-zinc-800 rounded-full" />
                        <span>
                          {comment.createdAt &&
                          typeof comment.createdAt.toDate === "function"
                            ? formatDistanceToNow(comment.createdAt.toDate())
                            : t.ago}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-200 font-medium text-start">
                        {comment.text}
                      </p>
                    </div>
                  </div>
                ))}
                {comments.length === 0 && (
                  <p className="text-center text-zinc-700 py-20 font-bold uppercase tracking-widest text-xs">
                    No comments yet
                  </p>
                )}
              </div>

              <div className="flex gap-3 bg-zinc-900 p-3 rounded-[24px] items-center">
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={t.messageDot}
                  className="flex-1 bg-transparent border-none outline-none px-4 py-2 text-sm text-start"
                />
                <button
                  onClick={handleAddComment}
                  disabled={!newComment.trim()}
                  className="bg-zinc-900 text-theme-white p-3 rounded-2xl disabled:opacity-50 hover:bg-zinc-800 transition-colors"
                >
                  <Send
                    size={20}
                    className={language === "ar" ? "rotate-180" : ""}
                  />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showViewers && (
          <div
            className="fixed inset-0 z-[200] flex flex-col justify-end bg-theme-black/60 backdrop-blur-sm"
            onClick={() => setShowViewers(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              onClick={(e) => e.stopPropagation()}
              className="mt-auto h-[50vh] bg-zinc-950 rounded-t-[40px] flex flex-col p-8 border-t border-zinc-900 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-black italic tracking-tighter uppercase">
                    {t.views}
                  </h3>
                  <span className="bg-zinc-900 px-3 py-1 rounded-full text-xs font-bold text-amber-500">
                    {viewsCount}
                  </span>
                </div>
                <button
                  onClick={() => setShowViewers(false)}
                  className="w-10 h-10 flex items-center justify-center bg-zinc-900 rounded-full"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 scrollbar-hide">
                {viewers.map((viewer) => (
                  <div
                    key={viewer.id}
                    className="flex items-center gap-4 p-2 hover:bg-zinc-900/50 rounded-2xl transition-colors cursor-pointer"
                    onClick={() => {
                      onUserClick(viewer.userId);
                      setShowViewers(false);
                    }}
                  >
                    <div className="w-12 h-12 rounded-[18px] bg-zinc-800 overflow-hidden border border-theme-white/5">
                      <img
                        src={
                          viewer.photoURL ||
                          `https://api.dicebear.com/7.x/avataaars/svg?seed=${viewer.userId}`
                        }
                        alt={viewer.userName}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm tracking-tight">
                        {viewer.userName}
                      </p>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                        {viewer.createdAt &&
                        typeof viewer.createdAt.toDate === "function"
                          ? formatDistanceToNow(viewer.createdAt.toDate())
                          : ""}
                      </p>
                    </div>
                  </div>
                ))}
                {viewers.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-700 space-y-2">
                    <Eye size={48} strokeWidth={1} />
                    <p className="font-black uppercase tracking-widest text-[10px]">
                      {t.noViewsYet}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
