export interface NotificationPreferences {
  likes: boolean;
  comments: boolean;
  messages: boolean;
  follows: boolean;
  system: boolean;
}

export interface UserProfile {
  uid: string;
  name: string;
  photoURL?: string;
  hometown: string;
  currentLocation: string;
  hometownId: string;
  language?: "ar" | "en";
  themeMode?: "light" | "dark" | "system";
  coords?: {
    lat: number;
    lng: number;
  };
  gender?: "male" | "female" | "other";
  birthDate?: string;
  bio?: string;
  isAdmin?: boolean;
  isBanned?: boolean;
  blockedUsers?: string[];
  notificationPreferences?: NotificationPreferences;
  lastActive?: any;
  createdAt: any;
}

export interface Report {
  id: string;
  reporterId: string;
  reporterName: string;
  targetId: string;
  authorId: string;
  reason: string;
  type: "post";
  status: "pending" | "reviewed" | "dismissed";
  createdAt: any;
}

export interface AdminNotification {
  id: string;
  reportId: string;
  reporterName: string;
  type: "new_report";
  read: boolean;
  createdAt: any;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoURL?: string;
  authorHometown: string;
  authorCurrentLocation: string;
  authorHometownId: string;
  coords?: {
    lat: number;
    lng: number;
  };
  content: string;
  imageUrl?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  likesCount: number;
  commentsCount: number;
  createdAt: any;
  editedAt?: any;
  expiresAt: any;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: any;
}

export interface Follow {
  followerId: string;
  followedId: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: any;
}

export interface Conversation {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageAt: any;
  participantDetails?: Record<string, { name: string; photoURL?: string }>;
  unreadCount?: Record<string, number>;
}

export interface Notification {
  id: string;
  recipientId: string;
  senderId: string;
  senderName: string;
  type:
    | "like"
    | "comment"
    | "message"
    | "follow"
    | "system"
    | "location_request"
    | "popup";
  postId?: string;
  text?: string;
  read: boolean;
  createdAt: any;
}

export interface View {
  id: string;
  userId: string;
  userName: string;
  photoURL?: string;
  createdAt: any;
}

export interface AdSettings {
  adMode: "google" | "off";
  feedFrequency: number;
  searchFrequency: number;
  googleAdClient: string;
  googleFeedAdSlot: string;
  googleSearchAdSlot: string;
}

export interface AdCampaign {
  id: string;
  title: string;
  description: string;
  ctaText: string;
  imageUrl: string;
  linkUrl: string;
  budget: number;
  spent: number;
  status: "active" | "paused" | "completed";
  views: number;
  clicks: number;
  createdAt: any;
}
