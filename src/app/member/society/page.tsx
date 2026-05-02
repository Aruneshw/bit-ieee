"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { 
  MessageCircle, Heart, Share2, MoreHorizontal, CheckCircle2, 
  TrendingUp, Users, Calendar, Image as ImageIcon 
} from "lucide-react";
import { toast } from "sonner";

const TRENDING_TAGS = ["MachineLearning", "IEEEXtreme", "Workshop", "Python", "Networking"];

export default function MemberSocietyPage() {
  const supabase = createClient();
  const [posts, setPosts] = useState<any[]>([]);
  const [societies, setSocieties] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [selectedSocietyId, setSelectedSocietyId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    async function init() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const { data: userData } = await supabase
          .from("users")
          .select("*, society:societies(*)")
          .eq("email", user.email.toLowerCase())
          .single();
        setProfile(userData);
      }

      const { data: societiesData } = await supabase
        .from("societies")
        .select("*")
        .order("name", { ascending: true });
      setSocieties(societiesData || []);
      
      await fetchPosts("all");
      setLoading(false);
    }

    init();
  }, []);

  async function fetchPosts(sid: string) {
    let query = supabase
      .from("posts")
      .select("*, author:users(name, role, department), society:societies(name, abbreviation), interactions:post_interactions(id, type, user_id, comment_text, user:users(name))");
    
    if (sid !== "all") {
      query = query.eq("society_id", sid);
    }

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) {
      console.error("Error fetching posts:", error);
      return;
    }
    setPosts(data || []);
  }

  const handleSocietySelect = (id: string) => {
    setSelectedSocietyId(id);
    fetchPosts(id);
  };

  async function handleLike(postId: string) {
    if (!profile) return;
    const post = posts.find(p => p.id === postId);
    const existing = post?.interactions?.find((i: any) => i.user_id === profile.id && i.type === "like");
    
    if (existing) {
      await supabase.from("post_interactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("post_interactions").insert({ post_id: postId, user_id: profile.id, type: "like" });
    }
    fetchPosts(selectedSocietyId);
  }

  async function handleComment(postId: string) {
    const text = commentText[postId];
    if (!text?.trim() || !profile) return;

    const { error } = await supabase.from("post_interactions").insert({ 
      post_id: postId, 
      user_id: profile.id, 
      type: "comment", 
      comment_text: text 
    });

    if (error) {
      toast.error("Failed to add comment");
      return;
    }

    setCommentText(prev => ({ ...prev, [postId]: "" }));
    fetchPosts(selectedSocietyId);
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-pulse">
        <div className="lg:col-span-3 space-y-4">
          <div className="h-48 bg-white/5 rounded-2xl" />
          <div className="h-96 bg-white/5 rounded-2xl" />
        </div>
        <div className="lg:col-span-6 space-y-6">
          <div className="h-24 bg-white/5 rounded-2xl" />
          {[...Array(3)].map((_, i) => <div key={i} className="h-64 bg-white/5 rounded-2xl" />)}
        </div>
        <div className="lg:col-span-3 space-y-4">
          <div className="h-64 bg-white/5 rounded-2xl" />
          <div className="h-64 bg-white/5 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-slide-up pb-12">
      
      {/* LEFT SIDEBAR */}
      <div className="lg:col-span-3 space-y-6">
        {/* User Card */}
        <div className="glass-card p-6 border border-white/5">
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#00629B] to-[#00bfff] p-1 mb-4 shadow-xl shadow-blue-500/20">
              <div className="w-full h-full rounded-full bg-[#0a192f] flex items-center justify-center text-2xl font-bold text-white">
                {profile?.name?.[0]?.toUpperCase() || "U"}
              </div>
            </div>
            <h3 className="text-xl font-bold text-white">{profile?.name}</h3>
            <p className="text-sm text-gray-400 mt-1 capitalize">{profile?.role?.replace("_", " ") || "Member"}</p>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-[10px] font-bold rounded-full border border-blue-500/20">IEEE Member</span>
              {profile?.society && (
                <span className="px-3 py-1 bg-purple-500/10 text-purple-400 text-[10px] font-bold rounded-full border border-purple-500/20">IEEE {profile.society.abbreviation}</span>
              )}
            </div>
          </div>
        </div>

        {/* Societies List */}
        <div className="glass-card overflow-hidden border border-white/5">
          <div className="p-4 border-b border-white/5">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Societies</h4>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            <button
              onClick={() => handleSocietySelect("all")}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all ${
                selectedSocietyId === "all" 
                  ? "bg-[#00629B] text-white" 
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              All
            </button>
            {societies.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSocietySelect(s.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all ${
                  selectedSocietyId === s.id 
                    ? "bg-[#00629B] text-white" 
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {s.abbreviation}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CENTER FEED */}
      <div className="lg:col-span-6 space-y-6">
        {/* Create Post Placeholder */}
        <div className="glass-card p-4 border border-white/5">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-white/5 shrink-0" />
            <div className="flex-1 bg-white/5 rounded-full px-4 flex items-center text-sm text-gray-400 border border-white/5">
              What's happening in your IEEE chapter?
            </div>
            <div className="p-2 hover:bg-white/5 rounded-lg transition-colors cursor-pointer text-gray-400">
              <ImageIcon className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Posts */}
        {posts.length === 0 ? (
          <div className="glass-card p-12 text-center border border-white/5">
            <MessageCircle className="w-12 h-12 mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400 font-medium">No announcements yet for this society.</p>
            <p className="text-xs text-gray-500 mt-2">Check back soon for updates from your leaders.</p>
          </div>
        ) : (
          posts.map((post) => (
            <PostCard 
              key={post.id} 
              post={post} 
              userId={profile?.id}
              onLike={() => handleLike(post.id)}
              commentValue={commentText[post.id] || ""}
              onCommentChange={(val) => setCommentText(prev => ({ ...prev, [post.id]: val }))}
              onCommentSubmit={() => handleComment(post.id)}
            />
          ))
        )}
      </div>

      {/* RIGHT SIDEBAR */}
      <div className="lg:col-span-3 space-y-6">
        {/* Trending Tags */}
        <div className="glass-card p-6 border border-white/5">
          <div className="flex items-center gap-2 mb-4 text-blue-400">
            <TrendingUp className="w-4 h-4" />
            <h4 className="text-xs font-bold uppercase tracking-widest">Trending Tags</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {TRENDING_TAGS.map(tag => (
              <span key={tag} className="text-xs text-gray-400 hover:text-blue-400 cursor-pointer transition-colors font-medium">
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* Active Societies */}
        <div className="glass-card p-6 border border-white/5">
          <div className="flex items-center gap-2 mb-4 text-green-400">
            <Users className="w-4 h-4" />
            <h4 className="text-xs font-bold uppercase tracking-widest">Active Societies</h4>
          </div>
          <div className="space-y-4">
            {[
              { name: "Computer Society", posts: "12 posts", color: "text-blue-400" },
              { name: "WIE", posts: "11 posts", color: "text-purple-400" },
              { name: "Robotics", posts: "10 posts", color: "text-orange-400" },
            ].map(s => (
              <div key={s.name} className="flex items-center justify-between">
                <span className="text-sm text-gray-300 font-medium">{s.name}</span>
                <span className={`text-[10px] font-bold ${s.color}`}>{s.posts}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Community Stats */}
        <div className="glass-card p-6 border border-white/5 bg-gradient-to-br from-[#00629B]/10 to-transparent">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Community Stats</h4>
          <div className="space-y-4">
            <StatItem icon={<Users className="w-4 h-4 text-blue-400" />} label="342 Members" />
            <StatItem icon={<MessageCircle className="w-4 h-4 text-purple-400" />} label="2 Posts This Month" />
            <StatItem icon={<Calendar className="w-4 h-4 text-orange-400" />} label="12 Active Societies" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PostCard({ post, userId, onLike, commentValue, onCommentChange, onCommentSubmit }: any) {
  const likes = post.interactions?.filter((i: any) => i.type === "like") || [];
  const comments = post.interactions?.filter((i: any) => i.type === "comment") || [];
  const isLiked = likes.some((l: any) => l.user_id === userId);

  const isAdmin = post.author?.role?.includes("admin");
  const authorName = isAdmin ? "IEEE Hub Admin" : `${post.society?.abbreviation || "IEEE"} Branch`;
  const authorSubtitle = isAdmin ? "Global Admin" : `${post.society?.abbreviation || post.author?.department || "IEEE"} • ${new Date(post.created_at).toLocaleDateString()}`;

  // Check if content has a title (e.g., bracketed first line)
  const lines = post.content.split('\n');
  const hasTitle = lines[0].startsWith('[') && lines[0].endsWith(']');
  const title = hasTitle ? lines[0].slice(1, -1) : "";
  const body = hasTitle ? lines.slice(1).join('\n') : post.content;

  return (
    <div className="glass-card p-5 border border-white/5 hover:border-white/10 transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00629B] to-[#00bfff] p-0.5">
            <div className="w-full h-full rounded-full bg-[#0a192f] flex items-center justify-center text-sm font-bold text-white uppercase">
              {isAdmin ? "A" : (post.society?.abbreviation?.[0] || "?")}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white text-sm">{authorName}</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 fill-blue-400/10" />
            </div>
            <p className="text-[10px] text-gray-500 font-medium mt-0.5">{authorSubtitle}</p>
          </div>
        </div>
        <button className="p-2 hover:bg-white/5 rounded-lg text-gray-500 transition-colors">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-3">
        {title && <h3 className="text-sm font-bold text-white uppercase tracking-wide">{title}</h3>}
        <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">{body.trim()}</p>
        
        <div className="inline-block px-2 py-1 bg-blue-500/5 border border-blue-500/10 rounded text-[9px] font-bold text-blue-400 tracking-widest uppercase">
          Announcements
        </div>
      </div>

      {post.media_url && (
        <div className="mt-4 rounded-xl overflow-hidden bg-black/20 border border-white/5">
          {post.media_url.match(/\.(mp4|webm|ogg|mov)$/i) ? (
            <video src={post.media_url} controls className="w-full max-h-[500px] object-contain" />
          ) : (
            <img src={post.media_url} alt="Post media" className="w-full max-h-[500px] object-contain" />
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5">
        <div className="flex items-center gap-6">
          <button 
            onClick={onLike}
            className={`flex items-center gap-2 text-xs font-semibold transition-colors ${isLiked ? "text-red-400" : "text-gray-400 hover:text-red-400"}`}
          >
            <Heart className={`w-4 h-4 ${isLiked ? "fill-current" : ""}`} />
            Like
          </button>
          <button className="flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-blue-400 transition-colors">
            <MessageCircle className="w-4 h-4" />
            Comment
          </button>
          <button className="flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-green-400 transition-colors">
            <Share2 className="w-4 h-4" />
            Share
          </button>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-gray-500 font-medium">
          <span>{likes.length} Likes</span>
          <span className="w-1 h-1 rounded-full bg-gray-600" />
          <span>{comments.length} Comments</span>
        </div>
      </div>

      {/* Comments List */}
      {comments.length > 0 && (
        <div className="mt-4 space-y-3 pt-4 border-t border-white/5">
          {comments.map((c: any) => (
            <div key={c.id} className="flex gap-3 animate-in fade-in slide-in-from-left-2">
              <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold text-gray-400 uppercase shrink-0">
                {c.user?.name?.[0]}
              </div>
              <div className="flex-1 bg-white/5 rounded-xl p-3 text-xs">
                <p className="font-bold text-blue-400 mb-1">{c.user?.name}</p>
                <p className="text-gray-400">{c.comment_text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comment Input */}
      <div className="mt-4 flex gap-2">
        <div className="w-8 h-8 rounded-full bg-white/5 shrink-0 flex items-center justify-center text-[10px] font-bold text-gray-400 uppercase">
          {userId === post.author_id ? "Me" : "U"}
        </div>
        <input 
          value={commentValue}
          onChange={(e) => onCommentChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onCommentSubmit()}
          placeholder="Write a comment..." 
          className="flex-1 bg-white/5 border border-white/5 rounded-lg px-4 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 transition-all"
        />
        <button 
          onClick={onCommentSubmit}
          className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-gray-400 transition-all"
        >
          Send
        </button>
      </div>
    </div>
  );
}

function StatItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="p-2 bg-white/5 rounded-lg">
        {icon}
      </div>
      <span className="text-xs font-medium text-gray-300">{label}</span>
    </div>
  );
}
