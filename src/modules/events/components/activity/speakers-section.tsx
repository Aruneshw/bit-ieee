import React from "react";
import { PREFIXES } from "./constants";
import { SpeakerData } from "./types";
import { X, Plus, UserCircle2 } from "lucide-react";

interface SpeakersSectionProps {
  data: SpeakerData[];
  onChange: (data: SpeakerData[]) => void;
  onBack: () => void;
  onSave: () => void;
}

export function SpeakersSection({ data, onChange, onBack, onSave }: SpeakersSectionProps) {
  const addSpeaker = () => {
    onChange([
      ...data,
      {
        prefix: "",
        firstName: "",
        middleName: "",
        lastName: "",
        suffix: "",
        email: "",
        city: "",
        state: "",
        country: "",
        url: "",
      },
    ]);
  };

  const updateSpeaker = (index: number, key: keyof SpeakerData, value: string) => {
    const newSpeakers = [...data];
    newSpeakers[index] = { ...newSpeakers[index], [key]: value };
    onChange(newSpeakers);
  };

  const removeSpeaker = (index: number) => {
    if (data.length > 1) {
      const newSpeakers = data.filter((_, i) => i !== index);
      onChange(newSpeakers);
    }
  };

  const isValid = data.every(s => 
    s.firstName.trim() !== "" && 
    s.lastName.trim() !== "" && 
    s.email.trim() !== "" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-[var(--text-secondary)]">Speakers</label>
        <button
          type="button"
          onClick={addSpeaker}
          className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
        >
          <Plus className="w-3.5 h-3.5" /> Add Speaker
        </button>
      </div>

      <div className="space-y-6">
        {data.map((speaker, idx) => (
          <div key={idx} className="glass-card p-6 border border-[var(--border)] relative animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 text-[var(--accent-primary)]">
                <UserCircle2 className="w-5 h-5" />
                <span className="font-bold text-sm uppercase tracking-wider">Speaker {idx + 1}</span>
              </div>
              {data.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSpeaker(idx)}
                  className="text-xs font-semibold text-[var(--danger)] hover:underline flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Remove Speaker
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-[var(--text-muted)]">Prefix</label>
                <select
                  className="input-field"
                  value={speaker.prefix}
                  onChange={(e) => updateSpeaker(idx, "prefix", e.target.value)}
                >
                  <option value="">None</option>
                  {PREFIXES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-1 space-y-2">
                <label className="text-xs font-medium text-[var(--text-muted)]">
                  First Name <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="First name"
                  value={speaker.firstName}
                  onChange={(e) => updateSpeaker(idx, "firstName", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-[var(--text-muted)]">Middle Name</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Middle name"
                  value={speaker.middleName}
                  onChange={(e) => updateSpeaker(idx, "middleName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-[var(--text-muted)]">
                  Last Name <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Last name"
                  value={speaker.lastName}
                  onChange={(e) => updateSpeaker(idx, "lastName", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-[var(--text-muted)]">Suffix</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Jr., PhD"
                  value={speaker.suffix}
                  onChange={(e) => updateSpeaker(idx, "suffix", e.target.value)}
                />
              </div>
              <div className="md:col-span-3 space-y-2">
                <label className="text-xs font-medium text-[var(--text-muted)]">
                  Email ID <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="speaker@example.com"
                  value={speaker.email}
                  onChange={(e) => updateSpeaker(idx, "email", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-[var(--text-muted)]">City</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="City"
                  value={speaker.city}
                  onChange={(e) => updateSpeaker(idx, "city", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-[var(--text-muted)]">State</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="State"
                  value={speaker.state}
                  onChange={(e) => updateSpeaker(idx, "state", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-[var(--text-muted)]">Country</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Country"
                  value={speaker.country}
                  onChange={(e) => updateSpeaker(idx, "country", e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <label className="text-xs font-medium text-[var(--text-muted)]">URL (LinkedIn/Personal)</label>
              <input
                type="url"
                className="input-field"
                placeholder="LinkedIn profile or personal website"
                value={speaker.url}
                onChange={(e) => updateSpeaker(idx, "url", e.target.value)}
              />
            </div>
          </div>
        ))}
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
          onClick={onSave}
          disabled={!isValid}
          className="btn-primary flex items-center gap-2 px-8 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[var(--accent-primary)]/20"
        >
          Save & Continue &rarr;
        </button>
      </div>
    </div>
  );
}
