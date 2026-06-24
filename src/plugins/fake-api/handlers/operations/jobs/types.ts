export type JobFlag = "Low" | "Normal" | "High";
export type JobStatus =
  | "New"
  | "Pending"
  | "In Progress"
  | "On Hold"
  | "Completed"
  | "Closed";
export type JobStage =
  | "PRPSL"
  | "In Review"
  | "Project | In Progress"
  | "RFI"
  | JobStatus;
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
  dateOverride?: boolean;
  priority: JobFlag;
  note?: string | null;
}
export interface JobGoal {
  id: number;
  milestoneId: number | null;
  name: string;
  startDate?: string | null;
  dueDate?: string | null;
  dateOverride?: boolean;
  priority: JobFlag;
  note?: string | null;
  source?: {
    dealItemId?: number | string | null;
    catalogueType?: string | null;
    periodKind?: "recurrent" | "retainer" | null;
    periodNumber?: number | null;
    totalPeriods?: number | null;
    periodLabel?: string | null;
    periodStartDate?: string | null;
    periodEndDate?: string | null;
    itemName?: string | null;
  } | null;
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
  jobOrderNumber?: string | null;
  name: string;
  code?: string | null;
  avatar?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  location?: string | null;
  stage: JobStage;
  status?: JobStatus;
  type: JobType;
  flag: JobFlag;
  relatedTo?: number | null;
  projectManagerId?: number | null;
  collaborators: number[];
  note?: string | null;
  stakeholders: JobStakeholder[];
  milestones: JobMilestone[];
  goals: JobGoal[];
  documents?: JobDocument[];
  stakeholderConnectionImportIds?: number[];
  statusAutomation?: {
    neverPrompt?: boolean;
    ignoredSuggestionKeys?: string[];
  } | null;
  createdAt: string;
}
