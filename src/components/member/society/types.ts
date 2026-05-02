export type PostCategory = "event" | "announcement" | "achievement" | "general";
export type PostStatus = "approved" | "pending" | "rejected";
export type FlagReason = "none" | "abusive" | "spam" | "hate_speech" | "irrelevant" | "harassment";

export interface Post {
  id: string;
  title: string | null;
  description: string;
  category: PostCategory;
  media: string[];
  created_by: {
    userId: string;
    displayName: string;
    identityType: "individual" | "society";
    societyId: string | null;
  };
  collaborators: string[];
  status: PostStatus;
  moderation_flag: boolean;
  flag_reason: FlagReason;
  likes: string[];
  saves: string[];
  comment_count: number;
  created_at: string;
  updated_at: string;
  // Joins
  author?: {
    name: string;
    role: string;
  };
  society?: {
    abbreviation: string;
    name: string;
  };
}

export interface Comment {
  id: string;
  post_id: string;
  text: string;
  created_by: {
    userId: string;
    displayName: string;
  };
  status: PostStatus;
  moderation_flag: boolean;
  flag_reason: string;
  created_at: string;
}
