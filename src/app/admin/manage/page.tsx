"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { Plus, Users, Upload, CheckCircle, AlertCircle, Download, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface Society { id: string; name: string; abbreviation: string; }

export default function ManagePage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState("society");
  const [societies, setSocieties] = useState<Society[]>([]);

  useEffect(() => {
    async function init() {
      const { data: socs } = await supabase.from("societies").select("id, name, abbreviation").order("name");
      if (socs) setSocieties(socs);
    }
    init();
  }, []);

  const tabs = [
    { id: "society", label: "Add Society" },
    { id: "rep", label: "Student Rep" },
    { id: "members", label: "Bulk Members" },
    { id: "leadership", label: "Bulk Leadership" },
    { id: "event_manager", label: "Event Manager" },
    { id: "member_mgmt", label: "Member Management" },
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
        {activeTab === "member_mgmt" && <MemberManagement supabase={supabase} societies={societies} />}
      </div>
    </div>
  );
}

function MemberManagement({ supabase, societies }: { supabase: any; societies: Society[] }) {
  const [tab, setTab] = useState<"bulk" | "single" | "roles">("bulk");
  return (
    <div className="space-y-5">
      <h3 className="text-xl font-medium mb-2 flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-[#00bfff]" /> Manage Members
      </h3>

      <div className="flex gap-2 border-b border-white/10 pb-3 overflow-x-auto">
        <TabBtn active={tab === "bulk"} onClick={() => setTab("bulk")}>Bulk Upload</TabBtn>
        <TabBtn active={tab === "single"} onClick={() => setTab("single")}>Add Individual</TabBtn>
        <TabBtn active={tab === "roles"} onClick={() => setTab("roles")}>Roles</TabBtn>
      </div>

      {tab === "bulk" && <BulkUploadV2 societies={societies} />}
      {tab === "single" && <AddIndividualV2 societies={societies} />}
      {tab === "roles" && <RoleManagementV2 supabase={supabase} />}
    </div>
  );
}

