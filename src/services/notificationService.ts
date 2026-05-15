import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { UserProfile } from '../types';

export const sendNotification = async (
  recipientId: string,
  data: {
    senderId: string;
    senderName: string;
    type: 'like' | 'comment' | 'message' | 'follow' | 'system' | 'location_request' | 'popup';
    postId?: string;
    text?: string;
  }
) => {
  try {
    // 1. Get recipient profile to check preferences
    const recipientRef = doc(db, 'users', recipientId);
    const recipientSnap = await getDoc(recipientRef);
    
    if (recipientSnap.exists()) {
      const recipientProfile = recipientSnap.data() as UserProfile;
      const prefs = recipientProfile.notificationPreferences;
      
      // 2. Check if specific notification type is enabled
      // If prefs is missing, we default to enabled for all
      if (prefs) {
        if (data.type === 'like' && !prefs.likes) return;
        if (data.type === 'comment' && !prefs.comments) return;
        if (data.type === 'message' && !prefs.messages) return;
        if (data.type === 'follow' && !prefs.follows) return;
        if (data.type === 'system' && !prefs.system) return;
      }
    }

    // 3. Create the notification document
    await addDoc(collection(db, 'users', recipientId, 'notifications'), {
      ...data,
      recipientId,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to send notification:', error);
    // Don't throw for notifications as they shouldn't block the main action
  }
};
