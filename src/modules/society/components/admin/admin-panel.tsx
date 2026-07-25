import React, { useState } from "react";
import { 
  ShieldCheck, AlertTriangle, CheckCircle, XCircle, 
  Trash2, Filter, Search, Calendar, Info
} from "lucide-react";
import { Post } from "../types";

interface AdminPanelProps {
  posts: Post[];
  onAction: (postId: string, action: "approve" | "reject" | "delete") => void;
  onEdit: (postId: string, newTitle: string, newDesc: string) => void;
}

export function AdminPanel({ posts, onAction, onEdit }: AdminPanelProps) {
  const [filter, setFilter] = useState<"all" | "pending" | "flagged" | "reported">("all");
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editData, setEditData] = useState({ title: "", description: "" });

  const filteredPosts = posts.filter(p => {
    if (filter === "all") return true;
    if (filter === "pending") return p.status === "pending";
    if (filter === "flagged") return p.moderation_flag;
    if (filter === "reported") return false; // Mock for now
    return true;
  });

  const handleEditClick = (post: Post) => {
    setEditingPost(post);
    setEditData({ title: post.title || "", description: post.description });
  };

  const handleSaveEdit = () => {
    if (editingPost) {
      onEdit(editingPost.id, editData.title, editData.description);
      setEditingPost(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-blue-400" />
            Moderation Dashboard
          </h2>
          <p className="text-sm text-gray-500 mt-1">Review and manage community content</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/5">
          {(["pending", "flagged", "reported", "all"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-xs font-bold capitalize transition-all ${
                filter === f 
                ? "bg-[#00629B] text-white shadow-lg" 
                : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredPosts.length === 0 ? (
          <div className="glass-card p-12 text-center border border-dashed border-white/10">
            <CheckCircle className="w-12 h-12 mx-auto text-gray-700 mb-4" />
            <p className="text-gray-500 font-medium">All clear! No pending items to review.</p>
          </div>
        ) : (
          filteredPosts.map(post => (
            <div key={post.id} className="glass-card p-6 border border-white/5 space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 font-bold uppercase">
                    {post.created_by.displayName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{post.created_by.displayName}</p>
                    <p className="text-xs text-gray-500">
                      {post.created_by.identityType} • {new Date(post.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                {post.moderation_flag && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-[10px] font-bold text-red-400 uppercase tracking-widest">
                    <AlertTriangle className="w-3 h-3" /> Flagged: {post.flag_reason}
                  </div>
                )}
              </div>

              <div className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-2">
                {post.title && <h4 className="font-bold text-white">{post.title}</h4>}
                <p className="text-sm text-gray-400 leading-relaxed">{post.description}</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
                <button 
                  onClick={() => handleEditClick(post)}
                  className="px-4 py-2 bg-white/5 hover:bg-blue-500/10 text-gray-500 hover:text-blue-400 rounded-lg text-xs font-bold transition-all flex items-center gap-2"
                >
                  <Filter className="w-4 h-4" /> Edit
                </button>
                <button 
                  onClick={() => onAction(post.id, "reject")}
                  className="px-4 py-2 bg-white/5 hover:bg-red-500/10 text-gray-500 hover:text-red-400 rounded-lg text-xs font-bold transition-all flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
                <button 
                  onClick={() => onAction(post.id, "delete")}
                  className="px-4 py-2 bg-white/5 hover:bg-orange-500/10 text-gray-500 hover:text-orange-400 rounded-lg text-xs font-bold transition-all flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
                <button 
                  onClick={() => onAction(post.id, "approve")}
                  className="px-6 py-2 bg-[#00629B] hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" /> Approve
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Modal */}
      {editingPost && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingPost(null)} />
          <div className="relative glass-card w-full max-w-lg border border-white/10 shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-400" /> Edit Post Before Approval
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
              <button onClick={() => setEditingPost(null)} className="btn-secondary px-6">Cancel</button>
              <button 
                onClick={handleSaveEdit} 
                className="btn-primary px-8"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
