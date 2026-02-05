
export interface InvitationCode {
  id: string;
  content: string;
  remainingUses: number;
  createdAt: number;
  // UI Helper fields populated by backend/frontend logic
  isOwnCode?: boolean; 
  alreadyUsed?: boolean; 
}

export interface UserStats {
  todayPostCount: number;
  todayClaimCount: number;
  postLimit: number;
  claimLimit: number;
}
