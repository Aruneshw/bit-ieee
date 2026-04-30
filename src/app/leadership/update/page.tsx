"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { FileText, Plus, Download, Award, Briefcase, BookOpen, Trophy } from "lucide-react";
import { toast } from "sonner";

export default function ResumeBuilderPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState("add");
  const [category, setCategory] = useState("projects");

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-heading tracking-wide mb-2">Resume Builder</h1>
          <p className="text-gray-400">Add achievements to auto-generate your professional resume.</p>
        </div>
        <button onClick={() => setActiveTab("preview")} className="btn-secondary flex items-center gap-2 text-sm">
          <FileText className="w-4 h-4" /> Preview Resume
        </button>
      </div>

      <div className="flex space-x-2 border-b border-white/10 pb-4">
        <button onClick={() => setActiveTab("add")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "add" ? "bg-[#00629B] text-white" : "text-gray-400 hover:text-white"}`}>Add Achievements</button>
        <button onClick={() => setActiveTab("preview")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "preview" ? "bg-[#00629B] text-white" : "text-gray-400 hover:text-white"}`}>Preview & Download</button>
      </div>

      {activeTab === "add" ? <AchievementsForm category={category} setCategory={setCategory} /> : <ResumePreview />}
    </div>
  );
}

function AchievementsForm({ category, setCategory }: { category: string; setCategory: (c: string) => void }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Fetch existing resume
      const { data: resume } = await supabase.from("resumes").select("*").eq("user_id", user.id).single();
      const existing = resume?.[category as keyof typeof resume] || [];
      const items = Array.isArray(existing) ? existing : [];

      items.push({
        title: fd.get("title"),
        description: fd.get("description"),
        date: fd.get("date"),
      });

      if (resume) {
        await supabase.from("resumes").update({ [category]: items, last_updated: new Date().toISOString() }).eq("user_id", user.id);
      } else {
        await supabase.from("resumes").insert({ user_id: user.id, [category]: items });
      }

      toast.success("Added to resume!");
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      toast.error(err.message || "Failed to add");
    } finally {
      setLoading(false);
    }
  }

  const categories = [
    { id: "projects", icon: <Briefcase className="w-4 h-4" />, label: "Projects" },
    { id: "certificates", icon: <Award className="w-4 h-4" />, label: "Certificates" },
    { id: "publications", icon: <BookOpen className="w-4 h-4" />, label: "Publications" },
    { id: "hackathons", icon: <Trophy className="w-4 h-4" />, label: "Hackathons" },
  ];

  return (
    <div className="glass-card p-6 max-w-3xl">
      <div className="flex gap-3 mb-6">
        {categories.map(c => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`flex-1 py-3 rounded-lg flex items-center justify-center gap-2 border text-sm font-medium transition-colors ${
              category === c.id ? "bg-[#00bfff]/15 border-[#00bfff]/40 text-[#00bfff]" : "border-white/10 text-gray-400 hover:bg-white/5"
            }`}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div><label className="block text-sm text-gray-400 mb-1">Title *</label><input name="title" required className="input-field" placeholder="e.g. IoT Smart Farm" /></div>
        <div><label className="block text-sm text-gray-400 mb-1">Date / Duration *</label><input name="date" required className="input-field" placeholder="e.g. Aug 2025 - Dec 2025" /></div>
        <div><label className="block text-sm text-gray-400 mb-1">Description *</label><textarea name="description" required rows={3} className="input-field resize-none" placeholder="Describe what you did..." /></div>
        <button type="submit" disabled={loading} className="w-full btn-primary flex items-center justify-center gap-2">
          <Plus className="w-5 h-5" /> {loading ? "Adding..." : "Add to Resume"}
        </button>
      </form>
    </div>
  );
}

function ResumePreview() {
  const supabase = createClient();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      const { data: profile } = await supabase
        .from("users")
        .select("*, society:societies(name)")
        .eq("email", user.email.toLowerCase())
        .single();

      if (!profile) {
        setLoading(false);
        return;
      }

      const { data: resume } = await supabase
        .from("resumes")
        .select("*")
        .eq("user_id", profile.id)
        .single();

      setData({ user: profile, resume });
      setLoading(false);
    }
    fetch();
  }, []);

  if (loading) return <div className="h-96 glass-card animate-pulse" />;

  const u = data?.user;
  const r = data?.resume;
  const sections = [
    { key: "projects", title: "Projects" },
    { key: "certificates", title: "Certificates" },
    { key: "publications", title: "Publications" },
    { key: "hackathons", title: "Hackathons" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={() => window.print()} className="btn-primary flex items-center gap-2 text-sm">
          <Download className="w-4 h-4" /> Download PDF
        </button>
      </div>

      <div className="bg-white text-black p-10 max-w-4xl mx-auto rounded-lg shadow-2xl" id="resume-document">
        <div className="border-b-2 border-black pb-6 mb-6">
          <h1 className="text-4xl font-bold uppercase tracking-widest">{u?.name || "—"}</h1>
          <p className="text-gray-600 text-lg mt-1">{u?.department || ""} {u?.society?.name ? `| ${u.society.name}` : ""}</p>
          <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-700">
            {u?.email && <span>{u.email}</span>}
            {u?.github && <span>{u.github}</span>}
            {u?.linkedin && <span>{u.linkedin}</span>}
          </div>
        </div>

        {u?.primary_skills && (
          <div className="mb-6">
            <h2 className="text-xl font-bold uppercase border-b border-gray-300 pb-1 mb-3">Skills</h2>
            <p><span className="font-semibold">Primary:</span> {u.primary_skills}</p>
            {u.secondary_skills && <p><span className="font-semibold">Secondary:</span> {u.secondary_skills}</p>}
          </div>
        )}

        {sections.map(({ key, title }) => {
          const items = r?.[key] || [];
          if (!Array.isArray(items) || items.length === 0) return null;
          return (
            <div key={key} className="mb-6">
              <h2 className="text-xl font-bold uppercase border-b border-gray-300 pb-1 mb-3">{title}</h2>
              <div className="space-y-4">
                {items.map((item: any, idx: number) => (
                  <div key={idx}>
                    <div className="flex justify-between items-baseline">
                      <h3 className="font-bold text-lg">{item.title}</h3>
                      <span className="text-sm text-gray-600">{item.date}</span>
                    </div>
                    <p className="text-gray-700 text-sm mt-1">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `@media print { body * { visibility: hidden; } #resume-document, #resume-document * { visibility: visible; } #resume-document { position: absolute; left: 0; top: 0; width: 100%; } }` }} />
    </div>
  );
}
