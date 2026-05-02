import React, { useState } from "react";
import { Post } from "../types";
import { 
  Heart, MessageCircle, Share2, MoreHorizontal, 
  CheckCircle2, ChevronDown, ChevronUp 
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface PostCardProps {
  post: Post;
  currentUserId: string;
  onLike: (postId: string) => void;
  onComment: (postId: string, text: string) => void;
}

export function PostCard({ post, currentUserId, onLike, onComment }: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const isLiked = post.likes.includes(currentUserId);

  const isAdmin = post.created_by.identityType === "individual" && post.author?.role?.includes("admin");
  const isSociety = post.created_by.identityType === "society";
  
  const displayName = isSociety 
    ? `${post.society?.abbreviation || "IEEE"} Branch` 
    : post.created_by.displayName;

  const subtitle = isSociety
    ? `${post.society?.name || "IEEE Society"}`
    : `${post.author?.role?.replace("_", " ") || "Member"}`;

  return (
    <div className="glass-card p-0 border border-white/5 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
      {/* Post Header */}
      <div className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00629B] to-[#00bfff] p-0.5 shadow-lg shadow-blue-500/10">
            <div className="w-full h-full rounded-full bg-[#0a192f] flex items-center justify-center text-sm font-bold text-white uppercase">
              {displayName[0]}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white text-[15px]">{displayName}</span>
              {(isSociety || isAdmin) && (
                <CheckCircle2 className="w-4 h-4 text-blue-400 fill-blue-400/10" />
              )}
            </div>
            <p className="text-[11px] text-gray-500 font-medium">
              {subtitle} • {formatDistanceToNow(new Date(post.created_at))} ago
            </p>
          </div>
        </div>
        <button className="p-2 hover:bg-white/5 rounded-lg text-gray-500 transition-colors">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Collaboration Tag */}
      {post.collaborators.length > 0 && (
        <div className="px-5 pb-3">
          <p className="text-[11px] text-blue-400 font-semibold flex items-center gap-1.5 bg-blue-400/5 py-1 px-2.5 rounded-lg w-fit">
            <span className="text-gray-400">🤝 In collaboration with</span>
            {post.collaborators.join(", ")}
          </p>
        </div>
      )}

      {/* Post Content */}
      <div className="px-5 pb-5 space-y-3">
        {post.title && (
          <h3 className="text-lg font-bold text-white tracking-tight leading-tight">
            {post.title}
          </h3>
        )}
        <div className="relative">
          <p className="text-[14px] text-gray-300 leading-relaxed whitespace-pre-wrap">
            {post.description}
          </p>
        </div>
        
        <div className="inline-block px-3 py-1 bg-white/5 border border-white/5 rounded-full text-[10px] font-bold text-gray-400 tracking-wider uppercase">
          {post.category}
        </div>
      </div>

      {/* Post Media */}
      {post.media && post.media.length > 0 && (
        <div className="border-y border-white/5 bg-black/20 overflow-hidden">
          <img 
            src={post.media[0]} 
            alt="Post media" 
            className="w-full max-h-[450px] object-contain mx-auto" 
          />
        </div>
      )}

      {/* Post Actions Stats */}
      <div className="px-5 py-3 flex items-center justify-between text-xs text-gray-500 font-medium border-b border-white/5">
        <div className="flex items-center gap-1">
          <div className="flex -space-x-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-4 h-4 rounded-full bg-blue-500 border border-[#0a192f]" />
            ))}
          </div>
          <span className="ml-1">{post.likes.length} Likes</span>
        </div>
        <button 
          onClick={() => setShowComments(!showComments)}
          className="hover:underline"
        >
          {post.comment_count} Comments
        </button>
      </div>

      {/* Post Action Buttons */}
      <div className="px-2 py-1 flex items-center justify-between">
        <button 
          onClick={() => onLike(post.id)}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
            isLiked ? "text-red-400 bg-red-400/5" : "text-gray-400 hover:bg-white/5"
          }`}
        >
          <Heart className={`w-5 h-5 ${isLiked ? "fill-current" : ""}`} />
          Like
        </button>
        <button 
          onClick={() => setShowComments(!showComments)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold text-gray-400 hover:bg-white/5 transition-all"
        >
          <MessageCircle className="w-5 h-5" />
          Comment
        </button>
        <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold text-gray-400 hover:bg-white/5 transition-all">
          <Share2 className="w-5 h-5" />
          Share
        </button>
      </div>

      {/* Comment Section */}
      {showComments && (
        <div className="px-5 pb-5 pt-2 border-t border-white/5 space-y-4 bg-white/[0.02]">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-white/5 shrink-0 flex items-center justify-center text-[10px] font-bold text-gray-400 uppercase">
              U
            </div>
            <div className="flex-1 flex gap-2">
              <input 
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (onComment(post.id, commentText), setCommentText(""))}
                placeholder="Write a comment..." 
                className="flex-1 bg-white/5 border border-white/5 rounded-xl px-4 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 transition-all"
              />
              <button 
                onClick={() => { onComment(post.id, commentText); setCommentText(""); }}
                className="px-4 py-2 bg-[#00629B] hover:bg-blue-600 rounded-xl text-xs font-bold text-white transition-all shadow-lg shadow-blue-500/20"
              >
                Post
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
