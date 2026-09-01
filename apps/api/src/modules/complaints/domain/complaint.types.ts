export const complaintDepartments = [
  'electrical',
  'civil',
  'internet',
  'mess',
  'cleaning',
  'water',
  'cse',
  'ece',
  'metallurgy',
  'production',
] as const;
export const complaintPriorities = ['low', 'normal', 'high', 'urgent'] as const;
export const complaintStatuses = ['pending', 'assigned', 'in_progress', 'resolved', 'closed'] as const;

export type ComplaintDepartment = (typeof complaintDepartments)[number];
export type ComplaintPriority = (typeof complaintPriorities)[number];
export type ComplaintStatus = (typeof complaintStatuses)[number];

export interface ComplaintImage {
  publicId: string;
  url: string;
}

export interface ComplaintIntelligence {
  provider: 'gemini' | 'rules';
  summary: string;
  suggestedDepartment: ComplaintDepartment;
  suggestedPriority: ComplaintPriority;
  estimatedResolutionHours: number;
  duplicateCandidateIds: string[];
}
