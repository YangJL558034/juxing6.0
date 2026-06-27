export type LeaveDuration = 'full' | 'half';

export interface LeaveRequestFormData {
  employeeId: number | null;
  employeeName: string;
  idCard: string;
  phone: string;
  department: string;
  position: string;
  leaveDate: string;
  leaveStartDate: string;
  leaveEndDate: string;
  duration: LeaveDuration;
  halfDayPeriod: string;
  leaveType: string;
  reason: string;
  applicantSignatureDataUrl: string;
}

export interface LeaveRequestRecord extends LeaveRequestFormData {
  id: number;
  status: string;
  createdByName: string | null;
  reviewerName: string | null;
  reviewedAt: string | null;
  exportedAt: string | null;
  printedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
}
