"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
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
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"feed" | "admin">("feed");
  
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
      await fetchPosts();
      setLoading(false);
    }
    init();
  }, []);

  async function fetchPosts() {
    // In production, this would filter by status: "approved" for non-admins
    const { data, error } = await supabase
      .from("posts")
      .select("*, author:users(name, role), society:societies(name, abbreviation)");
    
    if (error) {
      console.error("Error fetching posts:", error);
      return;
    }

    // Transform and filter (Mocking full field mapping)
    const transformedPosts = (data || []).map(p => ({
      ...p,
      title: p.content.startsWith('[') ? p.content.split('\n')[0].slice(1, -1) : null,
      description: p.content.startsWith('[') ? p.content.split('\n').slice(1).join('\n') : p.content,
      category: "general", // Mock
      media: p.media_url ? [p.media_url] : [],
      created_by: {
        userId: p.author_id,
        displayName: p.author?.name || "Unknown",
        identityType: "individual",
        societyId: p.society_id
      },
      collaborators: [],
      status: p.status || "approved",
      moderation_flag: false,
      flag_reason: "none",
      likes: [],
      saves: [],
      comment_count: 0,
      created_at: p.created_at,
      updated_at: p.updated_at
    })) as Post[];

    setPosts(transformedPosts);
  }

  const handleLike = (postId: string) => {
    // Logic for liking
    toast.success("Post liked!");
  };

  const handleComment = (postId: string, text: string) => {
    // Logic for commenting
    toast.success("Comment shared!");
  };

  const handleAdminAction = async (postId: string, action: "approve" | "reject" | "delete") => {
    // In production: await supabase.from("posts").update({ status: action }).eq("id", postId);
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
          <p className="text-sm text-gray-500 font-medium">Loading IEEE Community...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6">
      
      {/* Admin Toggle (Visible only to admins) */}
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Panel */}
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

          {/* Center Feed */}
          <div className="col-span-1 lg:col-span-6 space-y-8">
            <PostCreator 
              userProfile={profile} 
              onPostCreated={fetchPosts} 
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

          {/* Right Panel */}
          <div className="hidden lg:block lg:col-span-3">
            <TrendingPanel />
          </div>

        </div>
      )}
    </div>
  );
}
