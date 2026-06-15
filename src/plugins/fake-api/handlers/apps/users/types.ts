export interface UserProperties {
  id: number;
  centerId?: string;
  employeeId?: number | string | null;
  personId?: number | string | null;
  fullName: string;
  company: string;
  role: string;
  roleId?: string;
  username?: string;
  country: string;
  contact: string;
  email: string;
  currentPlan: string;
  status: string;
  avatar?: string | null;
  billing: string;
  temporaryPassword?: boolean;
  isMaster?: boolean;
}
