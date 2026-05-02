import React from "react";
import { DEPARTMENTS, CATEGORIES } from "./constants";
import { DetailsData } from "./types";
import { X, Plus, Clock, Calendar } from "lucide-react";

interface DetailsSectionProps {
  data: DetailsData;
  onChange: (data: DetailsData) => void;
  onBack: () => void;
  onNext: () => void;
}

export function DetailsSection({ data, onChange, onBack, onNext }: DetailsSectionProps) {
  const handleFieldChange = (key: keyof DetailsData, value: any) => {
    onChange({ ...data, [key]: value });
  };

  const addHostBlock = () => {
    onChange({ ...data, hosts: [...data.hosts, { name: "", department: "" }] });
  };

  const updateHostBlock = (index: number, key: "name" | "department", value: string) => {
    const newHosts = [...data.hosts];
    newHosts[index] = { ...newHosts[index], [key]: value };
    onChange({ ...data, hosts: newHosts });
  };

  const removeHostBlock = (index: number) => {
    if (data.hosts.length > 1) {
      const newHosts = data.hosts.filter((_, i) => i !== index);
      onChange({ ...data, hosts: newHosts });
    }
  };

  const subcategories = data.category ? CATEGORIES[data.category] || [] : [];

  const today = new Date().toISOString().split("T")[0];

  const isValid = 
    data.title.trim() !== "" &&
    data.hosts.every(h => h.name.trim() !== "" && h.department !== "") &&
    data.category !== "" &&
    data.subcategory !== "" &&
    data.eventDate !== "" &&
    data.startTime !== "" &&
    data.endTime !== "" &&
    data.regStartDate !== "" &&
    data.regStartTime !== "" &&
    data.regEndDate !== "" &&
    data.regEndTime !== "" &&
    data.description.trim() !== "" &&
    data.endTime > data.startTime &&
    `${data.regEndDate}T${data.regEndTime}` <= `${data.eventDate}T${data.startTime}` &&
    `${data.regStartDate}T${data.regStartTime}` < `${data.regEndDate}T${data.regEndTime}`;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--text-secondary)]">
          Event Title <span className="text-[var(--danger)]">*</span>
        </label>
        <input
          type="text"
          className="input-field"
          placeholder="Enter the full name of your event"
          value={data.title}
          onChange={(e) => handleFieldChange("title", e.target.value)}
          required
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-[var(--text-secondary)]">Host Information</label>
          <button
            type="button"
            onClick={addHostBlock}
            className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
          >
            <Plus className="w-3.5 h-3.5" /> Add Host
          </button>
        </div>

        {data.hosts.map((host, idx) => (
          <div key={idx} className="grid grid-cols-1 md:grid-cols-[1fr,1fr,auto] gap-4 items-end bg-[var(--bg-secondary)] p-4 rounded-xl relative border border-dashed border-[var(--border)]">
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--text-muted)]">Host Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="Full name of the organizer"
                value={host.name}
                onChange={(e) => updateHostBlock(idx, "name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--text-muted)]">Department</label>
              <select
                className="input-field"
                value={host.department}
                onChange={(e) => updateHostBlock(idx, "department", e.target.value)}
              >
                <option value="">Select Department</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            {data.hosts.length > 1 && (
              <button
                type="button"
                onClick={() => removeHostBlock(idx)}
                className="p-2.5 text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white rounded-lg transition-all"
                title="Remove"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--text-secondary)]">
            Category <span className="text-[var(--danger)]">*</span>
          </label>
          <select
            className="input-field"
            value={data.category}
            onChange={(e) => {
              handleFieldChange("category", e.target.value);
              handleFieldChange("subcategory", ""); // Reset subcategory
            }}
          >
            <option value="">Select event category</option>
            {Object.keys(CATEGORIES).map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--text-secondary)]">
            Subcategory <span className="text-[var(--danger)]">*</span>
          </label>
          <select
            className="input-field disabled:opacity-50"
            value={data.subcategory}
            onChange={(e) => handleFieldChange("subcategory", e.target.value)}
            disabled={!data.category}
          >
            <option value="">{data.category ? "Select subcategory" : "Select a category first"}</option>
            {subcategories.map((sub) => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        <label className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2">
          <Calendar className="w-4 h-4" /> Event Date & Time
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="date"
            className="input-field"
            min={today}
            value={data.eventDate}
            onChange={(e) => handleFieldChange("eventDate", e.target.value)}
          />
          <div className="relative">
            <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="time"
              className="input-field pl-10"
              value={data.startTime}
              onChange={(e) => handleFieldChange("startTime", e.target.value)}
            />
          </div>
          <div className="relative">
            <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="time"
              className="input-field pl-10"
              value={data.endTime}
              onChange={(e) => handleFieldChange("endTime", e.target.value)}
            />
          </div>
        </div>
        {data.startTime && data.endTime && data.endTime <= data.startTime && (
          <p className="text-xs text-[var(--danger)]">End time must be after start time</p>
        )}
      </div>

      <div className="space-y-4">
        <label className="text-sm font-medium text-[var(--text-secondary)]">Registration Period</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-[var(--text-muted)]">Registration Start</label>
            <div className="flex gap-2">
              <input
                type="date"
                className="input-field flex-1"
                value={data.regStartDate}
                onChange={(e) => handleFieldChange("regStartDate", e.target.value)}
              />
              <input
                type="time"
                className="input-field w-32"
                value={data.regStartTime}
                onChange={(e) => handleFieldChange("regStartTime", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-[var(--text-muted)]">Registration End</label>
            <div className="flex gap-2">
              <input
                type="date"
                className="input-field flex-1"
                value={data.regEndDate}
                onChange={(e) => handleFieldChange("regEndDate", e.target.value)}
              />
              <input
                type="time"
                className="input-field w-32"
                value={data.regEndTime}
                onChange={(e) => handleFieldChange("regEndTime", e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--text-secondary)]">
            Header (Optional)
          </label>
          <input
            type="text"
            maxLength={100}
            className="input-field"
            placeholder="Brief headline shown at the top of the event page"
            value={data.header}
            onChange={(e) => handleFieldChange("header", e.target.value)}
          />
          <p className="text-[10px] text-right text-[var(--text-muted)]">{data.header.length}/100</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--text-secondary)]">
            Footer (Optional)
          </label>
          <input
            type="text"
            maxLength={100}
            className="input-field"
            placeholder="Note or disclaimer shown at the bottom"
            value={data.footer}
            onChange={(e) => handleFieldChange("footer", e.target.value)}
          />
          <p className="text-[10px] text-right text-[var(--text-muted)]">{data.footer.length}/100</p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--text-secondary)]">
          Description <span className="text-[var(--danger)]">*</span>
        </label>
        <textarea
          rows={5}
          className="input-field min-h-[120px] resize-none"
          placeholder="Describe the event — its purpose, agenda, what attendees will learn or experience..."
          value={data.description}
          onChange={(e) => handleFieldChange("description", e.target.value)}
          required
        />
      </div>

      <div className="pt-4 flex justify-between items-center">
        <button
          type="button"
          onClick={onBack}
          className="btn-secondary px-8 py-2.5"
        >
          &larr; Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!isValid}
          className="btn-primary px-8 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next &rarr;
        </button>
      </div>
    </div>
  );
}
