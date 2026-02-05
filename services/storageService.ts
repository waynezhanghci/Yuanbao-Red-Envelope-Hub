
import { InvitationCode } from '../types';

const STORAGE_KEY = 'mini_invite_codes';

// 设定每日可复制上限 (根据规则图设定为 3)
export const DAILY_LIMIT = 3;
// 设定每日可发布上限 (根据规则图设定为 5)
export const POST_DAILY_LIMIT = 5;

// Helper to get today's date string for keying history
const getTodayKey = () => new Date().toISOString().split('T')[0];

// Helper to generate user-specific storage keys
const getUserKeys = (userId: string) => ({
  history: `user_${userId}_copy_history`,
  postHistory: `user_${userId}_post_history`,
  postedIds: `user_${userId}_posted_ids`
});

export const storageService = {
  // Get shared list of codes
  getCodes: (): InvitationCode[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  // Check how many codes a specific user has posted today
  getTodayPostCount: (userId: string): number => {
    const { postHistory } = getUserKeys(userId);
    const history = JSON.parse(localStorage.getItem(postHistory) || '{}');
    const today = getTodayKey();
    return (history[today] || 0);
  },

  // Check if the code was posted by the specific user
  isOwnCode: (id: string, userId: string): boolean => {
    const { postedIds } = getUserKeys(userId);
    const userPostedIds = JSON.parse(localStorage.getItem(postedIds) || '[]');
    return userPostedIds.includes(id);
  },

  saveCode: (content: string, userId: string): { success: boolean; code?: InvitationCode; error?: string } => {
    const today = getTodayKey();
    const postCount = storageService.getTodayPostCount(userId);

    if (postCount >= POST_DAILY_LIMIT) {
      return { success: false, error: `今日发布次数已达上限 (${POST_DAILY_LIMIT}次)` };
    }

    const codes = storageService.getCodes();
    
    // Create new code
    const newCode: InvitationCode = {
      id: crypto.randomUUID(),
      content,
      remainingUses: 10, 
      createdAt: Date.now(),
    };
    codes.push(newCode);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(codes));

    const { postHistory, postedIds } = getUserKeys(userId);

    // Update user post history (daily count)
    const history = JSON.parse(localStorage.getItem(postHistory) || '{}');
    history[today] = (history[today] || 0) + 1;
    localStorage.setItem(postHistory, JSON.stringify(history));

    // Update user posted IDs list
    const myPostedIds = JSON.parse(localStorage.getItem(postedIds) || '[]');
    myPostedIds.push(newCode.id);
    localStorage.setItem(postedIds, JSON.stringify(myPostedIds));

    return { success: true, code: newCode };
  },

  // Check if specific user has reached the daily limit
  getTodayCopyCount: (userId: string): number => {
    const { history: historyKey } = getUserKeys(userId);
    const history = JSON.parse(localStorage.getItem(historyKey) || '{}');
    const today = getTodayKey();
    return (history[today] || []).length;
  },

  // Check if specific user has already copied a specific code
  hasUserCopiedCode: (codeId: string, userId: string): boolean => {
    const { history: historyKey } = getUserKeys(userId);
    const history = JSON.parse(localStorage.getItem(historyKey) || '{}');
    return Object.values(history).some((ids: any) => ids.includes(codeId));
  },

  useCode: (id: string, userId: string): { success: boolean; code?: InvitationCode; error?: string } => {
    const today = getTodayKey();
    const { history: historyKey } = getUserKeys(userId);
    
    const history = JSON.parse(localStorage.getItem(historyKey) || '{}');
    const todayList = history[today] || [];

    // 1. Check if it is own code
    if (storageService.isOwnCode(id, userId)) {
      return { success: false, error: '不能领取自己发布的邀请码' };
    }

    // 2. Check daily limit
    if (todayList.length >= DAILY_LIMIT) {
      return { success: false, error: `今日复制次数已达上限 (${DAILY_LIMIT}次)` };
    }

    // 3. Check if already copied this specific code
    if (storageService.hasUserCopiedCode(id, userId)) {
      return { success: false, error: '您已经领取过该邀请码' };
    }

    const codes = storageService.getCodes();
    const index = codes.findIndex((c) => c.id === id);

    if (index !== -1 && codes[index].remainingUses > 0) {
      // 4. Update remaining uses (Shared data)
      codes[index].remainingUses -= 1;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(codes));

      // 5. Record in user history (Private data)
      if (!history[today]) history[today] = [];
      history[today].push(id);
      localStorage.setItem(historyKey, JSON.stringify(history));

      return { success: true, code: codes[index] };
    }

    return { success: false, error: '该邀请码已失效' };
  }
};
