import { useState, useEffect, useRef, useMemo } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  serverTimestamp,
  deleteDoc,
  doc,
  Timestamp,
  limit,
} from "firebase/firestore";
import { db, auth, handleFirestoreError, OperationType } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { useAds } from "../context/AdsContext";
import { Post as PostType } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { PostCard } from "./PostCard";
import { AdUnit } from "./AdUnit";
import { cn } from "../lib/utils";
import {
  Plus,
  History,
  Sparkles,
} from "lucide-react";
import { useLocations } from "../hooks/useLocations";

interface FeedProps {
  onUserClick: (userId: string) => void;
  onCreatePost: () => void;
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

export function Feed({ onUserClick, onCreatePost }: FeedProps) {
  const { user, profile, t } = useAuth();
  const { settings } = useAds();
  const { locations } = useLocations();
  const [posts, setPosts] = useState<PostType[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showViewed, setShowViewed] = useState(false);
  const [unviewedFilterSet, setUnviewedFilterSet] = useState<Set<string>>(
    () => new Set(JSON.parse(localStorage.getItem("viewedPosts") || "[]")),
  );
  const [viewedPostsLocal, setViewedPostsLocal] =
    useState<Set<string>>(unviewedFilterSet);
  const [isHolding, setIsHolding] = useState(false);

  useEffect(() => {
    const handleHoldStart = () => setIsHolding(true);
    const handleHoldEnd = () => setIsHolding(false);
    window.addEventListener('post-hold-start', handleHoldStart);
    window.addEventListener('post-hold-end', handleHoldEnd);
    return () => {
      window.removeEventListener('post-hold-start', handleHoldStart);
      window.removeEventListener('post-hold-end', handleHoldEnd);
    };
  }, []);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const followsQ = query(
      collection(db, "users", user.uid, "follows"),
      where("followedId", ">=", ""),
    );
    const unsubFollows = onSnapshot(
      followsQ,
      (snapshot) => {
        setFollowingIds(snapshot.docs.map((d) => d.data().followedId));
      },
      (err: any) => {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes("Quota") || errMsg.includes("quota")) {
          console.warn("Firestore Quota exceeded on follows query");
        } else {
          handleFirestoreError(
            err,
            OperationType.LIST,
            `users/${user.uid}/follows`,
          );
        }
      },
    );

