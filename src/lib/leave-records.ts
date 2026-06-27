import type { LeaveDuration, LeaveRequestFormData, LeaveRequestRecord } from '@/types/leave-request';

export interface LeaveRequestDbRow {
  id: number;
  status: string | null;
  employee_id: number | null;
  employee_name: string | null;
  id_card: string | null;
  phone: string | null;
  department: string | null;
  position: string | null;
  leave_date: string | null;
  leave_start_date: string | null;
  leave_end_date: string | null;
  duration: LeaveDuration | string | null;
  half_day_period: string | null;
  leave_type: string | null;
  reason: string | null;
  applicant_signature_data_url: string | null;
  created_by_name: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  exported_at: string | null;
  printed_at: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

export function normalizeLeaveDuration(value: unknown): LeaveDuration {
  return text(value) === 'half' ? 'half' : 'full';
}

export function normalizeLeaveRequestData(value: unknown): LeaveRequestFormData {
  const data = typeof value === 'object' && value ? value as Partial<LeaveRequestFormData> : {};
  const duration = normalizeLeaveDuration(data.duration);
  const leaveStartDate = text(data.leaveStartDate || data.leaveDate);
  const leaveEndDate = text(data.leaveEndDate || data.leaveStartDate || data.leaveDate);

  return {
    employeeId: data.employeeId ? Number(data.employeeId) : null,
    employeeName: text(data.employeeName),
    idCard: text(data.idCard),
    phone: text(data.phone),
    department: text(data.department),
    position: text(data.position),
    leaveDate: leaveStartDate,
    leaveStartDate,
    leaveEndDate,
    duration,
    halfDayPeriod: duration === 'half' ? text(data.halfDayPeriod) || '上午' : '',
    leaveType: text(data.leaveType) || '事假',
    reason: text(data.reason),
    applicantSignatureDataUrl: text(data.applicantSignatureDataUrl),
  };
}

export function parseLeaveRequestRow(row: LeaveRequestDbRow): LeaveRequestRecord {
  const leaveStartDate = row.leave_start_date || row.leave_date || '';
  const leaveEndDate = row.leave_end_date || leaveStartDate;

  return {
    id: row.id,
    status: row.status || '待审核',
    employeeId: row.employee_id,
    employeeName: row.employee_name || '',
    idCard: row.id_card || '',
    phone: row.phone || '',
    department: row.department || '',
    position: row.position || '',
    leaveDate: row.leave_date || leaveStartDate,
    leaveStartDate,
    leaveEndDate,
    duration: normalizeLeaveDuration(row.duration),
    halfDayPeriod: row.half_day_period || '',
    leaveType: row.leave_type || '事假',
    reason: row.reason || '',
    applicantSignatureDataUrl: row.applicant_signature_data_url || '',
    createdByName: row.created_by_name,
    reviewerName: row.reviewer_name,
    reviewedAt: row.reviewed_at,
    exportedAt: row.exported_at,
    printedAt: row.printed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function formatLeaveDuration(duration: LeaveDuration, halfDayPeriod?: string) {
  if (duration === 'half') {
    return halfDayPeriod ? `半天（${halfDayPeriod}）` : '半天';
  }
  return '全天';
}

export function formatAttendanceLeaveLabel(duration: LeaveDuration) {
  return duration === 'half' ? '请假半天' : '请假';
}

export function formatLeaveDateRange(record: Pick<LeaveRequestRecord, 'leaveDate' | 'leaveStartDate' | 'leaveEndDate'>) {
  const start = record.leaveStartDate || record.leaveDate;
  const end = record.leaveEndDate || start;
  if (!start) return '-';
  return start === end ? start : `${start} 至 ${end}`;
}

export function isDateInLeaveRange(record: Pick<LeaveRequestRecord, 'leaveDate' | 'leaveStartDate' | 'leaveEndDate'>, date: string) {
  const start = record.leaveStartDate || record.leaveDate;
  const end = record.leaveEndDate || start;
  return Boolean(start && end && date >= start && date <= end);
}

export function isLeaveRangeOverlappingMonth(record: Pick<LeaveRequestRecord, 'leaveDate' | 'leaveStartDate' | 'leaveEndDate'>, year: number, month: number) {
  const start = record.leaveStartDate || record.leaveDate;
  const end = record.leaveEndDate || start;
  if (!start || !end) return false;
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  return start <= monthEnd && end >= monthStart;
}
