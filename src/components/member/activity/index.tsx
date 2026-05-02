import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSessionProfile } from "@/components/session-profile-provider";
import { toast } from "sonner";
import { AccordionSection } from "./accordion-section";
import { HostSection } from "./host-section";
import { DetailsSection } from "./details-section";
import { VenueSection } from "./venue-section";
import { SpeakersSection } from "./speakers-section";
import { ReviewPage } from "./review-page";
import { ActivityFormData } from "./types";

interface CreateActivityFormProps {
  onSuccess: () => void;
}

const INITIAL_STATE: ActivityFormData = {
  activeSection: 0,
  stage: "form",
  host: {
    society: "",
    contactEmail: "",
    coHosts: [],
    coHostUrl: ""
  },
  details: {
    title: "",
    hosts: [{ name: "", department: "" }],
    category: "",
    subcategory: "",
    eventDate: "",
    startTime: "",
    endTime: "",
    regStartDate: "",
    regStartTime: "",
    regEndDate: "",
    regEndTime: "",
    header: "",
    footer: "",
    description: ""
  },
  venue: {
    mode: "online",
    online: {
      platform: "",
      link: ""
    },
    offline: {
      venue: "",
      requirements: ""
    }
  },
  speakers: [
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
      url: ""
    }
  ]
};

export function CreateActivityForm({ onSuccess }: CreateActivityFormProps) {
  const supabase = createClient();
  const { profile } = useSessionProfile();
  
  const [state, setState] = useState<ActivityFormData>(INITIAL_STATE);
  const [completedSections, setCompletedSections] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // Auto-populate primary host if profile is available
  useEffect(() => {
    if (profile && !state.details.hosts[0].name) {
      setState(prev => ({
        ...prev,
        details: {
          ...prev.details,
          hosts: [{ 
            name: profile.full_name || profile.name || "", 
            department: (profile as any).department || "" 
          }]
        }
      }));
    }
  }, [profile]);

  const toggleSection = (index: number) => {
    // Section locking logic: only allow opening if previous sections are completed OR it's the next section
    const maxAllowed = completedSections.size >= index ? index : -1;
    if (maxAllowed !== -1) {
      setState(prev => ({ ...prev, activeSection: index }));
    } else {
      toast.info("Please complete the previous sections first.");
    }
  };

  const markCompleted = (index: number) => {
    setCompletedSections(prev => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  };

  const handleNext = (currentIndex: number) => {
    markCompleted(currentIndex);
    setState(prev => ({ ...prev, activeSection: currentIndex + 1 }));
  };

  const handleBack = (currentIndex: number) => {
    setState(prev => ({ ...prev, activeSection: currentIndex - 1 }));
  };

  const handleFinalSave = async () => {
    if (!profile?.id) return;
    setSubmitting(true);

    try {
      // Compile entire state into structured object
      const payload = {
        name: state.details.title,
        short_description: state.details.description.slice(0, 100),
        detailed_description: state.details.description,
        society_id: (profile as any).society_id || null,
        organiser_id: profile.id,
        status: "pending",
        
        // Form details
        event_date: state.details.eventDate,
        start_time: state.details.startTime,
        end_time: state.details.endTime,
        
        // Metadata (jsonb in DB if available, or flat fields)
        organizer_name: state.details.hosts[0].name,
        organizer_department: state.details.hosts[0].department,
        
        // We can store the rest of the rich data in a metadata column if it exists
        // For now, mapping to existing flat fields
        venue: state.venue.mode === "online" ? `Online: ${state.venue.online.platform}` : state.venue.offline.venue,
      };

      const { error } = await supabase.from("events").insert(payload);
      if (error) throw error;

      toast.success("Your activity has been registered and is pending approval.");
      
      // Delay success to show toast
      setTimeout(() => {
        onSuccess();
      }, 1500);

    } catch (err: any) {
      toast.error(err.message || "Failed to save activity");
      setSubmitting(false);
    }
  };

  if (state.stage === "review") {
    return (
      <ReviewPage 
        data={state} 
        onEdit={(section) => setState(prev => ({ ...prev, stage: "form", activeSection: section }))} 
        onFinalSave={handleFinalSave}
        submitting={submitting}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Section 1: Host */}
      <AccordionSection
        title="1. Host"
        isOpen={state.activeSection === 0}
        onToggle={() => toggleSection(0)}
        isCompleted={completedSections.has(0)}
      >
        <HostSection 
          data={state.host} 
          onChange={(host) => setState(prev => ({ ...prev, host }))}
          onNext={() => handleNext(0)}
        />
      </AccordionSection>

      {/* Section 2: Details */}
      <AccordionSection
        title="2. Details"
        isOpen={state.activeSection === 1}
        onToggle={() => toggleSection(1)}
        isCompleted={completedSections.has(1)}
        isLocked={!completedSections.has(0) && state.activeSection !== 1}
      >
        <DetailsSection 
          data={state.details} 
          onChange={(details) => setState(prev => ({ ...prev, details }))}
          onBack={() => handleBack(1)}
          onNext={() => handleNext(1)}
        />
      </AccordionSection>

      {/* Section 3: Venue */}
      <AccordionSection
        title="3. Venue"
        isOpen={state.activeSection === 2}
        onToggle={() => toggleSection(2)}
        isCompleted={completedSections.has(2)}
        isLocked={!completedSections.has(1) && state.activeSection !== 2}
      >
        <VenueSection 
          data={state.venue} 
          onChange={(venue) => setState(prev => ({ ...prev, venue }))}
          onBack={() => handleBack(2)}
          onNext={() => handleNext(2)}
        />
      </AccordionSection>

      {/* Section 4: Speakers */}
      <AccordionSection
        title="4. Speakers"
        isOpen={state.activeSection === 3}
        onToggle={() => toggleSection(3)}
        isCompleted={completedSections.has(3)}
        isLocked={!completedSections.has(2) && state.activeSection !== 3}
      >
        <SpeakersSection 
          data={state.speakers} 
          onChange={(speakers) => setState(prev => ({ ...prev, speakers }))}
          onBack={() => handleBack(3)}
          onSave={() => {
            markCompleted(3);
            setState(prev => ({ ...prev, stage: "review" }));
          }}
        />
      </AccordionSection>
    </div>
  );
}
