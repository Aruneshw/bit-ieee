"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { Plus, Users, Upload, ShieldAlert, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface Society { id: string; name: string; abbreviation: string; }

export default function ManagePage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState("society");
  const [userRole, setUserRole] = useState("");
  const [societies, setSocieties] = useState<Society[]>([]);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const { data } = await supabase.from("users").select("role").eq("email", user.email.toLowerCase()).single();
        setUserRole(data?.role || "");
      }
      const { data: socs } = await supabase.from("societies").select("id, name, abbreviation").order("name");
      if (socs) setSocieties(socs);
    }
    init();
  }, []);

  if (userRole && userRole !== "admin_primary") {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <ShieldAlert className="w-16 h-16 text-red-400 mb-4 opacity-80" />
        <h2 className="text-2xl font-bold text-red-400">Access Denied</h2>
        <p className="mt-2 text-gray-400">Only Primary Administrators can access this page.</p>
      </div>
    );
  }

  const tabs = [
    { id: "society", label: "Add Society" },
    { id: "rep", label: "Student Rep" },
    { id: "members", label: "Bulk Members" },
    { id: "leadership", label: "Bulk Leadership" },
    { id: "event_manager", label: "Event Manager" },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-4xl font-heading tracking-wide mb-2">Manage Portal</h1>
        <p className="text-gray-400">Add societies and manage users in bulk.</p>
      </div>

      <div className="flex space-x-2 border-b border-white/10 pb-4 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id ? "bg-[#00629B] text-white" : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6 glass-card p-6 max-w-3xl">
        {activeTab === "society" && <AddSocietyForm supabase={supabase} />}
        {activeTab === "rep" && <AddUserForm supabase={supabase} role="student_rep" societies={societies} />}
        {activeTab === "members" && <BulkUploadForm supabase={supabase} type="membership" societies={societies} />}
        {activeTab === "leadership" && <BulkUploadForm supabase={supabase} type="leadership" societies={societies} />}
        {activeTab === "event_manager" && <AddUserForm supabase={supabase} role="event_manager" societies={societies} />}
      </div>
    </div>
  );
}

function AddSocietyForm({ supabase }: { supabase: any }) {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    
    try {
      const { error } = await supabase.from("societies").insert({
        name: fd.get("name"),
        abbreviation: fd.get("abbreviation"),
        department: fd.get("department"),
        total_members: parseInt(fd.get("total_members") as string) || 0,
      });
      if (error) throw error;
      toast.success("Society added successfully!");
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      toast.error(err.message || "Failed to add society");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h3 className="text-xl font-medium mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-[#00bfff]" /> Add New Society</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Society Name *</label>
          <input name="name" required className="input-field" placeholder="e.g. Computer Society" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Abbreviation</label>
          <input name="abbreviation" className="input-field" placeholder="e.g. CS" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Department</label>
          <input name="department" className="input-field" placeholder="e.g. CSE" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Number of Members</label>
          <input name="total_members" type="number" className="input-field" placeholder="0" />
        </div>
      </div>
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Adding..." : "Add Society"}
      </button>
    </form>
  );
}

