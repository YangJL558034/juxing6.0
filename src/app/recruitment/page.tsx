'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileText,
  GraduationCap,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Upload,
  UserRound,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { RecruitmentJob } from '@/types/recruitment';

interface JobsResponse {
  success: boolean;
  jobs?: RecruitmentJob[];
  error?: string;
}

interface SubmitResponse {
  success: boolean;
  id?: number;
  error?: string;
}

interface ApplicationForm {
  applicantName: string;
  phone: string;
  email: string;
  education: string;
  experienceYears: string;
  currentCompany: string;
  expectedSalary: string;
  message: string;
}

const emptyForm: ApplicationForm = {
  applicantName: '',
  phone: '',
  email: '',
  education: '',
  experienceYears: '',
  currentCompany: '',
  expectedSalary: '',
  message: '',
};

function display(value?: string | number | null) {
  if (value === undefined || value === null) return '-';
  const text = String(value).trim();
  return text || '-';
}

function formatDate(value?: string | null) {
  if (!value) return '长期招聘';
  return value.includes('T') ? value.split('T')[0] : value.slice(0, 10);
}

function TextBlock({ title, value }: { title: string; value?: string | null }) {
  const lines = String(value || '').split('\n').map((item) => item.trim()).filter(Boolean);
  return (
    <section className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      {lines.length ? (
        <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
          {lines.map((line, index) => <p key={`${title}-${index}`}>{line}</p>)}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">暂无填写</p>
      )}
    </section>
  );
}

