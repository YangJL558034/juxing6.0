'use client';

import Link from 'next/link';
import type { ComponentType } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Mail,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { applicationStatuses, jobStatuses, type RecruitmentJobPayload } from '@/lib/recruitment-records';
import { cn } from '@/lib/utils';
import type {
  RecruitmentApplication,
  RecruitmentApplicationStatus,
  RecruitmentJob,
  RecruitmentJobStatus,
} from '@/types/recruitment';

interface JobsResponse {
  success: boolean;
  jobs?: RecruitmentJob[];
  job?: RecruitmentJob;
  error?: string;
}

interface ApplicationsResponse {
  success: boolean;
  applications?: RecruitmentApplication[];
  application?: RecruitmentApplication;
  counts?: ApplicationCounts;
  error?: string;
}

interface ApplicationCounts {
  total: number;
  new: number;
  viewed: number;
  contacted: number;
  rejected: number;
}

const emptyCounts: ApplicationCounts = { total: 0, new: 0, viewed: 0, contacted: 0, rejected: 0 };

const emptyJobForm: RecruitmentJobPayload = {
  title: '',
  department: '',
  location: '',
  salaryRange: '',
  headcount: 1,
  deadline: '',
  requirements: '',
  responsibilities: '',
  benefits: '',
  status: '招聘中',
  sortOrder: 0,
};

const jobStatusTone: Record<RecruitmentJobStatus, string> = {
  招聘中: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  暂停: 'bg-orange-50 text-orange-700 ring-orange-200',
  已结束: 'bg-slate-100 text-slate-700 ring-slate-200',
};

const applicationStatusTone: Record<RecruitmentApplicationStatus, string> = {
  新投递: 'bg-blue-50 text-blue-700 ring-blue-200',
  已查看: 'bg-violet-50 text-violet-700 ring-violet-200',
  已联系: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  不合适: 'bg-slate-100 text-slate-700 ring-slate-200',
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  return value.includes('T') ? value.split('T')[0] : value.slice(0, 10);
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return value.replace('T', ' ').slice(0, 16);
}

function display(value?: string | number | null) {
  if (value === undefined || value === null) return '-';
  const text = String(value).trim();
  return text || '-';
}

