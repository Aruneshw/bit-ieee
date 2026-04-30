"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { MessageCircle, Heart } from "lucide-react";

export default function MemberSocietyPage() {
  const supabase = createClient();
  const [posts, setPosts] = useState<any[]>([]);
  const [userId, setUserId] = useState("");
  const [societyId, setSocietyId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserId(user.id);
        const { data: profile } = await supabase.from("users").select("society_id").eq("email", user.email.toLowerCase()).single();
        const sid = profile?.society_id || "";
        setSocietyId(sid);
        fetchPosts(sid);
      }
      setLoading(false);
    }

    init();
  }, []);

  async function fetchPosts(sid: string) {
    let query = supabase
      .from("posts")
      .select("*, author:users(name), interactions:post_interactions(id, type, user_id, comment_text, user:users(name))");
    
    if (sid) {
      query = query.or(`society_id.eq.${sid},society_id.is.null`);
    } else {
      query = query.is("society_id", null);
    }

    const { data } = await query.order("created_at", { ascending: false });
    setPosts(data || []);
  }



  async function likePost(postId: string) {
    const post = posts.find(p => p.id === postId);
    const existing = post?.interactions?.find((i: any) => i.user_id === userId && i.type === "like");
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

  if (loading) return <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-32 glass-card animate-pulse" />)}</div>;

  return (
    <div className="space-y-6 animate-slide-up max-w-3xl mx-auto">
      <div>
        <h1 className="text-4xl font-heading tracking-wide mb-2">Society Feed</h1>
        <p className="text-gray-400">Updates from your Student Representative and Global Admin Announcements.</p>
      </div>


      {posts.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <MessageCircle className="w-12 h-12 mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400">No posts yet from your student rep.</p>
        </div>
      ) : posts.map(post => {
        const likes = post.interactions?.filter((i: any) => i.type === "like") || [];
        const comments = post.interactions?.filter((i: any) => i.type === "comment") || [];
        const isLiked = likes.some((l: any) => l.user_id === userId);

        return (
          <div key={post.id} className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00629B] to-[#00bfff] flex items-center justify-center text-white text-sm font-bold">
                {(post.author?.name || "?")?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-white">{post.author?.name}</p>
                <p className="text-xs text-gray-500">{new Date(post.created_at).toLocaleString()}</p>
              </div>
            </div>
            <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{post.content}</p>

            {/* Media */}
            {post.media_url && (
              <div className="rounded-lg overflow-hidden bg-black/30">
                {post.media_url.match(/\.(mp4|webm|ogg|mov)$/i) ? (
                  <video src={post.media_url} controls className="w-full max-h-[400px] object-contain" />
                ) : (
                  <img src={post.media_url} alt="Post media" className="w-full max-h-[400px] object-contain" />
                )}
              </div>
            )}

            <div className="flex items-center gap-4 pt-2 border-t border-white/5">
              <button onClick={() => likePost(post.id)} className={`flex items-center gap-1.5 text-sm ${isLiked ? "text-red-400" : "text-gray-500 hover:text-red-400"}`}>
                <Heart className={`w-4 h-4 ${isLiked ? "fill-current" : ""}`} /> {likes.length}
              </button>
              <span className="flex items-center gap-1.5 text-sm text-gray-500"><MessageCircle className="w-4 h-4" /> {comments.length}</span>
            </div>
            {comments.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-white/5">
                {comments.map((c: any) => (
                  <div key={c.id} className="flex gap-2 text-sm"><span className="font-medium text-[#00bfff]">{c.user?.name}:</span><span className="text-gray-400">{c.comment_text}</span></div>
                ))}
              </div>
            )}
            <CommentInput postId={post.id} onComment={addComment} />
          </div>
        );
      })}
    </div>
  );
}

function CommentInput({ postId, onComment }: { postId: string; onComment: (id: string, text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <div className="flex gap-2">
      <input value={text} onChange={e => setText(e.target.value)} placeholder="Add a comment..." className="input-field text-sm flex-1"
        onKeyDown={e => { if (e.key === "Enter") { onComment(postId, text); setText(""); } }} />
      <button onClick={() => { onComment(postId, text); setText(""); }} className="btn-secondary text-sm px-3">Send</button>
    </div>
  );
}
