import React from "react";
import { ChevronDown, ChevronUp, CheckCircle2, Circle } from "lucide-react";

interface AccordionSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  isCompleted: boolean;
  isLocked?: boolean;
  children: React.ReactNode;
}

export function AccordionSection({
  title,
  isOpen,
  onToggle,
  isCompleted,
  isLocked = false,
  children,
}: AccordionSectionProps) {
  return (
    <div 
      className={`border rounded-xl overflow-hidden mb-4 transition-all ${
        isLocked ? "opacity-50 pointer-events-none grayscale" : ""
      }`}
      style={{ 
        borderColor: isOpen ? "var(--accent-primary)" : "var(--border)",
        background: "var(--bg-card)"
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-[var(--bg-secondary)] transition-colors"
      >
        <div className="flex items-center gap-3">
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-[var(--success)]" />
          ) : (
            <Circle className="w-5 h-5 text-[var(--text-muted)]" />
          )}
          <span className="font-semibold text-[var(--text-primary)]">{title}</span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-[var(--text-muted)]" />
        ) : (
          <ChevronDown className="w-5 h-5 text-[var(--text-muted)]" />
        )}
      </button>
      
      {isOpen && (
        <div className="p-6 border-t" style={{ borderColor: "var(--border)" }}>
          {children}
        </div>
      )}
    </div>
  );
}
