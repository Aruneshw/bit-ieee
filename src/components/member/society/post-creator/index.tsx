import React, { useState } from "react";
import { 
  X, Image as ImageIcon, Layout, Send, 
  Info, CheckCircle, ChevronRight, ChevronLeft,
  Loader2
} from "lucide-react";
import { SOCIETIES, CATEGORIES, BANNED_WORDS } from "../constants";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface PostCreatorProps {
  userProfile: any;
  onPostCreated: () => void;
}

export function PostCreator({ userProfile, onPostCreated }: PostCreatorProps) {
  const supabase = createClient();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    identityType: "individual" as "individual" | "society",
    societyId: "" as string | null,
    collaborators: [] as string[],
    title: "",
    description: "",
    category: "general" as any,
    media: [] as File[],
    previews: [] as string[]
  });

  const resetForm = () => {
    setStep(1);
    setAgreed(false);
    setFormData({
      identityType: "individual",
      societyId: "",
      collaborators: [],
      title: "",
      description: "",
      category: "general",
      media: [],
      previews: []
    });
    setIsOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).slice(0, 3 - formData.media.length);
      const newPreviews = files.map(file => URL.createObjectURL(file));
      setFormData(prev => ({
        ...prev,
        media: [...prev.media, ...files],
        previews: [...prev.previews, ...newPreviews]
      }));
    }
  };

  const removeMedia = (index: number) => {
    setFormData(prev => ({
      ...prev,
      media: prev.media.filter((_, i) => i !== index),
      previews: prev.previews.filter((_, i) => i !== index)
    }));
  };

  const runModeration = async (text: string) => {
    if (text.length < 10) return { safe: false };
    const words = text.toLowerCase().split(/\s+/);
    if (BANNED_WORDS.some(bw => words.includes(bw))) return { safe: false };
    
    // In production, call your AI moderation edge function here
    // const { data } = await supabase.functions.invoke('moderate', { body: { text } });
    
    await new Promise(r => setTimeout(r, 1000));
    return { safe: true, flag_reason: "none" };
  };

  const handleSubmit = async () => {
    if (!userProfile) return;
    setSubmitting(true);
    
    try {
      const moderationResult = await runModeration(`${formData.title} ${formData.description}`);
      
      if (!moderationResult.safe) {
        toast.error("Unable to complete your request. Please try again later.");
        setSubmitting(false);
        return;
      }

      let mediaUrl = null;
      if (formData.media.length > 0) {
        const file = formData.media[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `posts/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(filePath);
        
        mediaUrl = publicUrl;
      }

      const content = formData.title 
        ? `[${formData.title}]\n\n${formData.description}`
        : formData.description;

      const { error: postError } = await supabase.from("posts").insert({
        author_id: userProfile.id,
        society_id: formData.identityType === "society" ? formData.societyId : null,
        content: content,
        media_url: mediaUrl,
        status: "approved" // Silent moderation passed
      });

      if (postError) throw postError;

      toast.success("Your post has been shared successfully!");
      onPostCreated();
      resetForm();
    } catch (err: any) {
      console.error(err);
      toast.error("Unable to complete your request. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div 
        onClick={() => setIsOpen(true)}
        className="glass-card p-4 border border-white/5 cursor-pointer hover:border-white/10 transition-all group"
      >
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00629B] to-[#00bfff] p-0.5">
            <div className="w-full h-full rounded-full bg-[#0a192f] flex items-center justify-center text-xs font-bold text-white uppercase">
              {userProfile?.name?.[0] || "U"}
            </div>
          </div>
          <div className="flex-1 bg-white/5 rounded-full px-5 flex items-center text-sm text-gray-400 group-hover:bg-white/10 transition-colors">
            What's happening in your IEEE chapter?
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0a192f]/80 backdrop-blur-sm" onClick={resetForm} />
          <div className="relative glass-card w-full max-w-xl border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
            
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-2">
                {step === 1 ? <Info className="w-4 h-4 text-blue-400" /> : <Send className="w-4 h-4 text-blue-400" />}
                {step === 1 ? "Community Guidelines" : "Create Post"}
              </h3>
              <button onClick={resetForm} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6">
              {step === 1 && (
                <div className="space-y-6">
                  <div className="bg-blue-500/5 border border-blue-500/10 p-5 rounded-2xl text-sm text-gray-300 leading-relaxed space-y-4">
                    <p>All posts and comments must be professional and relevant to IEEE activities. Content that is inappropriate, spammy, or unrelated to academic activities will not be accepted.</p>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      className="w-5 h-5 rounded border-white/10 bg-white/5 text-[#00629B]" 
                    />
                    <span className="text-sm text-gray-400">I agree to follow the guidelines.</span>
                  </label>
                  <div className="flex justify-end gap-3 mt-8">
                    <button onClick={() => setStep(2)} disabled={!agreed} className="btn-primary px-8 flex items-center gap-2 disabled:opacity-50">
                      Continue <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Posting As</p>
                  <div className="grid grid-cols-1 gap-4">
                    <div 
                      onClick={() => setFormData(p => ({ ...p, identityType: "individual", societyId: null }))}
                      className={`p-4 rounded-2xl border cursor-pointer ${formData.identityType === "individual" ? "bg-[#00629B]/20 border-[#00629B]" : "bg-white/5 border-white/5"}`}
                    >
                      <p className="font-bold text-white">{userProfile?.name}</p>
                      <p className="text-xs text-gray-500">Individual Member</p>
                    </div>
                    {userProfile?.society_id && (
                      <div 
                        onClick={() => setFormData(p => ({ ...p, identityType: "society", societyId: userProfile.society_id }))}
                        className={`p-4 rounded-2xl border cursor-pointer ${formData.identityType === "society" ? "bg-[#00629B]/20 border-[#00629B]" : "bg-white/5 border-white/5"}`}
                      >
                        <p className="font-bold text-white">Society Branch</p>
                        <p className="text-xs text-gray-500">Post as an Officer</p>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between mt-8">
                    <button onClick={() => setStep(1)} className="btn-secondary px-6">Back</button>
                    <button onClick={() => setStep(3)} className="btn-primary px-8">Next</button>
                  </div>
                </div>
              )}

              {step >= 3 && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Category</label>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORIES.filter(c => c.id !== "all").map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setFormData(p => ({ ...p, category: cat.id }))}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border ${formData.category === cat.id ? "bg-[#00629B] border-[#00629B] text-white" : "bg-white/5 border-white/5 text-gray-400"}`}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <input 
                    type="text" 
                    className="input-field text-sm"
                    placeholder="Post Title (Optional)"
                    value={formData.title}
                    onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                  />

                  <textarea 
                    rows={4}
                    className="input-field text-sm resize-none"
                    placeholder="Share what's happening..."
                    value={formData.description}
                    onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                  />

                  <div className="flex gap-4">
                    {formData.previews.map((preview, i) => (
                      <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/10">
                        <img src={preview} className="w-full h-full object-cover" />
                        <button onClick={() => removeMedia(i)} className="absolute top-1 right-1 bg-black/50 p-1 rounded-full text-white">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {formData.media.length < 3 && (
                      <label className="w-20 h-20 rounded-xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center cursor-pointer">
                        <ImageIcon className="w-5 h-5 text-gray-600" />
                        <input type="file" className="hidden" accept="image/*" multiple onChange={handleFileChange} />
                      </label>
                    )}
                  </div>

                  <div className="flex justify-between mt-8">
                    <button onClick={() => setStep(2)} className="btn-secondary px-6">Back</button>
                    <button 
                      onClick={handleSubmit}
                      disabled={submitting || formData.description.length < 10}
                      className="btn-primary px-10 flex items-center gap-2"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      {submitting ? "Sharing..." : "Submit Post"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
