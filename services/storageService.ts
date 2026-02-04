
import { InvitationCode } from '../types';

const STORAGE_KEY = 'mini_invite_codes';
const USER_HISTORY_KEY = 'user_copy_history';
const USER_POST_HISTORY_KEY = 'user_post_history';
const USER_POSTED_IDS_KEY = 'user_posted_ids';

// 设定每日可复制上限 (根据规则图设定为 3)
export const DAILY_LIMIT = 3;
// 设定每日可发布上限
export const POST_DAILY_LIMIT = 5;

// Helper to get today's date string for keying history
const getTodayKey = () => new Date().toISOString().split('T')[0];

export const storageService = {
  getCodes: (): InvitationCode[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  // Check how many codes the user has posted today
  getTodayPostCount: (): number => {
    const history = JSON.parse(localStorage.getItem(USER_POST_HISTORY_KEY) || '{}');
    const today = getTodayKey();
    return (history[today] || 0);
  },

  // Check if the code was posted by the current user
  isOwnCode: (id: string): boolean => {
    const postedIds = JSON.parse(localStorage.getItem(USER_POSTED_IDS_KEY) || '[]');
    return postedIds.includes(id);
  },

  saveCode: (content: string): { success: boolean; code?: InvitationCode; error?: string } => {
    const today = getTodayKey();
    const postCount = storageService.getTodayPostCount();

    if (postCount >= POST_DAILY_LIMIT) {
      return { success: false, error: `今日发布次数已达上限 (${POST_DAILY_LIMIT}次)` };
    }

    const codes = storageService.getCodes();
    const newCode: InvitationCode = {
      id: crypto.randomUUID(),
      content,
      remainingUses: 3,
      createdAt: Date.now(),
    };
    codes.push(newCode);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(codes));

    // Update post history (daily count)
    const history = JSON.parse(localStorage.getItem(USER_POST_HISTORY_KEY) || '{}');
    history[today] = (history[today] || 0) + 1;
    localStorage.setItem(USER_POST_HISTORY_KEY, JSON.stringify(history));

    // Update posted IDs list
    const postedIds = JSON.parse(localStorage.getItem(USER_POSTED_IDS_KEY) || '[]');
    postedIds.push(newCode.id);
    localStorage.setItem(USER_POSTED_IDS_KEY, JSON.stringify(postedIds));

    return { success: true, code: newCode };
  },

  // Check if user has reached the daily limit
  getTodayCopyCount: (): number => {
    const history = JSON.parse(localStorage.getItem(USER_HISTORY_KEY) || '{}');
    const today = getTodayKey();
    return (history[today] || []).length;
  },

  // Check if user has already copied a specific code
  hasUserCopiedCode: (codeId: string): boolean => {
    const history = JSON.parse(localStorage.getItem(USER_HISTORY_KEY) || '{}');
    return Object.values(history).some((ids: any) => ids.includes(codeId));
  },

  useCode: (id: string): { success: boolean; code?: InvitationCode; error?: string } => {
    const today = getTodayKey();
    const history = JSON.parse(localStorage.getItem(USER_HISTORY_KEY) || '{}');
    const todayList = history[today] || [];

    // 1. Check if it is own code
    if (storageService.isOwnCode(id)) {
      return { success: false, error: '不能领取自己发布的邀请码' };
    }

    // 2. Check daily limit
    if (todayList.length >= DAILY_LIMIT) {
      return { success: false, error: `今日复制次数已达上限 (${DAILY_LIMIT}次)` };
    }

    // 3. Check if already copied this specific code
    if (storageService.hasUserCopiedCode(id)) {
      return { success: false, error: '您已经领取过该邀请码' };
    }

    const codes = storageService.getCodes();
    const index = codes.findIndex((c) => c.id === id);

    if (index !== -1 && codes[index].remainingUses > 0) {
      // 4. Update remaining uses
      codes[index].remainingUses -= 1;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(codes));

      // 5. Record in user history
      if (!history[today]) history[today] = [];
      history[today].push(id);
      localStorage.setItem(USER_HISTORY_KEY, JSON.stringify(history));

      return { success: true, code: codes[index] };
    }

    return { success: false, error: '该邀请码已失效' };
  }
};
