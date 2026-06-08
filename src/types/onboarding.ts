export type OnboardingStatus = '待审核' | '已审核' | '已离职';

export interface EmergencyContact {
  name: string;
  relation: string;
  address: string;
  phone: string;
}

export interface OnboardingFormData {
  position: string;
  department: string;
  fillDate: string;
  hireDate: string;
  recruitmentSource: string[];
  otherRecruitmentSource: string;
  name: string;
  gender: '男' | '女';
  ethnicity: string;
  nativePlace: string;
  education: string;
  politicalStatus: string;
  maritalStatus: string;
  idCard: string;
  phone: string;
  wechat: string;
  email: string;
  emergencyContacts: EmergencyContact[];
  dominantHand: '右' | '左';
  majorDisease: '无' | '有';
  majorDiseaseNote: string;
  disabilityProof: '无' | '有';
  disabilityProofNote: string;
  heavyWork: '无' | '有';
  heavyWorkNote: string;
  occupationalDisease: '无' | '有';
  occupationalDiseaseNote: string;
  contractTerm: string;
  probationMonths: string;
  probationSalary: string;
  machineAgreement: string;
  wageMethod: string;
  promiseConfirmed: boolean;
  signatureDataUrl: string;
  signatureDate: string;
}

export interface OnboardingRecord {
  id: number;
  status: OnboardingStatus;
  data: OnboardingFormData;
  name: string;
  gender: string;
  phone: string;
  idCard: string;
  position: string;
  department: string;
  hireDate: string;
  recruitmentSource: string;
  reviewerName: string | null;
  hrOpinion: string | null;
  reviewedAt: string | null;
  employeeId: number | null;
  createdAt: string;
  updatedAt: string | null;
}