function fileSize(value: number) {
  if (!value) return '-';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function StatusBadge<T extends string>({
  status,
  toneMap,
}: {
  status: T;
  toneMap: Record<T, string>;
}) {
  return (
    <span className={cn('inline-flex rounded-md px-2 py-1 text-xs font-medium ring-1', toneMap[status])}>
      {status}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg', tone)}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-medium text-slate-700">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
        </div>
      </div>
    </div>
  );
}

function DetailGrid({ pairs }: { pairs: Array<[string, string | number | null | undefined]> }) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {pairs.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
          <span className="text-slate-500">{label}:</span>
          <span className="break-all text-slate-800">{display(value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function HumanResourcesPage() {
  const [activeTab, setActiveTab] = useState<'jobs' | 'applications'>('jobs');
  const [jobs, setJobs] = useState<RecruitmentJob[]>([]);
  const [applications, setApplications] = useState<RecruitmentApplication[]>([]);
  const [counts, setCounts] = useState<ApplicationCounts>(emptyCounts);

  const [jobKeyword, setJobKeyword] = useState('');
  const [jobStatus, setJobStatus] = useState('all');
  const [applicationKeyword, setApplicationKeyword] = useState('');
  const [applicationStatus, setApplicationStatus] = useState('all');
  const [applicationJobId, setApplicationJobId] = useState('all');

  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const [error, setError] = useState('');

  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<RecruitmentJob | null>(null);
  const [jobForm, setJobForm] = useState<RecruitmentJobPayload>(emptyJobForm);
  const [savingJob, setSavingJob] = useState(false);

  const [selectedApplication, setSelectedApplication] = useState<RecruitmentApplication | null>(null);
  const [applicationDialogOpen, setApplicationDialogOpen] = useState(false);

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (jobKeyword.trim()) params.set('keyword', jobKeyword.trim());
      if (jobStatus !== 'all') params.set('status', jobStatus);
      const response = await fetch(`/api/recruitment/jobs?${params.toString()}`, { cache: 'no-store' });
      const result = await response.json().catch(() => ({})) as JobsResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '获取职位列表失败');
      }
      setJobs(result.jobs || []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '获取职位列表失败');
      setJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  }, [jobKeyword, jobStatus]);

  const loadApplications = useCallback(async () => {
    setLoadingApplications(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (applicationKeyword.trim()) params.set('keyword', applicationKeyword.trim());
      if (applicationStatus !== 'all') params.set('status', applicationStatus);
      if (applicationJobId !== 'all') params.set('jobId', applicationJobId);
      const response = await fetch(`/api/recruitment/applications?${params.toString()}`, { cache: 'no-store' });
      const result = await response.json().catch(() => ({})) as ApplicationsResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '获取简历投递失败');
      }
      setApplications(result.applications || []);
      setCounts(result.counts || emptyCounts);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '获取简历投递失败');
      setApplications([]);
      setCounts(emptyCounts);
    } finally {
      setLoadingApplications(false);
    }
  }, [applicationJobId, applicationKeyword, applicationStatus]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  const stats = useMemo(() => {
    const activeJobs = jobs.filter((job) => job.status === '招聘中').length;
    return [
      { label: '招聘中职位', value: activeJobs, icon: Briefcase, tone: 'bg-blue-50 text-blue-600' },
      { label: '新投递简历', value: counts.new, icon: FileText, tone: 'bg-orange-50 text-orange-600' },
      { label: '已联系候选人', value: counts.contacted, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' },
      { label: '全部简历', value: counts.total, icon: Users, tone: 'bg-violet-50 text-violet-600' },
    ];
  }, [counts, jobs]);

  const openCreateJob = () => {
    setEditingJob(null);
    setJobForm({ ...emptyJobForm });
    setJobDialogOpen(true);
  };

  const openEditJob = (job: RecruitmentJob) => {
    setEditingJob(job);
    setJobForm({
      title: job.title,
      department: job.department || '',
      location: job.location || '',
      salaryRange: job.salaryRange || '',
      headcount: job.headcount || 1,
      deadline: job.deadline || '',
      requirements: job.requirements || '',
      responsibilities: job.responsibilities || '',
      benefits: job.benefits || '',
      status: job.status,
      sortOrder: job.sortOrder || 0,
    });
    setJobDialogOpen(true);
  };

  const updateJobForm = <K extends keyof RecruitmentJobPayload>(field: K, value: RecruitmentJobPayload[K]) => {
    setJobForm((current) => ({ ...current, [field]: value }));
  };

  const saveJob = async () => {
    if (!jobForm.title.trim()) {
      alert('请填写职位名称');
      return;
    }
    setSavingJob(true);
    try {
      const response = await fetch(editingJob ? `/api/recruitment/jobs/${editingJob.id}` : '/api/recruitment/jobs', {
        method: editingJob ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobForm),
      });
      const result = await response.json().catch(() => ({})) as JobsResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '保存职位失败');
      }
      setJobDialogOpen(false);
      setEditingJob(null);
      await loadJobs();
    } catch (saveError) {
      alert(saveError instanceof Error ? saveError.message : '保存职位失败');
    } finally {
      setSavingJob(false);
    }
  };

  const deleteJob = async (job: RecruitmentJob) => {
    if (!confirm(`确定删除职位「${job.title}」吗？`)) return;
    try {
      const response = await fetch(`/api/recruitment/jobs/${job.id}`, { method: 'DELETE' });
      const result = await response.json().catch(() => ({})) as JobsResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '删除职位失败');
      }
      await loadJobs();
    } catch (deleteError) {
      alert(deleteError instanceof Error ? deleteError.message : '删除职位失败');
    }
  };

  const updateApplicationStatus = async (application: RecruitmentApplication, status: RecruitmentApplicationStatus) => {
    try {
      const response = await fetch(`/api/recruitment/applications/${application.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const result = await response.json().catch(() => ({})) as ApplicationsResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '更新简历状态失败');
      }
      await loadApplications();
    } catch (updateError) {
      alert(updateError instanceof Error ? updateError.message : '更新简历状态失败');
    }
  };

  const deleteApplication = async (application: RecruitmentApplication) => {
    if (!confirm(`确定删除 ${application.applicantName} 的简历投递吗？`)) return;
    try {
      const response = await fetch(`/api/recruitment/applications/${application.id}`, { method: 'DELETE' });
      const result = await response.json().catch(() => ({})) as ApplicationsResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '删除简历投递失败');
      }
      setApplicationDialogOpen(false);
      setSelectedApplication(null);
      await loadApplications();
      await loadJobs();
    } catch (deleteError) {
      alert(deleteError instanceof Error ? deleteError.message : '删除简历投递失败');
    }
  };

  const openApplicationDetail = (application: RecruitmentApplication) => {
    setSelectedApplication(application);
    setApplicationDialogOpen(true);
    if (application.status === '新投递') {
      void updateApplicationStatus(application, '已查看');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm text-slate-500">组织人事 / 人力资源</p>
          <h1 className="text-2xl font-semibold text-slate-950">人力资源</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/recruitment" target="_blank">
              <ExternalLink className="mr-2 h-4 w-4" />
              移动端招聘页
            </Link>
          </Button>
          <Button variant="outline" onClick={() => { void loadJobs(); void loadApplications(); }}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            刷新
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={openCreateJob}>
            <Plus className="mr-2 h-4 w-4" />
            添加职位
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </div>

      <div className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <div className="min-w-0 flex-1">
            <label className="text-sm font-medium text-slate-700">
              {activeTab === 'jobs' ? '职位关键词' : '姓名 / 手机号 / 邮箱 / 职位'}
            </label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={activeTab === 'jobs' ? jobKeyword : applicationKeyword}
                onChange={(event) => activeTab === 'jobs' ? setJobKeyword(event.target.value) : setApplicationKeyword(event.target.value)}
                placeholder="请输入关键词"
                className="pl-9"
              />
            </div>
          </div>
          {activeTab === 'jobs' ? (
            <div className="w-full xl:w-44">
              <label className="text-sm font-medium text-slate-700">职位状态</label>
              <Select value={jobStatus} onValueChange={setJobStatus}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  {jobStatuses.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <>
              <div className="w-full xl:w-44">
                <label className="text-sm font-medium text-slate-700">简历状态</label>
                <Select value={applicationStatus} onValueChange={setApplicationStatus}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    {applicationStatuses.map((status) => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full xl:w-56">
                <label className="text-sm font-medium text-slate-700">应聘职位</label>
                <Select value={applicationJobId} onValueChange={setApplicationJobId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部职位</SelectItem>
                    {jobs.map((job) => (
                      <SelectItem key={job.id} value={String(job.id)}>{job.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{activeTab === 'jobs' ? '职位管理' : '简历投递'}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {activeTab === 'jobs' ? `共 ${jobs.length} 个职位` : `当前显示 ${applications.length} 条投递`}
            </p>
          </div>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'jobs' | 'applications')}>
            <TabsList className="grid h-10 grid-cols-2 bg-slate-100 p-1">
              <TabsTrigger value="jobs" className="min-w-28 px-3 text-sm">职位管理</TabsTrigger>
              <TabsTrigger value="applications" className="min-w-28 px-3 text-sm">简历投递</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="overflow-x-auto">
          {activeTab === 'jobs' ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead className="w-14">序号</TableHead>
                  <TableHead>职位名称</TableHead>
                  <TableHead>部门/地点</TableHead>
                  <TableHead>薪资</TableHead>
                  <TableHead>人数</TableHead>
                  <TableHead>截止日期</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>简历数</TableHead>
                  <TableHead className="w-40">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingJobs ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-28 text-center text-sm text-slate-500">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                      正在加载职位
                    </TableCell>
                  </TableRow>
                ) : jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-28 text-center text-sm text-slate-500">
                      暂无招聘职位
                    </TableCell>
                  </TableRow>
                ) : jobs.map((job, index) => (
                  <TableRow key={job.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-950">{job.title}</div>
                      <div className="mt-1 line-clamp-1 max-w-[360px] text-xs text-slate-500">{display(job.requirements)}</div>
                    </TableCell>
                    <TableCell>{[job.department, job.location].filter(Boolean).join(' / ') || '-'}</TableCell>
                    <TableCell>{display(job.salaryRange)}</TableCell>
                    <TableCell>{job.headcount}</TableCell>
                    <TableCell>{formatDate(job.deadline)}</TableCell>
                    <TableCell><StatusBadge status={job.status} toneMap={jobStatusTone} /></TableCell>
                    <TableCell>
                      <Badge variant="outline">{job.applicationCount} 份</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="text-blue-600" onClick={() => openEditJob(job)}>
                          <Pencil className="mr-1 h-4 w-4" />
                          修改
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => void deleteJob(job)}>
                          <Trash2 className="mr-1 h-4 w-4" />
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead className="w-14">序号</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead>联系电话</TableHead>
                  <TableHead>应聘职位</TableHead>
                  <TableHead>学历/经验</TableHead>
                  <TableHead>简历</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>投递时间</TableHead>
                  <TableHead className="w-56">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingApplications ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-28 text-center text-sm text-slate-500">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                      正在加载简历
                    </TableCell>
                  </TableRow>
                ) : applications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-28 text-center text-sm text-slate-500">
                      暂无简历投递
                    </TableCell>
                  </TableRow>
                ) : applications.map((application, index) => (
                  <TableRow key={application.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="font-medium text-slate-950">{application.applicantName}</TableCell>
                    <TableCell>{application.phone}</TableCell>
                    <TableCell>{application.jobTitle}</TableCell>
                    <TableCell>{[application.education, application.experienceYears].filter(Boolean).join(' / ') || '-'}</TableCell>
                    <TableCell>
                      <Button variant="link" className="h-auto px-0 text-blue-600" asChild>
                        <a href={application.resumeUrl} target="_blank" rel="noreferrer">查看 PDF</a>
                      </Button>
                    </TableCell>
                    <TableCell><StatusBadge status={application.status} toneMap={applicationStatusTone} /></TableCell>
                    <TableCell>{formatDateTime(application.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Button variant="ghost" size="sm" className="text-blue-600" onClick={() => openApplicationDetail(application)}>
                          <Eye className="mr-1 h-4 w-4" />
                          查看
                        </Button>
                        <Select
                          value={application.status}
                          onValueChange={(value) => void updateApplicationStatus(application, value as RecruitmentApplicationStatus)}
                        >
                          <SelectTrigger className="h-8 w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {applicationStatuses.map((status) => (
                              <SelectItem key={status} value={status}>{status}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => void deleteApplication(application)}>
                          <Trash2 className="mr-1 h-4 w-4" />
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <Dialog open={jobDialogOpen} onOpenChange={setJobDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingJob ? '修改招聘职位' : '添加招聘职位'}</DialogTitle>
            <DialogDescription>移动端招聘页面只显示状态为“招聘中”且未过截止日期的职位。</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">职位名称 <span className="text-red-500">*</span></label>
              <Input value={jobForm.title} onChange={(event) => updateJobForm('title', event.target.value)} placeholder="例如：电商运营" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">招聘部门</label>
              <Input value={jobForm.department} onChange={(event) => updateJobForm('department', event.target.value)} placeholder="例如：技术部" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">工作地点</label>
              <Input value={jobForm.location} onChange={(event) => updateJobForm('location', event.target.value)} placeholder="例如：广州" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">薪资范围</label>
              <Input value={jobForm.salaryRange} onChange={(event) => updateJobForm('salaryRange', event.target.value)} placeholder="例如：6K-9K" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">招聘人数</label>
                <Input type="number" min={1} value={jobForm.headcount} onChange={(event) => updateJobForm('headcount', Math.max(1, Number(event.target.value || 1)))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">排序</label>
                <Input type="number" value={jobForm.sortOrder} onChange={(event) => updateJobForm('sortOrder', Number(event.target.value || 0))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">截止日期</label>
              <Input type="date" value={jobForm.deadline} onChange={(event) => updateJobForm('deadline', event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">状态</label>
              <Select value={jobForm.status} onValueChange={(value) => updateJobForm('status', value as RecruitmentJobStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {jobStatuses.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">岗位职责</label>
              <Textarea value={jobForm.responsibilities} onChange={(event) => updateJobForm('responsibilities', event.target.value)} className="min-h-28" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">任职要求</label>
              <Textarea value={jobForm.requirements} onChange={(event) => updateJobForm('requirements', event.target.value)} className="min-h-28" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">福利待遇</label>
              <Textarea value={jobForm.benefits} onChange={(event) => updateJobForm('benefits', event.target.value)} className="min-h-24" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJobDialogOpen(false)} disabled={savingJob}>取消</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => void saveJob()} disabled={savingJob}>
              {savingJob && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={applicationDialogOpen} onOpenChange={setApplicationDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>简历投递详情</DialogTitle>
            <DialogDescription>{selectedApplication ? `${selectedApplication.applicantName} / ${selectedApplication.jobTitle}` : ''}</DialogDescription>
          </DialogHeader>
          {selectedApplication && (
            <div className="space-y-5">
              <DetailGrid
                pairs={[
                  ['姓名', selectedApplication.applicantName],
                  ['电话', selectedApplication.phone],
                  ['邮箱', selectedApplication.email],
                  ['应聘职位', selectedApplication.jobTitle],
                  ['学历', selectedApplication.education],
                  ['工作经验', selectedApplication.experienceYears],
                  ['当前公司', selectedApplication.currentCompany],
                  ['期望薪资', selectedApplication.expectedSalary],
                  ['投递时间', formatDateTime(selectedApplication.createdAt)],
                  ['简历大小', fileSize(selectedApplication.resumeFileSize)],
                ]}
              />
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-950">自我介绍 / 备注</h3>
                <div className="min-h-20 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                  {display(selectedApplication.message)}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-white p-3">
                <FileText className="h-5 w-5 text-blue-600" />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{selectedApplication.resumeFileName}</span>
                <Button variant="outline" size="sm" asChild>
                  <a href={selectedApplication.resumeUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    查看/下载 PDF
                  </a>
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Select
                  value={selectedApplication.status}
                  onValueChange={(value) => void updateApplicationStatus(selectedApplication, value as RecruitmentApplicationStatus)}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {applicationStatuses.map((status) => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" asChild>
                  <a href={`mailto:${selectedApplication.email || ''}`}>
                    <Mail className="mr-2 h-4 w-4" />
                    发邮件
                  </a>
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            {selectedApplication && (
              <Button variant="destructive" onClick={() => void deleteApplication(selectedApplication)}>
                <Trash2 className="mr-2 h-4 w-4" />
                删除投递
              </Button>
            )}
            <Button variant="outline" onClick={() => setApplicationDialogOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
