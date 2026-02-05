
import { InvitationCode, UserStats } from '../types';

// Changed to relative path. This requires your web server (Nginx) to proxy /api to the backend,
// OR you must set this to your actual server IP/Domain if hosting separately.
// For production with Nginx: '/api'
const API_BASE = '/api';
const USER_ID_KEY = 'mini_app_user_uuid';

export const DAILY_LIMIT = 3;
export const POST_DAILY_LIMIT = 5;

// Helper to get or create a persistent User ID (simulating device ID)
const getUserId = (): string => {
  let uuid = localStorage.getItem(USER_ID_KEY);
  if (!uuid) {
    uuid = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, uuid);
  }
  return uuid;
};

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'X-User-ID': getUserId(),
});

export const storageService = {
  // Fetch all codes
  getCodes: async (): Promise<InvitationCode[]> => {
    try {
      const res = await fetch(`${API_BASE}/codes`, { headers: getHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      // Map backend response to frontend interface
      return data.map((item: any) => ({
        id: item.id,
        content: item.content,
        remainingUses: item.remainingUses,
        createdAt: item.createdAt,
        isOwnCode: item.isOwn,
        alreadyUsed: item.isUsed
      }));
    } catch (e) {
      console.error("Failed to fetch codes", e);
      return [];
    }
  },

  // Get user stats (today's counts)
  getUserStats: async (): Promise<UserStats> => {
    try {
      const res = await fetch(`${API_BASE}/user/stats`, { headers: getHeaders() });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return await res.json();
    } catch (e) {
      return { todayPostCount: 0, todayClaimCount: 0, postLimit: 5, claimLimit: 3 };
    }
  },

  saveCode: async (content: string): Promise<{ success: boolean; code?: InvitationCode; error?: string }> => {
    try {
      const id = crypto.randomUUID();
      const res = await fetch(`${API_BASE}/codes`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ id, content })
      });

      const data = await res.json();
      
      if (!res.ok) {
        return { success: false, error: data.detail || "发布失败" };
      }

      return { 
        success: true, 
        code: {
          id: data.id,
          content: data.content,
          remainingUses: data.remainingUses,
          createdAt: data.createdAt,
          isOwnCode: true,
          alreadyUsed: false
        }
      };
    } catch (e) {
      return { success: false, error: "网络错误，请重试" };
    }
  },

  useCode: async (id: string): Promise<{ success: boolean; code?: InvitationCode; error?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/codes/${id}/claim`, {
        method: 'POST',
        headers: getHeaders()
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.detail || "领取失败" };
      }

      // Return partial update
      return { 
        success: true, 
        code: {
          id: data.id,
          content: "", // Content not needed for update
          remainingUses: data.remainingUses,
          createdAt: 0,
          isOwnCode: false,
          alreadyUsed: true
        }
      };
    } catch (e) {
      return { success: false, error: "网络错误，请重试" };
    }
  }
};
