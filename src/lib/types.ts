export type UserRole = 'admin_primary' | 'admin_secondary' | 'student_rep' | 'leadership' | 'membership' | 'event_manager'

export interface UserProfile {
  id: string
  email: string
  name: string | null
  full_name: string | null
  role: UserRole
  society_id: string | null
  // Personal info
  dob: string | null
  gender: 'Male' | 'Female' | 'Prefer not to say' | null
  mobile: string | null
  personal_email: string | null
  // Academic
  department: string | null
  year: '1st' | '2nd' | '3rd' | '4th' | null
  roll_number: string | null
  // Online presence
  github: string | null
  linkedin: string | null
  portfolio: string | null
  // Skills
  primary_skills: string | null
  secondary_skills: string | null
  // Bio
  bio: string | null
  // Status
  profile_completed: boolean
  activity_points: number
  avatar_url: string | null
  created_at: string
  updated_at: string
  society?: Society | null
}

export interface Society {
  id: string
  name: string
  abbreviation: string | null
  department: string | null
  total_members: number
  created_at: string
}

export interface Event {
  id: string
  name: string
  description: string | null
  society_id: string
  organiser_id: string
  skill_type: 'primary' | 'secondary' | null
  selected_skill: string | null
  event_type: 'hardware' | 'software' | null
  status: 'pending' | 'approved' | 'rejected'
  date: string | null
  venue: string | null
  photo_proof: string | null
  students_attended: number
  booking_enabled: boolean
  created_at: string
  society?: Society
  organiser?: UserProfile
}

export interface ActivityPoint {
  id: string
  user_id: string
  event_id: string | null
  points: number
  event_name: string | null
  organised_by: string | null
  organiser_email: string | null
  date: string | null
  created_at: string
}

export interface Task {
  id: string
  event_id: string
  type: 'mcq' | 'coding'
  otp: string | null
  otp_expires_at: string | null
  questions: Question[]
  created_by: string
  created_at: string
  event?: Event
}

export interface Question {
  id: string
  text: string
  options?: string[]
  correct_answer?: string | number
  points: number
}

export interface TaskSubmission {
  id: string
  task_id: string
  user_id: string
  answers: unknown[]
  score: number
  completed: boolean
  submitted_at: string
  user?: UserProfile
  task?: Task
}

export interface Post {
  id: string
  society_id: string
  author_id: string
  content: string | null
  media_url: string | null
  likes_count: number
  created_at: string
  author?: UserProfile
  interactions?: PostInteraction[]
}

export interface PostInteraction {
  id: string
  post_id: string
  user_id: string
  type: 'like' | 'comment'
  comment_text: string | null
  created_at: string
  user?: UserProfile
}

export interface Notification {
  id: string
  recipient_role: string | null
  recipient_id: string | null
  society_id: string | null
  title: string | null
  message: string
  type: 'info' | 'event_request' | 'approval' | 'rejection' | 'announcement'
  read: boolean
  sent_by: string | null
  created_at: string
}

export interface Resume {
  id: string
  user_id: string
  personal_info: Record<string, string>
  online_presence: Record<string, string>
  skills: Record<string, string[]>
  bio: string | null
  society: string | null
  events_attended: ResumeItem[]
  certificates: ResumeItem[]
  projects: ResumeItem[]
  hackathons: ResumeItem[]
  publications: ResumeItem[]
  pdf_url: string | null
  last_updated: string
}

export interface ResumeItem {
  title: string
  description: string
  date: string
  link?: string
}

// Constants
export const DEPARTMENTS = [
  'CSE', 'AIML', 'Cyber Security', 'ECE', 'EEE', 'Mechanical',
  'Civil', 'IT', 'AIDS', 'MCE', 'Chemical', 'Biomedical',
] as const

export const SKILL_OPTIONS = [
  'Python', 'Java', 'C/C++', 'JavaScript', 'TypeScript', 'React', 'Next.js',
  'Node.js', 'Flutter', 'Dart', 'IoT', 'VLSI', 'Robotics', 'Machine Learning',
  'Deep Learning', 'AI', 'Data Science', 'Computer Vision', 'NLP', 'Cloud Computing',
  'AWS', 'Docker', 'Kubernetes', 'Embedded Systems', 'Arduino', 'Raspberry Pi',
  'PCB Design', 'MATLAB', 'Power Systems', 'Control Systems', 'Signal Processing',
  'Web Development', 'Mobile Development', 'Blockchain', 'Cybersecurity',
  'Database Management', 'SQL', 'MongoDB', 'Git', 'Linux', 'Figma',
] as const

// Role hierarchy helpers
export const ADMIN_ROLES: UserRole[] = ['admin_primary', 'admin_secondary']
export const ADMIN_PRIMARY_EMAILS = ['bitieeehubadmin1@gmail.com', 'bitieeehubadmin2@gmail.com']
export const ADMIN_SECONDARY_EMAILS = ['bitieeehubadmin3@gmail.com', 'bitieeehubadmin4@gmail.com']
export const ALL_ADMIN_EMAILS = [...ADMIN_PRIMARY_EMAILS, ...ADMIN_SECONDARY_EMAILS]

export function isAdmin(role: UserRole) {
  return ADMIN_ROLES.includes(role)
}

export function isPrimaryAdmin(role: UserRole) {
  return role === 'admin_primary'
}

export function needsProfileCompletion(role: UserRole) {
  return ['leadership', 'membership'].includes(role)
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    admin_primary: 'Primary Admin',
    admin_secondary: 'Secondary Admin',
    student_rep: 'Student Rep',
    leadership: 'Leadership',
    membership: 'Member',
    event_manager: 'Event Manager',
  }
  return labels[role] || role
}

export function getRoleColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    admin_primary: 'bg-red-500/20 text-red-400 border-red-500/30',
    admin_secondary: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    student_rep: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    leadership: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    membership: 'bg-green-500/20 text-green-400 border-green-500/30',
    event_manager: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  }
  return colors[role] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
}

export function getRoleDashboardPath(role: UserRole): string {
  switch (role) {
    case 'admin_primary':
    case 'admin_secondary': return '/admin/dashboard'
    case 'student_rep': return '/rep/dashboard'
    case 'leadership': return '/leadership/dashboard'
    case 'event_manager': return '/leadership/dashboard'
    case 'membership': return '/member/dashboard'
    default: return '/member/dashboard'
  }
}
