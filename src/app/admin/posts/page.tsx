"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { Trash2, MessageSquare, Clock, User, Globe, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export default function AdminManagePostsPage() {
  const supabase = createClient();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchAllPosts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("posts")
      .select("*, author:users(name, email), society:societies(abbreviation, name)")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load posts");
    } else {
      setPosts(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchAllPosts();
  }, []);

  async function deletePost(postId: string) {
    const ok = window.confirm("Are you sure you want to delete this post? This will also remove all likes and comments. This action cannot be undone.");
    if (!ok) return;

    try {
      const { error } = await supabase.from("posts").delete().eq("id", postId);
      if (error) throw error;

      toast.success("Post deleted successfully");
      setPosts(posts.filter(p => p.id !== postId));
    } catch (err: any) {
      toast.error(err.message || "Failed to delete post");
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="h-10 w-64 bg-white/5 rounded-lg animate-pulse mb-8" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-40 glass-card animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-heading tracking-wide mb-2 text-white">Manage Posts</h1>
          <p className="text-gray-400">Monitor and moderate all announcements and society updates.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
          <MessageSquare className="w-4 h-4 text-[#00bfff]" />
          <span className="text-sm font-bold text-white">{posts.length} Total Posts</span>
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <MessageSquare className="w-16 h-16 mx-auto text-gray-700 mb-4" />
          <h3 className="text-xl font-medium text-gray-400">No Posts Found</h3>
          <p className="text-sm text-gray-500 mt-2">There are currently no active posts in the hub.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {posts.map((post) => (
            <div key={post.id} className="glass-card p-6 group hover:border-red-500/30 transition-all duration-300">
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="flex-1 space-y-4">
                  {/* Badge & Metadata */}
                  <div className="flex flex-wrap items-center gap-3">
                    {post.society ? (
                      <span className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-[#00629B]/20 text-[#00bfff] border border-[#00629B]/30 uppercase tracking-widest">
                        {post.society.abbreviation || post.society.name}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 uppercase tracking-widest flex items-center gap-1.5">
                        <Globe className="w-3 h-3" /> Global Announcement
                      </span>
                    )}
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Clock className="w-3.5 h-3.5" /> {new Date(post.created_at).toLocaleString()}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="space-y-2">
                    <p className="text-gray-200 leading-relaxed whitespace-pre-wrap line-clamp-3 group-hover:line-clamp-none transition-all duration-300">
                      {post.content}
                    </p>
                    {post.media_url && (
                      <p className="text-[10px] text-[#00bfff] truncate flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" /> Media Attached: {post.media_url}
                      </p>
                    )}
                  </div>

                  {/* Author */}
                  <div className="flex items-center gap-2 pt-2 text-sm text-gray-500 border-t border-white/5">
                    <User className="w-3.5 h-3.5" />
                    <span className="font-medium text-gray-400">{post.author?.name || post.author?.email || "Unknown Author"}</span>
                    <span className="text-[10px] opacity-50">• {post.author?.email}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex md:flex-col items-center justify-end gap-2 shrink-0">
                  <button
                    onClick={() => deletePost(post.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500 hover:text-white transition-all duration-300 font-semibold text-sm"
                  >
                    <Trash2 className="w-4 h-4" /> Delete Post
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
