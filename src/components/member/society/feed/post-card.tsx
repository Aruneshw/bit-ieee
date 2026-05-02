import React, { useState } from "react";
import { Post } from "../types";
import { 
  Heart, MessageCircle, Share2, MoreHorizontal, 
  CheckCircle2, ChevronDown, ChevronUp, Trash2,
  ShieldCheck, Edit
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface PostCardProps {
  post: Post;
  currentUserId: string;
  currentUserRole?: string;
  onLike: (postId: string) => void;
  onComment: (postId: string, text: string) => void;
  onDelete: (postId: string) => void;
  onEdit: (postId: string, newTitle: string, newDesc: string) => void;
}

export function PostCard({ post, currentUserId, currentUserRole, onLike, onComment, onDelete, onEdit }: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ title: post.title || "", description: post.description });
  const [commentText, setCommentText] = useState("");
  const isLiked = post.likes.includes(currentUserId);

  const isAuthor = currentUserId === post.created_by.userId;
  const isUserAdmin = currentUserRole?.includes("admin");
  const canDelete = isAuthor || isUserAdmin;
  const canEdit = isUserAdmin; // As per request: admin can also edit

  const isAdmin = post.created_by.identityType === "individual" && post.author?.role?.includes("admin");
  const isSociety = post.created_by.identityType === "society";
  
  const displayName = isSociety 
    ? `${post.society?.abbreviation || "IEEE"} Branch` 
    : (post.created_by.displayName === "Unknown" ? "IEEE Member" : post.created_by.displayName);

  const subtitle = isSociety
    ? `${post.society?.name || "IEEE Society"}`
    : `${post.author?.role?.replace("_", " ") || "Member"}`;

  return (
    <div className="glass-card p-0 border border-white/5 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
      {/* Edit Modal Overlay */}
      {isEditing && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsEditing(false)} />
          <div className="relative glass-card w-full max-w-lg border border-white/10 shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-400" /> Edit Community Post
            </h3>
            <div className="space-y-4">
              <input 
                type="text"
                className="input-field"
                placeholder="Post Title (Optional)"
                value={editData.title}
                onChange={(e) => setEditData(p => ({ ...p, title: e.target.value }))}
              />
              <textarea 
                rows={5}
                className="input-field resize-none"
                placeholder="Description"
                value={editData.description}
                onChange={(e) => setEditData(p => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button onClick={() => setIsEditing(false)} className="btn-secondary px-6">Cancel</button>
              <button 
                onClick={() => {
                  onEdit(post.id, editData.title, editData.description);
                  setIsEditing(false);
                }} 
                className="btn-primary px-8"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

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
              <span className="font-bold text-gray-900 text-[15px]">{displayName}</span>
              {(isSociety || isAdmin) && (
                <CheckCircle2 className="w-4 h-4 text-blue-600 fill-blue-600/10" />
              )}
            </div>
            <p className="text-[11px] text-gray-600 font-medium">
              {subtitle} • {formatDistanceToNow(new Date(post.created_at))} ago
            </p>
          </div>
        </div>
        <div className="relative">
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
          
          {showMenu && canDelete && (
            <div className="absolute right-0 top-10 w-40 bg-white border border-gray-100 rounded-xl shadow-xl z-20 overflow-hidden animate-in zoom-in-95 duration-200">
              <button 
                onClick={() => {
                  if (confirm("Are you sure you want to delete this post permanently?")) {
                    onDelete(post.id);
                  }
                  setShowMenu(false);
                }}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Delete Post
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Collaboration Tag */}
      {post.collaborators.length > 0 && (
        <div className="px-5 pb-3">
          <p className="text-[11px] text-blue-700 font-semibold flex items-center gap-1.5 bg-blue-50 py-1 px-2.5 rounded-lg w-fit">
            <span className="text-gray-500">🤝 In collaboration with</span>
            {post.collaborators.join(", ")}
          </p>
        </div>
      )}

      {/* Post Content */}
      <div className="px-5 pb-5 space-y-3">
        {post.title && (
          <h3 className="text-lg font-bold text-black tracking-tight leading-tight">
            {post.title}
          </h3>
        )}
        <div className="relative">
          <p className="text-[14px] text-gray-800 leading-relaxed whitespace-pre-wrap">
            {post.description}
          </p>
        </div>
        
        <div className="inline-block px-3 py-1 bg-gray-100 border border-gray-200 rounded-full text-[10px] font-bold text-gray-600 tracking-wider uppercase">
          {post.category}
        </div>
      </div>

      {/* Post Media */}
      {post.media && post.media.length > 0 && (
        <div className="border-y border-gray-100 bg-gray-50 overflow-hidden">
          <img 
            src={post.media[0]} 
            alt="Post media" 
            className="w-full max-h-[450px] object-contain mx-auto" 
          />
        </div>
      )}

      {/* Post Actions Stats */}
      <div className="px-5 py-3 flex items-center justify-between text-xs text-gray-600 font-medium border-b border-gray-100">
        <div className="flex items-center gap-1">
          <div className="flex -space-x-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-4 h-4 rounded-full bg-blue-500 border border-white" />
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
            isLiked ? "text-red-600 bg-red-50" : "text-gray-700 hover:bg-gray-50"
          }`}
        >
          <Heart className={`w-5 h-5 ${isLiked ? "fill-current" : ""}`} />
          Like
        </button>
        <button 
          onClick={() => setShowComments(!showComments)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all"
        >
          <MessageCircle className="w-5 h-5" />
          Comment
        </button>
        <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all">
          <Share2 className="w-5 h-5" />
          Share
        </button>
      </div>

      {/* Comment Section */}
      {showComments && (
        <div className="px-5 pb-5 pt-4 border-t border-gray-100 space-y-4 bg-gray-50/50">
          {/* Existing Comments */}
          <div className="space-y-4">
            {(post as any).interactions?.filter((i: any) => i.type === "comment").map((comment: any) => (
              <div key={comment.id} className="flex gap-3 animate-in fade-in slide-in-from-top-1">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white uppercase shrink-0">
                  {comment.user?.name?.[0] || "U"}
                </div>
                <div className="flex-1 bg-white p-3 rounded-2xl border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-gray-900">{comment.user?.name || "Unknown Member"}</span>
                    <span className="text-[10px] text-gray-400 font-medium">just now</span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed font-medium">{comment.comment_text}</p>
                </div>
              </div>
            ))}
          </div>

          {/* New Comment Input */}
          <div className="flex gap-3 pt-2">
            <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0 flex items-center justify-center text-[10px] font-bold text-gray-500 uppercase">
              {displayName[0]}
            </div>
            <div className="flex-1 flex gap-2">
              <input 
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && commentText.trim()) {
                    onComment(post.id, commentText);
                    setCommentText("");
                  }
                }}
                placeholder="Write a comment..." 
                className="input-field"
              />
              <button 
                onClick={() => {
                  if (commentText.trim()) {
                    onComment(post.id, commentText);
                    setCommentText("");
                  }
                }}
                className="px-6 py-2 bg-[#00629B] hover:bg-blue-700 rounded-xl text-xs font-bold text-white transition-all shadow-lg shadow-blue-600/10"
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