export default function RecruitmentPage() {
  const [jobs, setJobs] = useState<RecruitmentJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedJob, setSelectedJob] = useState<RecruitmentJob | null>(null);
  const [mode, setMode] = useState<'list' | 'detail' | 'apply' | 'success'>('list');
  const [form, setForm] = useState<ApplicationForm>(emptyForm);
  const [resume, setResume] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadJobs = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/recruitment/jobs?public=1', { cache: 'no-store' });
        const result = await response.json().catch(() => ({})) as JobsResponse;
        if (!response.ok || !result.success) {
          throw new Error(result.error || '获取招聘职位失败');
        }
        setJobs(result.jobs || []);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : '获取招聘职位失败');
        setJobs([]);
      } finally {
        setLoading(false);
      }
    };
    void loadJobs();
  }, []);

  const headerTitle = useMemo(() => {
    if (mode === 'apply') return '投递简历';
    if (mode === 'detail') return '职位详情';
    if (mode === 'success') return '投递成功';
    return '招聘职位';
  }, [mode]);

  const updateForm = <K extends keyof ApplicationForm>(field: K, value: ApplicationForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const openDetail = (job: RecruitmentJob) => {
    setSelectedJob(job);
    setMode('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const backToList = () => {
    setSelectedJob(null);
    setMode('list');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openApply = () => {
    setForm(emptyForm);
    setResume(null);
    setMode('apply');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async () => {
    if (!selectedJob) return;
    if (!form.applicantName.trim()) {
      alert('请填写姓名');
      return;
    }
    if (!form.phone.trim()) {
      alert('请填写联系电话');
      return;
    }
    if (!resume) {
      alert('请上传 PDF 简历');
      return;
    }
    const ext = resume.name.toLowerCase().slice(resume.name.lastIndexOf('.'));
    if (resume.type !== 'application/pdf' && ext !== '.pdf') {
      alert('简历只能上传 PDF 文件');
      return;
    }

    const body = new FormData();
    body.append('jobId', String(selectedJob.id));
    Object.entries(form).forEach(([key, value]) => body.append(key, value));
    body.append('resume', resume);

    setSubmitting(true);
    try {
      const response = await fetch('/api/recruitment/applications', {
        method: 'POST',
        body,
      });
      const result = await response.json().catch(() => ({})) as SubmitResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '简历投递失败');
      }
      setMode('success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (submitError) {
      alert(submitError instanceof Error ? submitError.message : '简历投递失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === 'success') {
    return (
      <main className="min-h-dvh bg-slate-50 px-4 py-6 text-slate-950">
        <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-[430px] flex-col justify-center">
          <div className="rounded-lg border border-slate-100 bg-white px-5 py-10 text-center shadow-sm">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-11 w-11 text-emerald-600" />
            </div>
            <h1 className="mt-6 text-xl font-semibold text-slate-950">简历投递成功</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              人力资源会尽快查看你的简历，合适的岗位会通过电话或邮箱联系你。
            </p>
            <Button className="mt-8 w-full bg-blue-600 hover:bg-blue-700" onClick={backToList}>
              查看其它职位
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-slate-50 pb-[calc(88px+env(safe-area-inset-bottom))] text-slate-950">
      <div className="mx-auto w-full max-w-[430px]">
        <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-4 py-4 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-slate-500">聚星招聘</p>
              <h1 className="truncate text-base font-semibold text-slate-950">{headerTitle}</h1>
            </div>
            {mode !== 'list' && (
              <Button variant="outline" size="sm" onClick={mode === 'apply' ? () => setMode('detail') : backToList}>
                {mode === 'apply' ? '职位详情' : '职位列表'}
              </Button>
            )}
          </div>
        </header>

        {mode === 'list' && (
          <div className="space-y-3 p-4">
            <div className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Briefcase className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-slate-950">选择应聘职位</h2>
                  <p className="mt-1 text-sm text-slate-500">点击职位查看详情并上传 PDF 简历。</p>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="rounded-lg border border-slate-100 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
                <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                正在加载职位
              </div>
            ) : error ? (
              <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm leading-6 text-red-700">
                {error}
              </div>
            ) : jobs.length === 0 ? (
              <div className="rounded-lg border border-slate-100 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
                当前暂无招聘中的职位
              </div>
            ) : jobs.map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => openDetail(job)}
                className="block w-full rounded-lg border border-slate-100 bg-white p-4 text-left shadow-sm active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold text-slate-950">{job.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{display(job.department)}</span>
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{display(job.location)}</span>
                    </div>
                  </div>
                  <ChevronRight className="mt-1 h-5 w-5 text-slate-400" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="outline">{display(job.salaryRange)}</Badge>
                  <Badge variant="outline">{job.headcount} 人</Badge>
                  <Badge variant="outline">截止 {formatDate(job.deadline)}</Badge>
                </div>
              </button>
            ))}
          </div>
        )}

        {mode === 'detail' && selectedJob && (
          <div className="space-y-3 p-4">
            <section className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-950">{selectedJob.title}</h2>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
                <div className="flex items-center gap-1.5"><Building2 className="h-4 w-4 text-blue-600" />{display(selectedJob.department)}</div>
                <div className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-blue-600" />{display(selectedJob.location)}</div>
                <div className="flex items-center gap-1.5"><Users className="h-4 w-4 text-blue-600" />招聘 {selectedJob.headcount} 人</div>
                <div className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-blue-600" />{formatDate(selectedJob.deadline)}</div>
              </div>
              <div className="mt-3">
                <Badge className="bg-blue-600">{display(selectedJob.salaryRange)}</Badge>
              </div>
            </section>
            <TextBlock title="岗位职责" value={selectedJob.responsibilities} />
            <TextBlock title="任职要求" value={selectedJob.requirements} />
            <TextBlock title="福利待遇" value={selectedJob.benefits} />
          </div>
        )}

        {mode === 'apply' && selectedJob && (
          <div className="space-y-3 p-4">
            <section className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">应聘职位</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">{selectedJob.title}</h2>
            </section>

            <section className="space-y-4 rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                  <UserRound className="h-4 w-4 text-blue-600" />
                  姓名 <span className="text-red-500">*</span>
                </label>
                <Input value={form.applicantName} onChange={(event) => updateForm('applicantName', event.target.value)} placeholder="请输入姓名" className="h-11 text-base" />
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                  <Phone className="h-4 w-4 text-blue-600" />
                  联系电话 <span className="text-red-500">*</span>
                </label>
                <Input value={form.phone} onChange={(event) => updateForm('phone', event.target.value)} placeholder="请输入联系电话" inputMode="tel" className="h-11 text-base" />
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                  <Mail className="h-4 w-4 text-blue-600" />
                  邮箱
                </label>
                <Input value={form.email} onChange={(event) => updateForm('email', event.target.value)} placeholder="请输入邮箱" inputMode="email" className="h-11 text-base" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                    <GraduationCap className="h-4 w-4 text-blue-600" />
                    学历
                  </label>
                  <Input value={form.education} onChange={(event) => updateForm('education', event.target.value)} placeholder="例如：大专" className="h-11 text-base" />
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                    <Briefcase className="h-4 w-4 text-blue-600" />
                    经验
                  </label>
                  <Input value={form.experienceYears} onChange={(event) => updateForm('experienceYears', event.target.value)} placeholder="例如：3年" className="h-11 text-base" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-800">当前公司</label>
                  <Input value={form.currentCompany} onChange={(event) => updateForm('currentCompany', event.target.value)} placeholder="可不填" className="h-11 text-base" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-800">期望薪资</label>
                  <Input value={form.expectedSalary} onChange={(event) => updateForm('expectedSalary', event.target.value)} placeholder="可不填" className="h-11 text-base" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-800">自我介绍 / 备注</label>
                <Textarea value={form.message} onChange={(event) => updateForm('message', event.target.value)} placeholder="可以简单说明工作经历或到岗时间" className="min-h-28 text-base" />
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                  <FileText className="h-4 w-4 text-blue-600" />
                  上传 PDF 简历 <span className="text-red-500">*</span>
                </label>
                <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-blue-200 bg-blue-50/50 px-3 py-4 text-center active:scale-[0.99]">
                  <Upload className="mb-2 h-6 w-6 text-blue-600" />
                  <span className="max-w-full truncate text-sm font-medium text-blue-700">{resume ? resume.name : '选择 PDF 文件'}</span>
                  <span className="mt-1 text-xs text-slate-500">仅支持 PDF，最大 20MB</span>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="sr-only"
                    onChange={(event) => setResume(event.target.files?.[0] || null)}
                  />
                </label>
              </div>
            </section>
          </div>
        )}
      </div>

      {mode === 'detail' && selectedJob && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-100 bg-white/95 px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto flex max-w-[430px] gap-3">
            <Button variant="outline" className="h-12 flex-1" onClick={backToList}>职位列表</Button>
            <Button className="h-12 flex-1 bg-blue-600 hover:bg-blue-700" onClick={openApply}>投递简历</Button>
          </div>
        </div>
      )}

      {mode === 'apply' && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-100 bg-white/95 px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto flex max-w-[430px] gap-3">
            <Button variant="outline" className="h-12 flex-1" onClick={() => setMode('detail')} disabled={submitting}>上一步</Button>
            <Button className="h-12 flex-1 bg-blue-600 hover:bg-blue-700" onClick={() => void submit()} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              提交
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
