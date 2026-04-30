"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { Send, Heart, MessageCircle, Image, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function RepPostsPage() {
  const supabase = createClient();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState("");
  const [posting, setPosting] = useState(false);
  const [userId, setUserId] = useState("");
  const [societyId, setSocietyId] = useState("");

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserId(user.id);
        const { data: profile } = await supabase.from("users").select("society_id").eq("email", user.email.toLowerCase()).single();
        if (profile?.society_id) {
          setSocietyId(profile.society_id);
          fetchPosts(profile.society_id);
        }
      }
    }
    init();
  }, []);

  async function fetchPosts(sid: string) {
    const { data } = await supabase
      .from("posts")
      .select("*, author:users(name, email, avatar_url), interactions:post_interactions(id, type, user_id, comment_text, user:users(name))")
      .eq("society_id", sid)
      .order("created_at", { ascending: false });
    setPosts(data || []);
    setLoading(false);
  }

  async function createPost(e: React.FormEvent) {
    e.preventDefault();
    if (!newPost.trim()) return;
    setPosting(true);

    const { error } = await supabase.from("posts").insert({
      society_id: societyId,
      author_id: userId,
      content: newPost,
    });

    if (error) { toast.error(error.message); } else {
      toast.success("Post published!");
      setNewPost("");
      fetchPosts(societyId);
    }
    setPosting(false);
  }

  async function likePost(postId: string) {
    const existing = posts.find(p => p.id === postId)?.interactions?.find(
      (i: any) => i.user_id === userId && i.type === "like"
    );

    if (existing) {
      await supabase.from("post_interactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("post_interactions").insert({ post_id: postId, user_id: userId, type: "like" });
    }
    fetchPosts(societyId);
  }

  async function addComment(postId: string, text: string) {
    if (!text.trim()) return;
    await supabase.from("post_interactions").insert({ post_id: postId, user_id: userId, type: "comment", comment_text: text });
    fetchPosts(societyId);
  }

  return (
    <div className="space-y-6 animate-slide-up max-w-3xl">
      <div>
        <h1 className="text-4xl font-heading tracking-wide mb-2">Society Posts</h1>
        <p className="text-gray-400">Share updates with your society's leadership and members.</p>
      </div>

      {/* New Post */}
      <form onSubmit={createPost} className="glass-card p-5">
        <textarea
          value={newPost}
          onChange={e => setNewPost(e.target.value)}
          rows={3}
          placeholder="Share an update with your society..."
          className="input-field resize-none mb-3"
        />
        <div className="flex justify-end">
          <button type="submit" disabled={posting || !newPost.trim()} className="btn-primary flex items-center gap-2 text-sm">
            <Send className="w-4 h-4" /> {posting ? "Posting..." : "Publish"}
          </button>
        </div>
      </form>

      {/* Posts Feed */}
      {loading ? (
        [...Array(3)].map((_, i) => <div key={i} className="h-32 glass-card animate-pulse" />)
      ) : posts.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <MessageCircle className="w-12 h-12 mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400">No posts yet. Be the first to share!</p>
        </div>
      ) : (
        posts.map(post => (
          <PostCard
            key={post.id}
            post={post}
            userId={userId}
            onLike={() => likePost(post.id)}
            onComment={(text: string) => addComment(post.id, text)}
          />
        ))
      )}
    </div>
  );
}

function PostCard({ post, userId, onLike, onComment }: any) {
  const [commentText, setCommentText] = useState("");
  const [showComments, setShowComments] = useState(false);

  const likes = post.interactions?.filter((i: any) => i.type === "like") || [];
  const comments = post.interactions?.filter((i: any) => i.type === "comment") || [];
  const isLiked = likes.some((l: any) => l.user_id === userId);

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00629B] to-[#00bfff] flex items-center justify-center text-white text-sm font-bold">
          {(post.author?.name || "?")?.[0]?.toUpperCase()}
        </div>
        <div>
          <p className="font-medium text-white">{post.author?.name || post.author?.email}</p>
          <p className="text-xs text-gray-500">{new Date(post.created_at).toLocaleString()}</p>
        </div>
      </div>

      <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{post.content}</p>

      <div className="flex items-center gap-4 pt-2 border-t border-white/5">
        <button onClick={onLike} className={`flex items-center gap-1.5 text-sm transition-colors ${isLiked ? "text-red-400" : "text-gray-500 hover:text-red-400"}`}>
          <Heart className={`w-4 h-4 ${isLiked ? "fill-current" : ""}`} /> {likes.length}
        </button>
        <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#00bfff]">
          <MessageCircle className="w-4 h-4" /> {comments.length}
        </button>
      </div>

      {showComments && (
        <div className="space-y-3 pt-2">
          {comments.map((c: any) => (
            <div key={c.id} className="flex gap-2 text-sm">
              <span className="font-medium text-[#00bfff]">{c.user?.name || "User"}:</span>
              <span className="text-gray-400">{c.comment_text}</span>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              className="input-field text-sm flex-1"
              onKeyDown={e => { if (e.key === "Enter") { onComment(commentText); setCommentText(""); } }}
            />
            <button onClick={() => { onComment(commentText); setCommentText(""); }} className="btn-secondary text-sm px-3">Send</button>
          </div>
        </div>
      )}
    </div>
  );
}
