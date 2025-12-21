export type JobFlag = "Low" | "Normal" | "High";
export type JobStage = "PRPSL" | "In Review" | "Project | In Progress" | "RFI";
export type JobType =
  | "Architecture"
  | "Interior"
  | "Architecture & Interior"
  | "Stands & Events"
  | "Master Plan"
  | "Full Scope"
  | "Internal"
  | "Other";
export interface JobStakeholder {
  id: number;
  contactId: number | null;
  role: string;
}
export interface JobMilestone {
  id: number;
  name: string;
  startDate?: string | null;
  dueDate?: string | null;
  priority: JobFlag;
  note?: string | null;
}
export interface JobGoal {
  id: number;
  milestoneId: number | null;
  name: string;
  startDate?: string | null;
  dueDate?: string | null;
  priority: JobFlag;
  note?: string | null;
}

export interface JobDocument {
  id: number;
  category?: string;
  type?: string;
  name: string;
  expiry?: string | null;
  expiryReminder?: boolean;
  note?: string;
  fileUrl?: string;
  createdAt?: string;
}

export interface JobProperties {
  id: number;
  name: string;
  code?: string | null;
  avatar?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  location?: string | null;
  stage: JobStage;
  type: JobType;
  flag: JobFlag;
  relatedTo?: number | null;
  collaborators: number[];
  note?: string | null;
  stakeholders: JobStakeholder[];
  milestones: JobMilestone[];
  goals: JobGoal[];
  documents?: JobDocument[];
  createdAt: string;
}