    return () => unsubFollows();
  }, [user]);

  const loadPosts = async () => {
    // Try to load from local cache first to save reads
    const cachedData = localStorage.getItem("feedPostsCache");
    const cacheTime = localStorage.getItem("feedPostsCacheTime");

    if (cachedData && cacheTime) {
      const age = Date.now() - parseInt(cacheTime, 10);
      // If cache is less than 24 hours old (86400000 ms), use it
      if (age < 86400000) {
        const parsed = JSON.parse(cachedData);
        if (parsed && parsed.length > 0) {
          setPosts(parsed);
          setLoading(false);
          return; // Skip fetching to save quota
        }
      }
    }

    setLoading(true);
    try {
      const q = query(
        collection(db, "posts"),
        where("expiresAt", ">", Timestamp.fromDate(new Date())),
        where("authorId", ">=", ""), // Satisfies resource.data.authorId != null
        orderBy("expiresAt", "desc"),
        limit(20), // Reduced limit to save reads
      );

      const snapshot = await getDocs(q);
      const fetchedPosts = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter(
          (post) =>
            !profile?.blockedUsers?.includes((post as PostType).authorId),
        ) as PostType[];

      if (profile) {
        const sorted = [...fetchedPosts].sort((a, b) => {
          // 0. Followed users priority
          const aIsFollowed = followingIds.includes(a.authorId);
          const bIsFollowed = followingIds.includes(b.authorId);

          if (aIsFollowed && !bIsFollowed) return -1;
          if (!aIsFollowed && bIsFollowed) return 1;

          // 1. Same village priority
          const aSameHometown = a.authorHometownId === profile.hometownId;
          const bSameHometown = b.authorHometownId === profile.hometownId;

          if (aSameHometown && !bSameHometown) return -1;
          if (!aSameHometown && bSameHometown) return 1;

          // 2. Both are same group (either both same village, or both different village, or both followed)
          // Sort by distance
          const profileLocation = locations.find(
            (l) => l.name === profile.currentLocation,
          );
          const readerCoords = profileLocation
            ? { lat: profileLocation.lat, lng: profileLocation.lng }
            : profile.coords;

          const aLocation = locations.find(
            (l) => l.name === a.authorCurrentLocation,
          );
          const aCoords = aLocation
            ? { lat: aLocation.lat, lng: aLocation.lng }
            : a.coords;

          const bLocation = locations.find(
            (l) => l.name === b.authorCurrentLocation,
          );
          const bCoords = bLocation
            ? { lat: bLocation.lat, lng: bLocation.lng }
            : b.coords;

          if (readerCoords && aCoords && bCoords) {
            const distA = calculateDistance(
              readerCoords.lat,
              readerCoords.lng,
              aCoords.lat,
              aCoords.lng,
            );
            const distB = calculateDistance(
              readerCoords.lat,
              readerCoords.lng,
              bCoords.lat,
              bCoords.lng,
            );
            // We use standard distance priority. A smaller distance comes first.
            if (Math.abs(distA - distB) > 0.001) {
              return distA - distB;
            }
          }

          // 3. Default: newest first
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        });
        setPosts(sorted);
        localStorage.setItem("feedPostsCache", JSON.stringify(sorted));
        localStorage.setItem("feedPostsCacheTime", Date.now().toString());
      } else {
        setPosts(fetchedPosts);
        localStorage.setItem("feedPostsCache", JSON.stringify(fetchedPosts));
        localStorage.setItem("feedPostsCacheTime", Date.now().toString());
      }
      setLoading(false);
    } catch (err: any) {
      // If fetching fails (e.g. quota exceeded), try fallback to cache even if old
      if (cachedData) {
        setPosts(JSON.parse(cachedData));
        setLoading(false);
      } else {
        setLoading(false);
      }

      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes("Quota") || errMsg.includes("quota")) {
        console.warn("Firestore Quota exceeded, using cache if available");
      } else {
        handleFirestoreError(err, OperationType.LIST, "posts");
      }
    }
  };

  useEffect(() => {
    loadPosts();
  }, [profile, followingIds]);

  const displayPosts = posts.filter((p) => {
    if (showViewed) {
      return viewedPostsLocal.has(p.id);
    } else {
      return !unviewedFilterSet.has(p.id);
    }
  });

  const feedItems = useMemo(() => {
    const items: ({ type: 'post', post: PostType } | { type: 'ad', id: string })[] = [];
    let adCounter = 0;

    displayPosts.forEach((post, index) => {
      items.push({ type: 'post', post });

      // Insert ad periodically based on settings
      const frequency = settings?.feedFrequency || 5;
      if (
        settings?.adMode !== 'off' &&
        (index + 1) % frequency === 0 &&
        index !== displayPosts.length - 1
      ) {
        items.push({ type: 'ad', id: `ad-${adCounter++}` });
      }
    });

    return items;
  }, [displayPosts, settings]);

  useEffect(() => {
    const currentItem = currentIndex > 0 ? feedItems[currentIndex - 1] : null;
    const currentPost = currentItem?.type === 'post' ? currentItem.post : null;

    if (currentPost && !viewedPostsLocal.has(currentPost.id)) {
      setViewedPostsLocal((prev) => {
        const next = new Set(prev);
        next.add(currentPost.id);

        // Ensure localStorage viewedPosts doesn't grow unbounded (>1000 IDs might be bad)
        // Convert to array and keep track. We can maintain order roughly by JS Set, but easier to just use an array.
        const list = Array.from(next);
        if (list.length > 500) list.splice(0, list.length - 500);
        localStorage.setItem("viewedPosts", JSON.stringify(list));

        return new Set(list);
      });
    }
  }, [currentIndex, feedItems, viewedPostsLocal]);

  if (loading)
    return (
      <div className="h-full flex items-center justify-center font-bold tracking-widest">
        {t.saving}
      </div>
    );

  const currentItem = currentIndex > 0 ? feedItems[currentIndex - 1] : null;
  const currentPostTop = currentItem?.type === 'post' ? currentItem.post : null;
  const isDarkForeground = currentPostTop?.mediaUrl || currentItem?.type === 'ad';

  return (
    <div className="h-full relative overflow-hidden">
      {/* Top shadow overlay as requested */}
      <div className={cn("absolute inset-x-0 top-0 h-16 bg-gradient-to-b z-[90] pointer-events-none transition-opacity duration-300", isDarkForeground ? "from-black/30 to-transparent" : "from-black/10 to-transparent", isHolding ? "opacity-0" : "opacity-100")} />
      
      <div className={cn("absolute top-4 end-4 z-[100] pointer-events-auto transition-opacity duration-300", isHolding ? "opacity-0 pointer-events-none" : "opacity-100")}>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setUnviewedFilterSet(new Set(viewedPostsLocal));
            setShowViewed(!showViewed);
            setCurrentIndex(0); // reset scroll index
            if (scrollRef.current) scrollRef.current.scrollTop = 0;
          }}
          className={cn("flex items-center gap-1.5 py-1.5 px-3 backdrop-blur-md rounded-full shadow-2xl border transition-colors", 
            isDarkForeground 
              ? "bg-white/10 border-white/30 text-white hover:bg-white/20 drop-shadow-[0_0_8px_rgba(0,0,0,0.5)]" 
              : "bg-theme-white/5 border-theme-white/10 text-theme-white hover:bg-theme-white/10"
          )}
        >
          {showViewed ? <Sparkles size={14} /> : <History size={14} />}
          <span className="text-[10px] font-bold drop-shadow-md whitespace-nowrap">
            {showViewed ? t.newPosts : t.viewedPosts}
          </span>
        </motion.button>
      </div>

      <div
        ref={scrollRef}
        className="h-full w-full snap-y snap-mandatory overflow-y-scroll scrollbar-hide"
        onScroll={(e) => {
          const index = Math.round(
            e.currentTarget.scrollTop / e.currentTarget.clientHeight,
          );
          setCurrentIndex(index);
        }}
      >
        {/* Onboarding Hero Section */}
        <div className="h-full w-full relative flex flex-col items-center justify-center p-8 text-center bg-[var(--theme-bg-body)] overflow-hidden snap-start snap-always">
          {/* Background activity indicators */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div
              animate={{ y: [0, -20, 0], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-20 left-10 w-16 h-16 rounded-full bg-theme-white/5 blur-xl"
            />
            <motion.div
              animate={{ y: [0, 30, 0], opacity: [0.2, 0.5, 0.2] }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1,
              }}
              className="absolute bottom-32 right-12 w-24 h-24 rounded-full bg-theme-white/5 blur-2xl"
            />
            {/* Floating small elements */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="absolute top-1/4 right-1/4 w-2 h-2 rounded-full bg-theme-white/20"
            />
            <motion.div
              animate={{ y: [0, 15, 0] }}
              transition={{ duration: 4, repeat: Infinity, delay: 0.5 }}
              className="absolute bottom-1/3 left-1/4 w-3 h-3 rounded-full bg-theme-white/10"
            />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="z-10 flex flex-col items-center max-w-sm"
          >
            <h1
              className="text-3xl font-black text-theme-white mb-4 leading-normal"
              dir="rtl"
            >
              كن أول شخص يشارك شيئًا اليوم في منطقتك
            </h1>
            <p
              className="text-sm text-theme-white/50 mb-12 leading-relaxed font-medium"
              dir="rtl"
            >
              شارك صوراً، تحديثات، أخبار محلية، زحمة السير، مناسبات، عروض، أو أي
              شيء يحدث بالقرب منك.
            </p>

            <motion.button
              onClick={onCreatePost}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative group flex items-center justify-center bg-theme-white text-theme-black rounded-full w-20 h-20 shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] transition-all"
            >
              <Plus size={40} strokeWidth={2.5} />
              <div className="absolute inset-0 rounded-full border border-theme-white/20 scale-150 animate-ping opacity-20" />
            </motion.button>

            <div className="mt-16 flex flex-col items-center text-theme-white/30 animate-pulse">
              <span className="text-[10px] uppercase tracking-widest font-bold mb-2">
                Swipe Up
              </span>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m18 15-6-6-6 6" />
              </svg>
            </div>
          </motion.div>
        </div>

        {feedItems.length > 0 ? (
          feedItems.map((item, index) => (
            <div key={item.type === 'post' ? item.post.id : item.id} className="h-full w-full snap-start snap-always">
              {item.type === 'post' ? (
                <PostCard
                  post={item.post}
                  onUserClick={onUserClick}
                  isActive={currentIndex === index + 1}
                />
              ) : (
                <div className="h-full w-full bg-zinc-950">
                  <AdUnit placement="feed" />
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="h-full w-full snap-start snap-always flex flex-col items-center justify-center text-zinc-500 p-8 text-center space-y-4">
            <p className="text-xl">{t.noPosts}</p>
          </div>
        )}
      </div>
    </div>
  );
}
