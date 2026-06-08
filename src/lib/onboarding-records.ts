import type { OnboardingFormData, OnboardingRecord, OnboardingStatus } from '@/types/onboarding';

export interface OnboardingDbRow {
  id: number;
  status: OnboardingStatus;
  name: string;
  gender: string | null;
  phone: string | null;
  id_card: string | null;
  position: string | null;
  department: string | null;
  hire_date: string | null;
  recruitment_source: string | null;
  data_json: string;
  reviewer_name: string | null;
  hr_opinion: string | null;
  reviewed_at: string | null;
  employee_id: number | null;
  created_at: string;
  updated_at: string | null;
}

export const defaultOnboardingData: OnboardingFormData = {
  position: '',
  department: '',
  fillDate: '',
  hireDate: '',
  recruitmentSource: [],
  otherRecruitmentSource: '',
  name: '',
  gender: '男',
  ethnicity: '',
  nativePlace: '',
  education: '',
  politicalStatus: '',
  maritalStatus: '未婚',
  idCard: '',
  phone: '',
  wechat: '',
  email: '',
  emergencyContacts: [{ name: '', relation: '', address: '', phone: '' }],
  dominantHand: '右',
  majorDisease: '无',
  majorDiseaseNote: '',
  disabilityProof: '无',
  disabilityProofNote: '',
  heavyWork: '无',
  heavyWorkNote: '',
  occupationalDisease: '无',
  occupationalDiseaseNote: '',
  contractTerm: '0',
  probationMonths: '',
  probationSalary: '',
  machineAgreement: '',
  wageMethod: '底薪和加班费',
  promiseConfirmed: false,
  signatureDataUrl: '',
  signatureDate: '',
};

export function normalizeOnboardingData(value: unknown): OnboardingFormData {
  const data = typeof value === 'object' && value ? value as Partial<OnboardingFormData> : {};
  const merged = { ...defaultOnboardingData, ...data };
  const firstContact = Array.isArray(data.emergencyContacts) && data.emergencyContacts.length > 0
    ? data.emergencyContacts[0]
    : defaultOnboardingData.emergencyContacts[0];

  return {
    ...merged,
    gender: merged.gender === '女' ? '女' : '男',
    maritalStatus: merged.maritalStatus || '未婚',
    dominantHand: merged.dominantHand === '左' ? '左' : '右',
    majorDisease: merged.majorDisease === '有' ? '有' : '无',
    disabilityProof: merged.disabilityProof === '有' ? '有' : '无',
    heavyWork: merged.heavyWork === '有' ? '有' : '无',
    occupationalDisease: merged.occupationalDisease === '有' ? '有' : '无',
    recruitmentSource: Array.isArray(merged.recruitmentSource) ? merged.recruitmentSource : [],
    emergencyContacts: [{
      name: firstContact?.name || '',
      relation: firstContact?.relation || '',
      address: firstContact?.address || '',
      phone: firstContact?.phone || '',
    }],
    wageMethod: merged.wageMethod === '底薪加班费和月薪' ? '底薪和加班费' : merged.wageMethod,
    promiseConfirmed: Boolean(merged.promiseConfirmed),
  };
}

export function parseOnboardingRow(row: OnboardingDbRow): OnboardingRecord {
  let parsed: unknown = {};
  try {
    parsed = JSON.parse(row.data_json || '{}');
  } catch {
    parsed = {};
  }

  const data = normalizeOnboardingData(parsed);

  return {
    id: row.id,
    status: row.status,
    data,
    name: row.name,
    gender: row.gender || data.gender,
    phone: row.phone || data.phone,
    idCard: row.id_card || data.idCard,
    position: row.position || data.position,
    department: row.department || data.department,
    hireDate: row.hire_date || data.hireDate,
    recruitmentSource: row.recruitment_source || [...data.recruitmentSource, data.otherRecruitmentSource].filter(Boolean).join('、'),
    reviewerName: row.reviewer_name,
    hrOpinion: row.hr_opinion,
    reviewedAt: row.reviewed_at,
    employeeId: row.employee_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
