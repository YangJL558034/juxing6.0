import type { DormitoryApplicationData, DormitoryRecord, DormitoryStatus } from '@/types/dormitory';

export interface DormitoryDbRow {
  id: number;
  status: DormitoryStatus;
  name: string;
  phone: string | null;
  department: string | null;
  position: string | null;
  id_card: string | null;
  expected_check_in_date: string | null;
  reason: string | null;
  data_json: string;
  reviewer_name: string | null;
  review_opinion: string | null;
  reviewed_at: string | null;
  room_no: string | null;
  bed_no: string | null;
  room_bed: string | null;
  key_issued: string | null;
  handler_name: string | null;
  checked_in_at: string | null;
  checkout_apply_date: string | null;
  move_out_date: string | null;
  checkout_reason: string | null;
  key_returned: string | null;
  checkout_handler_name: string | null;
  checked_out_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export const defaultDormitoryData: DormitoryApplicationData = {
  name: '',
  phone: '',
  department: '',
  position: '',
  idCard: '',
  expectedCheckInDate: '',
  reason: '',
  agreedToRules: false,
  submittedDate: '',
};

export function normalizeDormitoryData(value: unknown): DormitoryApplicationData {
  const data = typeof value === 'object' && value ? value as Partial<DormitoryApplicationData> : {};
  return {
    ...defaultDormitoryData,
    ...data,
    name: String(data.name || '').trim(),
    phone: String(data.phone || '').trim(),
    department: String(data.department || '').trim(),
    position: String(data.position || '').trim(),
    idCard: String(data.idCard || '').trim(),
    expectedCheckInDate: String(data.expectedCheckInDate || '').trim(),
    reason: String(data.reason || '').trim(),
    submittedDate: String(data.submittedDate || '').trim(),
    agreedToRules: Boolean(data.agreedToRules),
  };
}

export function parseDormitoryRow(row: DormitoryDbRow): DormitoryRecord {
  let parsed: unknown = {};
  try {
    parsed = JSON.parse(row.data_json || '{}');
  } catch {
    parsed = {};
  }

  const data = normalizeDormitoryData(parsed);

  return {
    id: row.id,
    status: row.status,
    data,
    name: row.name,
    phone: row.phone || data.phone,
    department: row.department || data.department,
    position: row.position || data.position,
    idCard: row.id_card || data.idCard,
    expectedCheckInDate: row.expected_check_in_date || data.expectedCheckInDate,
    reason: row.reason || data.reason,
    reviewerName: row.reviewer_name,
    reviewOpinion: row.review_opinion,
    reviewedAt: row.reviewed_at,
    roomNo: row.room_no,
    bedNo: row.bed_no,
    roomBed: row.room_bed || [row.room_no, row.bed_no].filter(Boolean).join('-') || null,
    keyIssued: row.key_issued,
    handlerName: row.handler_name,
    checkedInAt: row.checked_in_at,
    checkoutApplyDate: row.checkout_apply_date,
    moveOutDate: row.move_out_date,
    checkoutReason: row.checkout_reason,
    keyReturned: row.key_returned,
    checkoutHandlerName: row.checkout_handler_name,
    checkedOutAt: row.checked_out_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
