import React from "react";
import { ActivityFormData } from "./types";
import { Building2, FileText, MapPin, Users, Edit3 } from "lucide-react";

interface ReviewPageProps {
  data: ActivityFormData;
  onEdit: (sectionIndex: number) => void;
  onFinalSave: () => void;
  submitting: boolean;
}

export function ReviewPage({ data, onEdit, onFinalSave, submitting }: ReviewPageProps) {
  const { host, details, venue, speakers } = data;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Review Activity</h2>
        <p className="text-sm text-[var(--text-secondary)]">Please check all details before submitting</p>
      </div>

      <div className="space-y-4">
        {/* Host Summary */}
        <ReviewCard
          title="Host"
          icon={<Building2 className="w-5 h-5" />}
          onEdit={() => onEdit(0)}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8">
            <InfoItem label="Society" value={host.society} />
            <InfoItem label="Contact Email" value={host.contactEmail} />
            {host.coHosts.length > 0 && (
              <InfoItem label="Co-Hosts" value={host.coHosts.join(", ")} />
            )}
            {host.coHostUrl && (
              <InfoItem label="Co-Host URL" value={host.coHostUrl} isLink />
            )}
          </div>
        </ReviewCard>

        {/* Details Summary */}
        <ReviewCard
          title="Details"
          icon={<FileText className="w-5 h-5" />}
          onEdit={() => onEdit(1)}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8">
            <InfoItem label="Event Title" value={details.title} className="md:col-span-2" />
            <InfoItem label="Category" value={`${details.category} → ${details.subcategory}`} />
            <InfoItem label="Event Date" value={`${details.eventDate} (${details.startTime} - ${details.endTime})`} />
            <InfoItem label="Registration" value={`${details.regStartDate} ${details.regStartTime} to ${details.regEndDate} ${details.regEndTime}`} />
            {details.header && <InfoItem label="Header" value={details.header} />}
            {details.footer && <InfoItem label="Footer" value={details.footer} />}
            <div className="md:col-span-2 space-y-1">
              <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-tight">Hosts</p>
              <div className="flex flex-wrap gap-2">
                {details.hosts.map((h, i) => (
                  <span key={i} className="px-3 py-1 bg-[var(--bg-secondary)] rounded-full text-xs font-medium border border-[var(--border)]">
                    {h.name} ({h.department})
                  </span>
                ))}
              </div>
            </div>
            <div className="md:col-span-2 space-y-1">
              <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-tight">Description</p>
              <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">{details.description}</p>
            </div>
          </div>
        </ReviewCard>

        {/* Venue Summary */}
        <ReviewCard
          title="Venue"
          icon={<MapPin className="w-5 h-5" />}
          onEdit={() => onEdit(2)}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8">
            <InfoItem label="Mode" value={venue.mode.toUpperCase()} />
            {venue.mode === "online" ? (
              <>
                <InfoItem label="Platform" value={venue.online.platform} />
                <InfoItem label="Link" value={venue.online.link} isLink className="md:col-span-2" />
              </>
            ) : (
              <>
                <InfoItem label="Preferred Venue" value={venue.offline.venue} />
                {venue.offline.requirements && (
                  <InfoItem label="Requirements" value={venue.offline.requirements} className="md:col-span-2" />
                )}
              </>
            )}
          </div>
        </ReviewCard>

        {/* Speakers Summary */}
        <ReviewCard
          title="Speakers"
          icon={<Users className="w-5 h-5" />}
          onEdit={() => onEdit(3)}
        >
          <div className="space-y-4">
            {speakers.map((s, i) => (
              <div key={i} className="p-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)]">
                <p className="text-sm font-bold text-[var(--text-primary)] mb-2">Speaker {i + 1}: {s.prefix} {s.firstName} {s.middleName} {s.lastName} {s.suffix}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-8 text-xs">
                  <InfoItem label="Email" value={s.email} />
                  {(s.city || s.state || s.country) && (
                    <InfoItem label="Location" value={[s.city, s.state, s.country].filter(Boolean).join(", ")} />
                  )}
                  {s.url && <InfoItem label="URL" value={s.url} isLink />}
                </div>
              </div>
            ))}
          </div>
        </ReviewCard>
      </div>

      <div className="pt-6">
        <button
          type="button"
          onClick={onFinalSave}
          disabled={submitting}
          className="btn-primary w-full py-4 text-lg font-bold shadow-xl shadow-[var(--accent-primary)]/30 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
        >
          {submitting ? "Saving Activity..." : "Save Activity"}
        </button>
      </div>
    </div>
  );
}

function ReviewCard({ title, icon, onEdit, children }: { title: string; icon: React.ReactNode; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="glass-card p-6 border border-[var(--border)]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3 text-[var(--accent-primary)]">
          <div className="p-2 bg-[var(--accent-primary)]/10 rounded-lg">
            {icon}
          </div>
          <h3 className="font-bold text-lg">{title}</h3>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors uppercase tracking-widest"
        >
          <Edit3 className="w-3.5 h-3.5" /> Edit
        </button>
      </div>
      {children}
    </div>
  );
}

function InfoItem({ label, value, isLink, className = "" }: { label: string; value: string; isLink?: boolean; className?: string }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tight">{label}</p>
      {isLink ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--accent-primary)] hover:underline break-all font-medium">
          {value}
        </a>
      ) : (
        <p className="text-sm text-[var(--text-primary)] font-medium">{value || "—"}</p>
      )}
    </div>
  );
}
