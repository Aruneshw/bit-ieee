"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Zap, User, GraduationCap, Code2, ArrowLeft, ArrowRight,
  Lock, Calendar, Phone, Mail, Building2, Hash, Globe,
  GitFork, Link2, X, Plus, Loader2, Check, AlertCircle,
} from "lucide-react";
import { DEPARTMENTS, SKILL_OPTIONS, getRoleDashboardPath } from "@/lib/types";
import type { UserRole } from "@/lib/types";

// ────────────────────────────────────────────
// ZOD VALIDATION SCHEMAS (per step)
// ────────────────────────────────────────────

const step1Schema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  gender: z.enum(["Male", "Female", "Prefer not to say"], { error: "Please select a gender" }),
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
});

const step2Schema = z.object({
  college_email: z.string().email(),
  department: z.enum(DEPARTMENTS, { error: "Select a department" }),
  year: z.enum(["1st", "2nd", "3rd", "4th"], { error: "Select your year" }),
  roll_number: z.string().min(1, "Roll number is required"),
  society_name: z.string(), // read-only
});

const step3Schema = z.object({
  github: z.string()
    .refine((v) => !v || v.includes("github.com"), "Must be a GitHub URL")
    .optional()
    .or(z.literal("")),
  linkedin: z.string()
    .refine((v) => !v || v.includes("linkedin.com"), "Must be a LinkedIn URL")
    .optional()
    .or(z.literal("")),
  portfolio: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  primary_skills: z.array(z.string()).min(1, "Select at least one primary skill"),
  bio: z.string().max(300, "Bio must be 300 characters or less").optional(),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Step3Data = z.infer<typeof step3Schema>;

// ────────────────────────────────────────────
// MAIN COMPONENT
// ────────────────────────────────────────────

export default function ProfileSetupPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Auth user data (pre-fill read-only fields)
  const [collegeEmail, setCollegeEmail] = useState("");
  const [societyName, setSocietyName] = useState("");
  const [societyId, setSocietyId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  // Aggregate form data across steps
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [step2Data, setStep2Data] = useState<Step2Data | null>(null);

  // ── Route guard + pre-fill ──
  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) { router.replace("/login"); return; }

      // Query by email
      const { data: profile } = await supabase
        .from("users")
        .select("*, society:societies(name, abbreviation)")
        .eq("email", user.email.toLowerCase())
        .single();

      if (!profile) {
        toast.error("Your account is not registered. Contact your IEEE admin.");
        await supabase.auth.signOut();
        router.replace("/login?error=not_registered");
        return;
      }

      // Already completed → redirect away
      if (profile.profile_completed) {
        router.replace(getRoleDashboardPath(profile.role as UserRole));
        return;
      }

      setCollegeEmail(user.email.toLowerCase());
      setSocietyName(
        profile.society
          ? `${(profile.society as any).abbreviation} — ${(profile.society as any).name}`
          : "Not assigned"
      );
      setSocietyId(profile.society_id);
      setUserRole(profile.role as UserRole);
      setAuthLoading(false);
    }
    init();
  }, []);

  // ── Final submit ──
  async function handleFinalSubmit(data3: Step3Data) {
    if (!step1Data || !step2Data) return;
    setSubmitting(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Session expired");

      // 1) UPDATE users row
      const { error: updateErr } = await supabase
        .from("users")
        .update({
          full_name: step1Data.full_name,
          name: step1Data.full_name,
          gender: step1Data.gender,
          mobile: step1Data.mobile,
          department: step2Data.department,
          year: step2Data.year,
          roll_number: step2Data.roll_number,
          github: data3.github || null,
          linkedin: data3.linkedin || null,
          portfolio: data3.portfolio || null,
          primary_skills: (data3.primary_skills || []).join(", "),
          bio: data3.bio || null,
          profile_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq("email", user.email.toLowerCase());

      if (updateErr) throw updateErr;

      // 2) Get the user id from the DB (needed for resumes FK)
      const { data: dbUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", user.email.toLowerCase())
        .single();

      if (!dbUser) throw new Error("User row not found after update");

      // 3) INSERT resume
      const { error: resumeErr } = await supabase.from("resumes").upsert({
        user_id: dbUser.id,
        personal_info: {
          name: step1Data.full_name,
          gender: step1Data.gender,
          mobile: step1Data.mobile,
          college_email: collegeEmail,
          department: step2Data.department,
          year: step2Data.year,
          roll_number: step2Data.roll_number,
        },
        online_presence: {
          github: data3.github || "",
          linkedin: data3.linkedin || "",
          portfolio: data3.portfolio || "",
        },
        skills: {
          primary: data3.primary_skills || [],
        },
        bio: data3.bio || null,
        society: societyName,
        events_attended: [],
        certificates: [],
        projects: [],
        hackathons: [],
        publications: [],
        pdf_url: null,
        last_updated: new Date().toISOString(),
      }, { onConflict: "user_id" });

      if (resumeErr) throw resumeErr;

      // 4) Success
      toast.success("Profile saved! Redirecting to your dashboard...");

      // 5) Delay then redirect
      setTimeout(() => {
        if (userRole) router.push(getRoleDashboardPath(userRole));
        else router.push("/dashboard");
      }, 1500);
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
      setSubmitting(false);
    }
  }

  // ── Loading state ──
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#00bfff] animate-spin" />
      </div>
    );
  }

  // ── Render ──
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-15%] right-[-5%] w-[45%] h-[45%] rounded-full bg-[#00bfff]/8 blur-[150px]" />
        <div className="absolute bottom-[-15%] left-[-5%] w-[45%] h-[45%] rounded-full bg-[#00629B]/10 blur-[150px]" />
      </div>

      <div className="w-full max-w-2xl relative z-10 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 justify-center">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00629B] to-[#00bfff] flex items-center justify-center shadow-lg shadow-[#00bfff]/20">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-wide text-white">BIT IEEE HUB</h2>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Profile Setup</p>
          </div>
        </div>

        {/* Progress Bar */}
        <ProgressBar step={step} />

        {/* Form Card */}
        <div className="glass-card p-6 sm:p-8 shadow-2xl mt-6">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-heading tracking-wide">Complete Your Profile</h1>
            <p className="text-gray-400 text-sm mt-1">
              This information will be used to auto-generate your IEEE resume.
            </p>
          </div>

          {step === 1 && (
            <Step1Form
              initialData={step1Data}
              onNext={(data) => { setStep1Data(data); setStep(2); }}
            />
          )}
          {step === 2 && (
            <Step2Form
              initialData={step2Data}
              collegeEmail={collegeEmail}
              societyName={societyName}
              onBack={() => setStep(1)}
              onNext={(data) => { setStep2Data(data); setStep(3); }}
            />
          )}
          {step === 3 && (
            <Step3Form
              onBack={() => setStep(2)}
              onSubmit={handleFinalSubmit}
              submitting={submitting}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// PROGRESS BAR
// ────────────────────────────────────────────

function ProgressBar({ step }: { step: number }) {
  const steps = [
    { num: 1, label: "Personal Info", icon: <User className="w-4 h-4" /> },
    { num: 2, label: "Academic Info", icon: <GraduationCap className="w-4 h-4" /> },
    { num: 3, label: "Skills & Links", icon: <Code2 className="w-4 h-4" /> },
  ];

  return (
    <div className="flex items-center gap-2 px-2">
      {steps.map((s, i) => (
        <div key={s.num} className="flex items-center flex-1">
          <div className="flex items-center gap-2 flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                step > s.num
                  ? "bg-green-500 text-white"
                  : step === s.num
                    ? "bg-gradient-to-br from-[#00629B] to-[#00bfff] text-white shadow-md shadow-[#00bfff]/20"
                    : "bg-white/5 text-gray-500 border border-white/10"
              }`}
            >
              {step > s.num ? <Check className="w-4 h-4" /> : s.icon}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${step >= s.num ? "text-white" : "text-gray-500"}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-px flex-1 mx-2 ${step > s.num ? "bg-green-500" : "bg-white/10"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────
// STEP 1: PERSONAL INFORMATION
// ────────────────────────────────────────────

function Step1Form({ initialData, onNext }: { initialData: Step1Data | null; onNext: (data: Step1Data) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: initialData || {},
  });

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-5 animate-slide-up">
      <h3 className="text-lg font-medium text-[#00bfff] flex items-center gap-2 mb-4">
        <User className="w-5 h-5" /> Personal Information
      </h3>

      <FormField label="Full Name" icon={<User />} error={errors.full_name?.message}>
        <input {...register("full_name")} className="input-field pl-10" placeholder="e.g. John Doe" />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <FormField label="Gender" error={errors.gender?.message}>
          <select {...register("gender")} className="input-field">
            <option value="">Select gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>
        </FormField>

        <FormField label="Mobile Number" icon={<Phone />} error={errors.mobile?.message}>
          <input type="tel" maxLength={10} {...register("mobile")} className="input-field pl-10" placeholder="9876543210" />
        </FormField>
      </div>

      <div className="flex justify-end pt-4">
        <button type="submit" className="btn-primary flex items-center gap-2">
          Next <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}

// ────────────────────────────────────────────
// STEP 2: ACADEMIC INFORMATION
// ────────────────────────────────────────────

function Step2Form({
  initialData, collegeEmail, societyName, onBack, onNext,
}: {
  initialData: Step2Data | null;
  collegeEmail: string;
  societyName: string;
  onBack: () => void;
  onNext: (data: Step2Data) => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: initialData || {
      college_email: collegeEmail,
      society_name: societyName,
    },
  });

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-5 animate-slide-up">
      <h3 className="text-lg font-medium text-[#00bfff] flex items-center gap-2 mb-4">
        <GraduationCap className="w-5 h-5" /> Academic Information
      </h3>

      {/* Read-only: College Email */}
      <FormField label="Working / College Email" icon={<Lock />} locked>
        <input value={collegeEmail} readOnly className="input-field pl-10 opacity-60 cursor-not-allowed" />
        <input type="hidden" {...register("college_email")} value={collegeEmail} />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <FormField label="Department" error={errors.department?.message}>
          <select {...register("department")} className="input-field">
            <option value="">Select department</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </FormField>

        <FormField label="Year of Study" error={errors.year?.message}>
          <select {...register("year")} className="input-field">
            <option value="">Select year</option>
            <option value="1st">1st Year</option>
            <option value="2nd">2nd Year</option>
            <option value="3rd">3rd Year</option>
            <option value="4th">4th Year</option>
          </select>
        </FormField>
      </div>

      <FormField label="Roll Number" icon={<Hash />} error={errors.roll_number?.message}>
        <input {...register("roll_number")} className="input-field pl-10" placeholder="e.g. 22CSE101" />
      </FormField>

      {/* Read-only: IEEE Society */}
      <FormField label="IEEE Society" icon={<Lock />} locked>
        <input value={societyName} readOnly className="input-field pl-10 opacity-60 cursor-not-allowed" />
        <input type="hidden" {...register("society_name")} value={societyName} />
      </FormField>

      <div className="flex justify-between pt-4">
        <button type="button" onClick={onBack} className="btn-secondary flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button type="submit" className="btn-primary flex items-center gap-2">
          Next <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}

// ────────────────────────────────────────────
// STEP 3: SKILLS & ONLINE PRESENCE
// ────────────────────────────────────────────

function Step3Form({
  onBack, onSubmit, submitting,
}: {
  onBack: () => void;
  onSubmit: (data: Step3Data) => void;
  submitting: boolean;
}) {
  const { register, handleSubmit, control, formState: { errors } } = useForm<Step3Data>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      primary_skills: [],
      secondary_skills: [],
      github: "",
      linkedin: "",
      portfolio: "",
      bio: "",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 animate-slide-up">
      <h3 className="text-lg font-medium text-[#00bfff] flex items-center gap-2 mb-4">
        <Code2 className="w-5 h-5" /> Skills & Online Presence
      </h3>

      {/* GitHub */}
      <FormField label="GitHub Profile URL" icon={<GitFork />} error={errors.github?.message}>
        <input {...register("github")} className="input-field pl-10" placeholder="https://github.com/username" />
      </FormField>

      {/* LinkedIn */}
      <FormField label="LinkedIn Profile URL" icon={<Link2 />} error={errors.linkedin?.message}>
        <input {...register("linkedin")} className="input-field pl-10" placeholder="https://linkedin.com/in/username" />
      </FormField>

      {/* Portfolio */}
      <FormField label="Portfolio Website" icon={<Globe />} error={errors.portfolio?.message} optional>
        <input {...register("portfolio")} className="input-field pl-10" placeholder="https://your-portfolio.com" />
      </FormField>

      {/* Primary Skills */}
      <Controller
        name="primary_skills"
        control={control}
        render={({ field }) => (
          <FormField label="Skills" error={errors.primary_skills?.message}>
            <TagInput
              value={field.value || []}
              onChange={field.onChange}
              placeholder="Select or type skills..."
              options={[...SKILL_OPTIONS]}
            />
          </FormField>
        )}
      />

      {/* Bio */}
      <FormField label="Short Bio" optional error={errors.bio?.message}>
        <textarea
          {...register("bio")}
          rows={3}
          maxLength={300}
          className="input-field resize-none"
          placeholder="Brief intro about yourself — interests, goals, achievements"
        />
      </FormField>

      <div className="flex justify-between pt-4">
        <button type="button" onClick={onBack} className="btn-secondary flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
          ) : (
            <>Save & Continue <ArrowRight className="w-4 h-4" /></>
          )}
        </button>
      </div>
    </form>
  );
}

// ────────────────────────────────────────────
// SHARED UI PRIMITIVES
// ────────────────────────────────────────────

function FormField({
  label, icon, error, locked, optional, children,
}: {
  label: string;
  icon?: React.ReactNode;
  error?: string;
  locked?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm text-gray-400 mb-1.5 font-medium">
        {label}
        {optional && <span className="text-gray-600 text-xs">(optional)</span>}
        {locked && <Lock className="w-3 h-3 text-gray-600 ml-auto" />}
      </label>
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none">
            {icon}
          </span>
        )}
        {children}
      </div>
      {error && (
        <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
}

/**
 * Multi-select tag input with autocomplete dropdown.
 */
function TagInput({
  value, onChange, placeholder, options,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  options: string[];
}) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(
    () => options.filter(o => !value.includes(o) && o.toLowerCase().includes(input.toLowerCase())),
    [input, value, options]
  );

  function addTag(tag: string) {
    if (!value.includes(tag)) onChange([...value, tag]);
    setInput("");
  }

  function removeTag(tag: string) {
    onChange(value.filter(v => v !== tag));
  }

  return (
    <div className="relative">
      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.map(tag => (
          <span key={tag} className="flex items-center gap-1 px-2 py-1 bg-[#00629B]/20 text-[#00bfff] border border-[#00629B]/30 rounded-md text-xs font-medium">
            {tag}
            <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-400 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>

      {/* Input */}
      <div className="relative">
        <input
          value={input}
          onChange={e => { setInput(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (input.trim()) addTag(input.trim());
            }
          }}
          placeholder={value.length === 0 ? placeholder : "Add more..."}
          className="input-field text-sm"
        />
      </div>

      {/* Dropdown */}
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-[#132240] border border-white/10 rounded-xl shadow-2xl">
          {filtered.slice(0, 12).map(option => (
            <button
              key={option}
              type="button"
              onMouseDown={() => addTag(option)}
              className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-[#00629B]/20 hover:text-[#00bfff] transition-colors"
            >
              <Plus className="w-3 h-3 inline mr-2 opacity-50" />{option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
