export type Priority = "low" | "normal" | "high";
export type Status = "pending" | "in_progress" | "for_review" | "completed";
export type MeetingType = "Sales" | "Operation" | "Brief" | "Site Visit";
export type MeetingSentiment =
  | "very_poor"
  | "poor"
  | "acceptable"
  | "good"
  | "very_good";

export type ContactRef = {
  id: number | string;
  name: string;
  avatarUrl?: string | null;
};

export type ToDoStep = {
  id: number | string;
  title: string;
  collaborators: ContactRef[];
  dueAt: string;
  priority?: Priority;
  status: Status;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type Activity = {
  id: number | string;
  author: ContactRef;
  body: string;
  createdAt: string;
  attachments?: string[];
};

export type Message = {
  id: number | string;
  author: ContactRef | { id: number | string; name: string }; // you used a raw object once
  body: string;
  createdAt: string;
};

// Add below your MeetingSentiment export
export type MeetingNote = {
  id: number | string;
  body: string;
  author?: ContactRef | null;
  createdAt: string;
};

export type MeetingSummary = {
  brief: string; // short recap
  sentiment: MeetingSentiment; // 'very_poor' | 'poor' | 'acceptable' | 'good' | 'very_good'
  duration: number; // minutes (actual)
};

export type ToDo = {
  id: number | string;
  title: string;
  collaborators: ContactRef[];
  dueAt: string;
  priority?: Priority;
  important: boolean;
  status: Status;
  steps: ToDoStep[];
  notes?: string;
  activities: Activity[];
  messages?: Message[]; // <-- new, optional
  relatedTo?: { id: string | number; name: string; type: string } | null;
  goalId?: string | number | null;
  milestoneId?: string | number | null;
  createdAt: string;
  updatedAt: string;
};

export type Meeting = {
  id: number | string;
  subject: string;
  startAt: string; // ISO date-time
  duration: number; // minutes (planned)
  endAt: string; // ISO — computed from startAt + duration
  type: MeetingType;
  linkedTo?: Array<{ id: string | number; name: string }>;
  relatedTo?: { id: string | number; name: string; type: string } | null; // Job reference when created from job context
  location?: string;
  note?: string; // single quick note (optional)
  notes?: string[]; // multiple notes allowed
  attachments?: string[];
  requestedBy?: { id: string | number; name: string } | null;
  summary?: MeetingSummary;
  createdAt: string;
  updatedAt: string;
};