function TabBtn({ active, onClick, children }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
        active ? "bg-[#00629B] text-white" : "text-gray-400 hover:text-white hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}

const EXPECTED_HEADERS = ["Full Name", "Roll Number", "Email ID", "Role", "Society"];

function BulkUploadV2({ societies }: { societies: Society[] }) {
  const [societyDefault, setSocietyDefault] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<any>(null);

  const societyMap = new Map<string, string>();
  societies.forEach((s) => {
    societyMap.set(s.name.toLowerCase(), s.name);
    if (s.abbreviation) societyMap.set(s.abbreviation.toLowerCase(), s.name);
  });

  function validateRow(r: any) {
    const full_name = String(r["Full Name"] || "").trim();
    const roll_number = String(r["Roll Number"] || "").trim();
    const email = String(r["Email ID"] || "").trim().toLowerCase();
    const roleRaw = String(r["Role"] || "").trim().toLowerCase();
    const societyRaw = String(r["Society"] || "").trim();

    const society = societyRaw ? (societyMap.get(societyRaw.toLowerCase()) || societyRaw) : (societyDefault ? (societies.find(s => s.id === societyDefault)?.name || "") : "");
    const role = roleRaw === "leadership" ? "leadership" : roleRaw === "member" ? "member" : "";
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const societyOk = !!society;

    const missing = !full_name || !roll_number || !email || !role;
    if (missing || !emailOk || !societyOk) {
      return { ok: false, reason: missing ? "Missing required field" : (!emailOk ? "Invalid email" : "Invalid society"), parsed: { full_name, roll_number, email, role, society } };
    }
    return { ok: true, parsed: { full_name, roll_number, email, role, society } };
  }

  async function parseFile(f: File) {
    setResult(null);
    setRows([]);
    const ext = f.name.toLowerCase();
    if (!ext.endsWith(".xlsx") && !ext.endsWith(".csv")) {
      toast.error("Only .xlsx and .csv files are allowed");
      return;
    }
    if (!societyDefault) {
      toast.error("Please select a target society first");
      return;
    }
    const data = await f.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as any[];
    if (raw.length === 0) {
      toast.error("Empty file");
      return;
    }

    const headers = Object.keys(raw[0] || {}).map((h) => h.trim().toLowerCase());
    const expectedLower = EXPECTED_HEADERS.map((h) => h.toLowerCase());
    const okHeaders = expectedLower.every((h) => headers.includes(h));
    if (!okHeaders) {
      toast.error("Invalid file format. Please download the template and try again.");
      return;
    }

    const parsed = raw.map((r, idx) => {
      const v = validateRow(r);
      return {
        idx,
        raw: r,
        ...v,
        status: v.ok ? "valid" : "error",
      };
    });
    setRows(parsed);
  }

  async function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([EXPECTED_HEADERS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ieee_hub_bulk_template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  const summary = rows.reduce(
    (acc, r) => {
      if (r.status === "valid") acc.valid++;
      else acc.error++;
      return acc;
    },
    { valid: 0, error: 0 }
  );

  async function proceedValidOnly() {
    const valids = rows.filter((r) => r.status === "valid").map((r) => r.parsed);
    if (valids.length === 0) {
      toast.error("No valid rows to process");
      return;
    }
    setProcessing(true);
    setProgress({ done: 0, total: valids.length });
    try {
      // Chunk to keep request sizes sane
      const chunkSize = 25;
      const allResults: any[] = [];
      for (let i = 0; i < valids.length; i += chunkSize) {
        const chunk = valids.slice(i, i + chunkSize);
        const res = await fetch("/api/admin/bulk-create-users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: chunk }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Bulk create failed");
        allResults.push(...(json.results || []));
        setProgress({ done: Math.min(valids.length, i + chunk.length), total: valids.length });
      }
      setResult({ results: allResults });
      toast.success("Bulk processing completed");
    } catch (e: any) {
      toast.error(e.message || "Bulk processing failed");
    } finally {
      setProcessing(false);
    }
  }

  function downloadFailedReport() {
    const failed = (result?.results || []).filter((r: any) => !r.ok);
    if (failed.length === 0) return;
    const header = [...EXPECTED_HEADERS, "Failure Reason"];
    const lines = [
      header.join(","),
      ...failed.map((r: any) => {
        const row = r.row;
        const reason = r.reason || "Failed";
        return `"${row.full_name}","${row.roll_number}","${row.email}","${row.role}","${row.society || ""}","${reason}"`;
      }),
    ].join("\n");
    const blob = new Blob([lines], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `failed_rows_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Target Society *</label>
          <select className="input-field" value={societyDefault} onChange={(e) => setSocietyDefault(e.target.value)}>
            <option value="">Select society</option>
            {societies.map((s) => (
              <option key={s.id} value={s.id}>{s.abbreviation} — {s.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end justify-end">
          <button type="button" onClick={downloadTemplate} className="btn-secondary text-sm flex items-center gap-2">
            <Download className="w-4 h-4" /> Download Template
          </button>
        </div>
      </div>

      <label className="block border-2 border-dashed border-white/15 rounded-xl p-8 text-center hover:bg-white/[0.02] transition-colors cursor-pointer">
        <Upload className="w-8 h-8 mx-auto text-gray-500 mb-3" />
        <p className="text-sm text-gray-300">{file ? file.name : "Upload .xlsx or .csv"}</p>
        <p className="text-xs text-gray-500 mt-1">Columns: {EXPECTED_HEADERS.join(" · ")}</p>
        <input
          type="file"
          accept=".xlsx,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] || null;
            setFile(f);
            if (f) parseFile(f);
          }}
        />
      </label>

      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-gray-300">
              <b className="text-white">{summary.valid}</b> valid · <b className="text-amber-300">0</b> warnings ·{" "}
              <b className="text-red-400">{summary.error}</b> errors
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setFile(null); setRows([]); setResult(null); }} className="btn-secondary text-sm">
                Cancel
              </button>
              <button type="button" onClick={proceedValidOnly} disabled={processing} className="btn-primary text-sm">
                {processing ? "Processing..." : "Proceed with Valid Rows Only"}
              </button>
            </div>
          </div>

          {progress && (
            <p className="text-sm text-gray-400">
              Processing {progress.done} of {progress.total} members...
            </p>
          )}

          <div className="overflow-x-auto border border-white/5 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] border-b border-white/5">
                <tr>
                  <th className="text-left py-3 px-4 text-gray-400">Full Name</th>
                  <th className="text-left py-3 px-4 text-gray-400">Roll</th>
                  <th className="text-left py-3 px-4 text-gray-400">Email</th>
                  <th className="text-left py-3 px-4 text-gray-400">Role</th>
                  <th className="text-left py-3 px-4 text-gray-400">Society</th>
                  <th className="text-left py-3 px-4 text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.slice(0, 200).map((r) => (
                  <tr key={r.idx} className={r.status === "error" ? "bg-red-500/5" : ""}>
                    <td className="py-2.5 px-4 text-white">{r.parsed?.full_name || "—"}</td>
                    <td className="py-2.5 px-4 text-gray-300">{r.parsed?.roll_number || "—"}</td>
                    <td className="py-2.5 px-4 text-gray-300">{r.parsed?.email || "—"}</td>
                    <td className="py-2.5 px-4 text-gray-300">{r.parsed?.role || "—"}</td>
                    <td className="py-2.5 px-4 text-gray-300">{r.parsed?.society || "—"}</td>
                    <td className="py-2.5 px-4">
                      {r.status === "valid" ? (
                        <span className="text-green-400 font-semibold">✅ Valid</span>
                      ) : (
                        <span className="text-red-400 font-semibold">❌ {r.reason}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result && (
            <div className="glass-card p-4">
              <p className="text-sm text-gray-300">
                Completed. You can download any failures and re-upload.
              </p>
              <button type="button" onClick={downloadFailedReport} className="btn-secondary text-sm mt-3 flex items-center gap-2">
                <Download className="w-4 h-4" /> Download Failed Rows Report
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddIndividualV2({ societies }: { societies: Society[] }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ full_name: "", roll_number: "", email: "", phone: "", department: "", society_id: "", role: "member" as "member" | "leadership" });
  const [errs, setErrs] = useState<{ roll?: string; email?: string }>({});

  async function checkUnique(field: "roll" | "email") {
    if (field === "roll" && !form.roll_number) return;
    if (field === "email" && !form.email) return;
    const val = field === "roll" ? form.roll_number : form.email.toLowerCase();
    const { data } = await supabase.from("users").select("id").eq(field === "roll" ? "roll_number" : "email", val).maybeSingle();
    setErrs((p) => ({ ...p, [field]: data?.id ? `${field === "roll" ? "Roll number" : "Email"} already exists` : undefined }));
  }

  async function submit() {
    if (errs.roll || errs.email) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/bulk-create-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: [{
            full_name: form.full_name,
            roll_number: form.roll_number,
            email: form.email,
            role: form.role,
            society: societies.find(s => s.id === form.society_id)?.name || null,
            phone_number: form.phone,
            department: form.department,
          }],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Create failed");
      const ok = json.results?.[0]?.ok;
      if (!ok) throw new Error(json.results?.[0]?.reason || "Create failed");
      toast.success(`${form.full_name} has been added successfully as ${form.role}.`);
      setForm({ full_name: "", roll_number: "", email: "", phone: "", department: "", society_id: "", role: "member" });
    } catch (e: any) {
      toast.error(e.message || "Failed to add user");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Full Name *</label>
          <input className="input-field" value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Roll Number *</label>
          <input className="input-field" value={form.roll_number} onChange={(e) => setForm((p) => ({ ...p, roll_number: e.target.value }))} onBlur={() => checkUnique("roll")} />
          {errs.roll && <p className="text-xs text-red-400 mt-1">{errs.roll}</p>}
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Email ID *</label>
          <input className="input-field" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} onBlur={() => checkUnique("email")} />
          {errs.email && <p className="text-xs text-red-400 mt-1">{errs.email}</p>}
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Phone Number *</label>
          <input className="input-field" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Department *</label>
          <input className="input-field" value={form.department} onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Society *</label>
          <select className="input-field" value={form.society_id} onChange={(e) => setForm((p) => ({ ...p, society_id: e.target.value }))}>
            <option value="">Select society</option>
            {societies.map((s) => <option key={s.id} value={s.id}>{s.abbreviation} — {s.name}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm text-gray-400 mb-1.5">Role *</label>
          <select className="input-field" value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as any }))}>
            <option value="member">member</option>
            <option value="leadership">leadership</option>
          </select>
        </div>
      </div>

      <button type="button" disabled={loading} onClick={submit} className="btn-primary">
        {loading ? "Creating..." : "Add Member"}
      </button>
    </div>
  );
}

function RoleManagementV2({ supabase }: { supabase: any }) {
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "membership" | "leadership">("all");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);

  async function fetchRows() {
    setLoading(true);
    let query = supabase.from("users").select("id, full_name, name, roll_number, email, department, role").order("created_at", { ascending: false }).limit(200);
    if (roleFilter !== "all") query = query.eq("role", roleFilter);
    if (q.trim()) query = query.or(`full_name.ilike.%${q}%,name.ilike.%${q}%,roll_number.ilike.%${q}%,email.ilike.%${q}%`);
    const { data } = await query;
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => { fetchRows(); }, [q, roleFilter]);

  async function changeRole(u: any, next: "membership" | "leadership") {
    if (u.role === "admin_primary") {
      toast.error("Admin role cannot be changed here");
      return;
    }
    const ok = window.confirm(`Change ${u.full_name || u.name}'s role from ${u.role} to ${next}?`);
    if (!ok) return;
    const { error } = await supabase.from("users").update({ role: next }).eq("id", u.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Role updated");
    fetchRows();
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="block text-sm text-gray-400 mb-1.5">Search</label>
          <input className="input-field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, roll, email…" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Role filter</label>
          <select className="input-field" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as any)}>
            <option value="all">all</option>
            <option value="membership">member</option>
            <option value="leadership">leadership</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="h-32 glass-card animate-pulse" />
      ) : (
        <div className="overflow-x-auto border border-white/5 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] border-b border-white/5">
              <tr>
                <th className="text-left py-3 px-4 text-gray-400">Name</th>
                <th className="text-left py-3 px-4 text-gray-400">Roll</th>
                <th className="text-left py-3 px-4 text-gray-400">Email</th>
                <th className="text-left py-3 px-4 text-gray-400">Current Role</th>
                <th className="text-right py-3 px-4 text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((u) => (
                <tr key={u.id}>
                  <td className="py-3 px-4 text-white font-medium">{u.full_name || u.name || "—"}</td>
                  <td className="py-3 px-4 text-gray-300">{u.roll_number || "—"}</td>
                  <td className="py-3 px-4 text-gray-300">{u.email}</td>
                  <td className="py-3 px-4 text-gray-300">{u.role}</td>
                  <td className="py-3 px-4 text-right">
                    <select
                      className="input-field !w-40 inline-block"
                      value={u.role === "leadership" ? "leadership" : "membership"}
                      onChange={(e) => changeRole(u, e.target.value as any)}
                      disabled={u.role === "admin_primary"}
                    >
                      <option value="membership">member</option>
                      <option value="leadership">leadership</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
