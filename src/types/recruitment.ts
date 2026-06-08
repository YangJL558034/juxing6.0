export type RecruitmentJobStatus = '招聘中' | '暂停' | '已结束';

export type RecruitmentApplicationStatus = '新投递' | '已查看' | '已联系' | '不合适';

export interface RecruitmentJob {
  id: number;
  title: string;
  department: string | null;
  location: string | null;
  salaryRange: string | null;
  headcount: number;
  deadline: string | null;
  requirements: string | null;
  responsibilities: string | null;
  benefits: string | null;
  status: RecruitmentJobStatus;
  sortOrder: number;
  applicationCount: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface RecruitmentApplication {
  id: number;
  jobId: number;
  jobTitle: string;
  applicantName: string;
  phone: string;
  email: string | null;
  education: string | null;
  experienceYears: string | null;
  currentCompany: string | null;
  expectedSalary: string | null;
  message: string | null;
  resumeUrl: string;
  resumeFileName: string;
  resumeFileSize: number;
  status: RecruitmentApplicationStatus;
  createdAt: string;
  updatedAt: string | null;
}
