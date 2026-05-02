"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useMemo } from "react";
import { SocietySidebar } from "@/components/member/society/panels/society-sidebar";
import { TrendingPanel } from "@/components/member/society/panels/trending-panel";
import { PostCreator } from "@/components/member/society/post-creator";
import { PostCard } from "@/components/member/society/feed/post-card";
import { AdminPanel } from "@/components/member/society/admin/admin-panel";
import { Post } from "@/components/member/society/types";
import { toast } from "sonner";
import { ShieldCheck, MessageSquare } from "lucide-react";

export default function MemberSocietyPage() {
  const supabase = createClient();
  const [posts, setPosts] = useState<Post[]>([]);
  const [societies, setSocieties] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"feed" | "admin">("feed");
  
  // Stats state
  const [stats, setStats] = useState({
    totalMembers: 0,
    postsThisMonth: 0,
    activeSocieties: 0
  });

  // Filters
  const [selectedSocieties, setSelectedSocieties] = useState<string[]>(["all"]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    async function init() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const { data: userData } = await supabase
          .from("users")
          .select("*")
          .eq("email", user.email.toLowerCase())
          .single();
        setProfile(userData);
      }

      // Fetch all societies for filters and stats
      const { data: societiesData } = await supabase.from("societies").select("*");
      setSocieties(societiesData || []);

      await fetchPosts();
      await fetchStats();
      setLoading(false);
    }
    init();
  }, []);

  async function fetchPosts() {
    const { data, error } = await supabase
      .from("posts")
      .select("*, author:users(name, role), society:societies(name, abbreviation), interactions:post_interactions(id, type, user_id, comment_text, user:users(name, role))");
    
    if (error) {
      console.error("Error fetching posts:", error);
      return;
    }

    const transformedPosts = (data || []).map(p => {
      // Logic to extract title if it exists in bracketed format
      const hasTitle = p.content.startsWith('[') && p.content.includes(']');
      const title = hasTitle ? p.content.split(']')[0].slice(1) : null;
      const description = hasTitle ? p.content.split(']').slice(1).join(']').trim() : p.content;

      const interactions = p.interactions || [];
      const likes = interactions.filter((i: any) => i.type === "like").map((i: any) => i.user_id);

      return {
        ...p,
        title,
        description,
        category: "general", // This could be stored in a column if added later
        media: p.media_url ? [p.media_url] : [],
        created_by: {
          userId: p.author_id,
          displayName: p.author?.name || "Unknown",
          identityType: p.society_id ? "society" : "individual",
          societyId: p.society_id
        },
        collaborators: [],
        status: p.status || "approved",
        moderation_flag: false,
        flag_reason: "none",
        likes,
        saves: [],
        comment_count: interactions.filter((i: any) => i.type === "comment").length,
        created_at: p.created_at,
        updated_at: p.updated_at
      };
    }) as Post[];

    setPosts(transformedPosts);
  }

  async function fetchStats() {
    // 1. Total Members
    const { count: memberCount } = await supabase.from("users").select("*", { count: "exact", head: true });
    
    // 2. Posts this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const { count: postCount } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfMonth.toISOString());

    // 3. Active Societies (Societies with at least one approved post)
    const activeSids = new Set(posts.filter(p => p.status === "approved" && p.created_by.societyId).map(p => p.created_by.societyId));

    setStats({
      totalMembers: memberCount || 0,
      postsThisMonth: postCount || 0,
      activeSocieties: activeSids.size || 0
    });
  }

  // Derive Society Stats for Trending Panel
  const societyStats = useMemo(() => {
    const statsMap: { [key: string]: number } = {};
    posts.forEach(p => {
      if (p.status === "approved" && p.society?.name) {
        statsMap[p.society.name] = (statsMap[p.society.name] || 0) + 1;
      }
    });

    const colors = ["bg-blue-500", "bg-purple-500", "bg-orange-500", "bg-green-500", "bg-pink-500"];
    return Object.entries(statsMap)
      .map(([name, count], i) => ({
        name,
        count,
        color: colors[i % colors.length]
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [posts]);

  // Derive Trending Tags (Simple keyword frequency for now)
  const trendingTags = useMemo(() => {
    const words: { [key: string]: number } = {};
    posts.forEach(p => {
      if (p.status === "approved") {
        const text = `${p.title || ""} ${p.description}`.toLowerCase();
        const matches = text.match(/#\w+/g);
        if (matches) {
          matches.forEach(tag => {
            const cleanTag = tag.slice(1);
            words[cleanTag] = (words[cleanTag] || 0) + 1;
          });
        }
      }
    });

    return Object.entries(words)
      .map(([tag, count]) => ({ tag, count: `${count} posts` }))
      .sort((a, b) => parseInt(b.count) - parseInt(a.count))
      .slice(0, 5);
  }, [posts]);

  const handleLike = async (postId: string) => {
    if (!profile) {
      toast.error("Please log in to like posts");
      return;
    }
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const isLiked = post.likes.includes(profile.id);

    try {
      if (isLiked) {
        const { error } = await supabase
          .from("post_interactions")
          .delete()
          .match({ post_id: postId, user_id: profile.id, type: "like" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("post_interactions")
          .insert({ post_id: postId, user_id: profile.id, type: "like" });
        if (error) throw error;
      }
      await fetchPosts();
    } catch (err: any) {
      console.error("Like error:", err);
      toast.error("Failed to update like");
    }
  };

  const handleComment = async (postId: string, text: string) => {
    if (!profile) {
      toast.error("Please log in to comment");
      return;
    }
    if (!text.trim()) return;

    try {
      const { error } = await supabase.from("post_interactions").insert({
        post_id: postId,
        user_id: profile.id,
        type: "comment",
        comment_text: text
      });

      if (error) throw error;

      toast.success("Comment shared!");
      await fetchPosts();
      await fetchStats();
    } catch (err: any) {
      console.error("Comment error:", err);
      toast.error("Failed to share comment");
    }
  };

  const handleAdminAction = async (postId: string, action: "approve" | "reject" | "delete") => {
    if (action === "delete") {
      await supabase.from("posts").delete().eq("id", postId);
    } else {
      await supabase.from("posts").update({ status: action }).eq("id", postId);
    }
    toast.success(`Post ${action}d successfully`);
    fetchPosts();
  };

  const filteredPosts = posts.filter(p => {
    if (p.status !== "approved" && view !== "admin") return false;
    
    const matchesSociety = selectedSocieties.includes("all") || 
      (p.created_by.societyId && selectedSocieties.includes(p.created_by.societyId));
    
    const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;
    
    return matchesSociety && matchesCategory;
  });

  const isAdmin = profile?.role?.includes("admin");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-500 font-medium">Synchronizing IEEE Hub...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6">
      
      {isAdmin && (
        <div className="flex justify-center mb-8">
          <div className="bg-white/5 p-1 rounded-2xl border border-white/5 flex gap-1">
            <button 
              onClick={() => setView("feed")}
              className={`px-6 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                view === "feed" ? "bg-white/10 text-white shadow-xl" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <MessageSquare className="w-4 h-4" /> Community Feed
            </button>
            <button 
              onClick={() => setView("admin")}
              className={`px-6 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                view === "admin" ? "bg-[#00629B] text-white shadow-xl" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <ShieldCheck className="w-4 h-4" /> Admin Queue
            </button>
          </div>
        </div>
      )}

      {view === "admin" ? (
        <AdminPanel posts={posts} onAction={handleAdminAction} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-12">
          
          <div className="hidden lg:block lg:col-span-3">
            <SocietySidebar 
              profile={profile}
              selectedSocieties={selectedSocieties}
              onSocietyChange={(id) => {
                if (id === "all") setSelectedSocieties(["all"]);
                else {
                  const current = selectedSocieties.filter(s => s !== "all");
                  if (current.includes(id)) {
                    const next = current.filter(s => s !== id);
                    setSelectedSocieties(next.length === 0 ? ["all"] : next);
                  } else {
                    setSelectedSocieties([...current, id]);
                  }
                }
              }}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
            />
          </div>

          <div className="col-span-1 lg:col-span-6 space-y-8">
            <PostCreator 
              userProfile={profile} 
              onPostCreated={() => { fetchPosts(); fetchStats(); }} 
            />
            
            <div className="space-y-6">
              {filteredPosts.length === 0 ? (
                <div className="glass-card p-12 text-center border border-white/5">
                  <p className="text-gray-500 font-medium">No posts found matching your filters.</p>
                </div>
              ) : (
                filteredPosts.map(post => (
                  <PostCard 
                    key={post.id} 
                    post={post} 
                    currentUserId={profile?.id}
                    onLike={handleLike}
                    onComment={handleComment}
                  />
                ))
              )}
            </div>
          </div>

          <div className="hidden lg:block lg:col-span-3">
            <TrendingPanel 
              stats={stats} 
              societyStats={societyStats} 
              trendingTags={trendingTags} 
            />
          </div>

        </div>
      )}
    </div>
  );
}
