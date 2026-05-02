import React from "react";
import { VenueData } from "./types";
import { Globe, MapPin } from "lucide-react";

interface VenueSectionProps {
  data: VenueData;
  onChange: (data: VenueData) => void;
  onBack: () => void;
  onNext: () => void;
}

export function VenueSection({ data, onChange, onBack, onNext }: VenueSectionProps) {
  const handleModeChange = (mode: "online" | "offline") => {
    onChange({ ...data, mode });
  };

  const handleOnlineChange = (key: "platform" | "link", value: string) => {
    onChange({
      ...data,
      online: { ...data.online, [key]: value },
    });
  };

  const handleOfflineChange = (key: "venue" | "requirements", value: string) => {
    onChange({
      ...data,
      offline: { ...data.offline, [key]: value },
    });
  };

  const isValid = data.mode === "online" 
    ? data.online.platform.trim() !== "" && data.online.link.trim() !== ""
    : data.offline.venue.trim() !== "";

  return (
    <div className="space-y-6">
      <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border)] w-fit mx-auto sm:mx-0">
        <button
          type="button"
          onClick={() => handleModeChange("online")}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
            data.mode === "online"
              ? "bg-[var(--accent-primary)] text-white shadow-md"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          <Globe className="w-4 h-4" /> Online
        </button>
        <button
          type="button"
          onClick={() => handleModeChange("offline")}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
            data.mode === "offline"
              ? "bg-[var(--accent-primary)] text-white shadow-md"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          <MapPin className="w-4 h-4" /> Offline
        </button>
      </div>

      <div className="animate-in fade-in slide-in-from-top-2 duration-300">
        {data.mode === "online" ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                Platform <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Google Meet, Zoom, Microsoft Teams"
                value={data.online.platform}
                onChange={(e) => handleOnlineChange("platform", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                Platform Link <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                type="url"
                className="input-field"
                placeholder="Paste the meeting link here"
                value={data.online.link}
                onChange={(e) => handleOnlineChange("link", e.target.value)}
                required
              />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                Preferred Venue <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Seminar Hall A, Main Auditorium, Lab 302"
                value={data.offline.venue}
                onChange={(e) => handleOfflineChange("venue", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                Requirements Description (Optional)
              </label>
              <textarea
                rows={3}
                className="input-field resize-none"
                placeholder="List any setup or equipment needed — projector, microphone, chairs, etc."
                value={data.offline.requirements}
                onChange={(e) => handleOfflineChange("requirements", e.target.value)}
              />
            </div>
          </div>
        )}
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
