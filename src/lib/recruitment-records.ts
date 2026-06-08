import type {
  RecruitmentApplication,
  RecruitmentApplicationStatus,
  RecruitmentJob,
  RecruitmentJobStatus,
} from '@/types/recruitment';

export interface RecruitmentJobDbRow {
  id: number;
  title: string;
  department: string | null;
  location: string | null;
  salary_range: string | null;
  headcount: number | null;
  deadline: string | null;
  requirements: string | null;
  responsibilities: string | null;
  benefits: string | null;
  status: RecruitmentJobStatus;
  sort_order: number | null;
  application_count?: number | null;
  created_at: string;
  updated_at: string | null;
}

export interface RecruitmentApplicationDbRow {
  id: number;
  job_id: number;
  job_title: string;
  applicant_name: string;
  phone: string;
  email: string | null;
  education: string | null;
  experience_years: string | null;
  current_company: string | null;
  expected_salary: string | null;
  message: string | null;
  resume_url: string;
  resume_file_name: string;
  resume_file_size: number | null;
  status: RecruitmentApplicationStatus;
  created_at: string;
  updated_at: string | null;
}

export const jobStatuses: RecruitmentJobStatus[] = ['招聘中', '暂停', '已结束'];
export const applicationStatuses: RecruitmentApplicationStatus[] = ['新投递', '已查看', '已联系', '不合适'];

export interface RecruitmentJobPayload {
  title: string;
  department: string;
  location: string;
  salaryRange: string;
  headcount: number;
  deadline: string;
  requirements: string;
  responsibilities: string;
  benefits: string;
  status: RecruitmentJobStatus;
  sortOrder: number;
}

function cleanText(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeStatus<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const text = cleanText(value) as T;
  return allowed.includes(text) ? text : fallback;
}

export function normalizeJobPayload(value: unknown): RecruitmentJobPayload {
  const data = typeof value === 'object' && value ? value as Record<string, unknown> : {};
  return {
    title: cleanText(data.title),
    department: cleanText(data.department),
    location: cleanText(data.location),
    salaryRange: cleanText(data.salaryRange ?? data.salary_range),
    headcount: Math.max(1, Number(data.headcount || 1)),
    deadline: cleanText(data.deadline),
    requirements: cleanText(data.requirements),
    responsibilities: cleanText(data.responsibilities),
    benefits: cleanText(data.benefits),
    status: normalizeStatus(data.status, jobStatuses, '招聘中'),
    sortOrder: Number(data.sortOrder ?? data.sort_order ?? 0) || 0,
  };
}

export function parseRecruitmentJob(row: RecruitmentJobDbRow): RecruitmentJob {
  return {
    id: row.id,
    title: row.title,
    department: row.department,
    location: row.location,
    salaryRange: row.salary_range,
    headcount: Number(row.headcount || 1),
    deadline: row.deadline,
    requirements: row.requirements,
    responsibilities: row.responsibilities,
    benefits: row.benefits,
    status: row.status,
    sortOrder: Number(row.sort_order || 0),
    applicationCount: Number(row.application_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function parseRecruitmentApplication(row: RecruitmentApplicationDbRow): RecruitmentApplication {
  return {
    id: row.id,
    jobId: row.job_id,
    jobTitle: row.job_title,
    applicantName: row.applicant_name,
    phone: row.phone,
    email: row.email,
    education: row.education,
    experienceYears: row.experience_years,
    currentCompany: row.current_company,
    expectedSalary: row.expected_salary,
    message: row.message,
    resumeUrl: row.resume_url,
    resumeFileName: row.resume_file_name,
    resumeFileSize: Number(row.resume_file_size || 0),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeApplicationStatus(value: unknown): RecruitmentApplicationStatus {
  return normalizeStatus(value, applicationStatuses, '新投递');
}
