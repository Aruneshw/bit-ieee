export interface HostData {
  society: string;
  contactEmail: string;
  coHosts: string[];
  coHostUrl: string;
}

export interface DetailsData {
  title: string;
  hosts: { name: string; department: string }[];
  category: string;
  subcategory: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  regStartDate: string;
  regStartTime: string;
  regEndDate: string;
  regEndTime: string;
  header: string;
  footer: string;
  description: string;
}

export interface VenueData {
  mode: "online" | "offline";
  online: {
    platform: string;
    link: string;
  };
  offline: {
    venue: string;
    requirements: string;
  };
}

export interface SpeakerData {
  prefix: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  email: string;
  city: string;
  state: string;
  country: string;
  url: string;
}

export interface ActivityFormData {
  activeSection: number;
  stage: "form" | "review" | "submitted";
  host: HostData;
  details: DetailsData;
  venue: VenueData;
  speakers: SpeakerData[];
}