function AddUserForm({ supabase, role, societies }: { supabase: any; role: string; societies: Society[] }) {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const email = fd.get("email") as string;

    if (!email.endsWith("@bitsathy.ac.in")) {
      toast.error("Only @bitsathy.ac.in emails allowed");
      setLoading(false);
      return;
    }

    try {
      // Upsert user in public.users table
      const { error } = await supabase.from("users").upsert({
        email,
        name: fd.get("name"),
        role,
        society_id: fd.get("society_id") || null,
        department: fd.get("department") || null,
        mobile: fd.get("mobile") || null,
        primary_skills: fd.get("primary_skills") || null,
        secondary_skills: fd.get("secondary_skills") || null,
      }, { onConflict: "email" });

      if (error) throw error;
      toast.success(`${role.replace("_", " ")} added successfully!`);
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      toast.error(err.message || "Failed to add user");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h3 className="text-xl font-medium mb-4 flex items-center gap-2">
        <Users className="w-5 h-5 text-[#00bfff]" /> Add {role.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Name *</label>
          <input name="name" required className="input-field" placeholder="Full name" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Email *</label>
          <input name="email" type="email" required className="input-field" placeholder="user@bitsathy.ac.in" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Department</label>
          <input name="department" className="input-field" placeholder="e.g. CSE" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Mobile</label>
          <input name="mobile" className="input-field" placeholder="+91..." />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm text-gray-400 mb-1.5">Society *</label>
          <select name="society_id" required className="input-field">
            <option value="">Select society</option>
            {societies.map(s => <option key={s.id} value={s.id}>{s.abbreviation} — {s.name}</option>)}
          </select>
        </div>
        {(role === "leadership" || role === "event_manager") && (
          <>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Primary Skills</label>
              <input name="primary_skills" className="input-field" placeholder="e.g. Python, ML" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Secondary Skills</label>
              <input name="secondary_skills" className="input-field" placeholder="e.g. Web Dev, IoT" />
            </div>
          </>
        )}
      </div>
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Adding..." : "Add User"}
      </button>
    </form>
  );
}

function BulkUploadForm({ supabase, type, societies }: { supabase: any; type: string; societies: Society[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  async function handleUpload() {
    if (!file) { toast.error("Please select a file"); return; }
    setLoading(true);
    setResults(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      if (rows.length === 0) { toast.error("Empty spreadsheet"); setLoading(false); return; }

      // Build a society name → id map
      const societyMap = new Map(societies.map(s => [s.name.toLowerCase(), s.id]));
      // Also map abbreviations
      societies.forEach(s => { if (s.abbreviation) societyMap.set(s.abbreviation.toLowerCase(), s.id); });

      let success = 0;
      const errors: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const name = row["Name"] || row["name"];
        const email = row["Gmail"] || row["Email"] || row["email"] || row["gmail"];
        const dept = row["Department"] || row["department"] || "";
        const societyName = row["Respective Society"] || row["Society"] || row["society"] || "";

        if (!name || !email) {
          errors.push(`Row ${i + 2}: Missing name or email`);
          continue;
        }

        if (!email.endsWith("@bitsathy.ac.in")) {
          errors.push(`Row ${i + 2}: Invalid domain — ${email}`);
          continue;
        }

        const societyId = societyMap.get(societyName.toLowerCase()) || null;

        const userData: any = {
          email,
          name,
          role: type,
          society_id: societyId,
          department: dept,
        };

        if (type === "leadership") {
          userData.primary_skills = row["Primary Skills"] || row["primary_skills"] || "";
          userData.secondary_skills = row["Secondary Skills"] || row["secondary_skills"] || "";
        }

        const { error } = await supabase.from("users").upsert(userData, { onConflict: "email" });
        if (error) {
          errors.push(`Row ${i + 2}: ${error.message}`);
        } else {
          success++;
        }
      }

      setResults({ success, failed: errors.length, errors });
      if (success > 0) toast.success(`Successfully imported ${success} users`);
      if (errors.length > 0) toast.warning(`${errors.length} rows had errors`);
      setFile(null);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  const expectedColumns = type === "membership"
    ? "Name, Department, Gmail, Respective Society"
    : "Name, Department, Gmail, Respective Society, Primary Skills, Secondary Skills";

  return (
    <div className="space-y-5">
      <h3 className="text-xl font-medium mb-4 flex items-center gap-2">
        <Upload className="w-5 h-5 text-[#00bfff]" /> Bulk Add {type === "membership" ? "Members" : "Leadership"}
      </h3>
      <p className="text-sm text-gray-400">
        Upload an Excel file (.xlsx) with columns: <span className="text-white font-medium">{expectedColumns}</span>
      </p>

      <label className="block border-2 border-dashed border-white/15 rounded-xl p-8 text-center hover:bg-white/[0.02] transition-colors cursor-pointer">
        <Upload className="w-8 h-8 mx-auto text-gray-500 mb-3" />
        <p className="text-sm text-gray-300">{file ? file.name : "Click to upload or drag and drop"}</p>
        <p className="text-xs text-gray-500 mt-1">.xlsx files only</p>
        <input type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </label>

      <div className="flex justify-end">
        <button onClick={handleUpload} disabled={loading || !file} className="btn-primary">
          {loading ? "Processing..." : "Process Upload"}
        </button>
      </div>

      {results && (
        <div className="space-y-3 mt-4">
          <div className="flex gap-4">
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle className="w-4 h-4" /> {results.success} imported
            </div>
            {results.failed > 0 && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" /> {results.failed} failed
              </div>
            )}
          </div>
          {results.errors.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 max-h-40 overflow-y-auto">
              {results.errors.map((err, i) => (
                <p key={i} className="text-red-400 text-xs">{err}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
