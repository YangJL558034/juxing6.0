'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Download,
  Eye,
  FileCheck2,
  Hourglass,
  Loader2,
  Pencil,
  Plus,
  Printer,
  RefreshCcw,
  RotateCcw,
  Search,
  Trash2,
  UserMinus,
  UserRound,
  X,
} from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type {
  EmergencyContact,
  OnboardingFormData,
  OnboardingRecord,
  OnboardingStatus,
} from '@/types/onboarding';
import type { RegularizationFormData, RegularizationRecord } from '@/types/regularization';
import type { WorkCertificateFormData, WorkCertificateRecord } from '@/types/work-certificate';
import type { LaborContractTerminationFormData, LaborContractTerminationRecord } from '@/types/labor-contract-termination';
import ResignationAdminSection from './ResignationAdminSection';
import ResignationCertificateAdminSection from './ResignationCertificateAdminSection';
import SocialSecurityAdminSection from './SocialSecurityAdminSection';
import LeaveRequestAdminSection from './LeaveRequestAdminSection';
import YearMonthGroupedTableBody from './YearMonthGroupedTableBody';

interface OnboardingCounts {
  total: number;
  pending: number;
  reviewed: number;
  resigned: number;
}

interface ListResponse {
  success: boolean;
  records?: OnboardingRecord[];
  counts?: OnboardingCounts;
  error?: string;
}

interface MutateResponse {
  success: boolean;
  record?: OnboardingRecord;
  error?: string;
}

interface RegularizationListResponse {
  success: boolean;
  records?: RegularizationRecord[];
  error?: string;
}

interface RegularizationMutateResponse {
  success: boolean;
  record?: RegularizationRecord;
  error?: string;
}

interface WorkCertificateListResponse {
  success: boolean;
  records?: WorkCertificateRecord[];
  error?: string;
}

interface WorkCertificateMutateResponse {
  success: boolean;
  record?: WorkCertificateRecord;
  error?: string;
}

interface LaborContractTerminationListResponse {
  success: boolean;
  records?: LaborContractTerminationRecord[];
  error?: string;
}

interface LaborContractTerminationMutateResponse {
  success: boolean;
  record?: LaborContractTerminationRecord;
  error?: string;
}

const emptyCounts: OnboardingCounts = { total: 0, pending: 0, reviewed: 0, resigned: 0 };

const emptyContact: EmergencyContact = {
  name: '',
  relation: '',
  address: '',
  phone: '',
};

const statusTone: Record<OnboardingStatus, string> = {
  待审核: 'bg-orange-50 text-orange-700 ring-orange-200',
  已审核: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  已离职: 'bg-slate-100 text-slate-700 ring-slate-200',
};

const sourceOptions = ['网络', '人才市场', '内部推荐', '其他'];
const wageMethodOptions = ['底薪和加班费', '月薪', '计件工资', '计时工资', '底薪加提成', '其他'];

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

function maskPhone(value?: string | null) {
  const phone = String(value || '').trim();
  if (phone.length < 7) return display(phone);
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

function money(value?: string | null) {
  const text = String(value || '').trim();
  if (!text) return '-';
  return text.includes('元') ? text : `${text} 元/月`;
}

function withNote(answer?: string, note?: string) {
  return note ? `${display(answer)}，${note}` : display(answer);
}

function cloneOnboardingData(data: OnboardingFormData): OnboardingFormData {
  return JSON.parse(JSON.stringify(data)) as OnboardingFormData;
}

function chinaTodayInput() {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const getPart = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
}

function createLaborContractTerminationData(): LaborContractTerminationFormData {
  return {
    employeeName: '',
    honorific: '女士/先生',
    terminationDate: '',
    reason: '在培训期间，经考察不符合公司用工要求。',
    procedureDeadline: '',
    companyName: '东莞山泽新能源有限公司',
    noticeDate: chinaTodayInput(),
    remark: '',
  };
}

function canOutput(record: OnboardingRecord | null | undefined) {
  return Boolean(record && record.status !== '待审核');
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-slate-100 px-5 py-4 last:border-b-0">
      <h3 className="mb-3 text-sm font-semibold text-slate-950">{title}</h3>
      {children}
    </section>
  );
}

function DetailGrid({ pairs }: { pairs: Array<[string, string | number | null | undefined]> }) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {pairs.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[92px_minmax(0,1fr)] gap-2">
          <span className="text-slate-500">{label}:</span>
          <span className="break-all text-slate-800">{display(value)}</span>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: OnboardingStatus }) {
  return (
    <span className={cn('inline-flex rounded-md px-2 py-1 text-xs font-medium ring-1', statusTone[status])}>
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
  icon: React.ComponentType<{ className?: string }>;
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
          <p className="mt-1 text-2xl font-semibold text-slate-950">
            {value}
            <span className="ml-1 text-sm font-normal text-slate-600">人</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export type PersonnelSectionKey =
  | 'onboarding'
  | 'social-security'
  | 'social-security-purchase'
  | 'regularization'
  | 'work-certificate'
  | 'resignation'
  | 'resignation-certificate'
  | 'labor-termination'
  | 'leave-request';

const personnelSectionLabels: Record<PersonnelSectionKey, string> = {
  onboarding: '入职登记',
  'social-security': '社保管理',
  'social-security-purchase': '购买社保',
  regularization: '转正申请',
  'work-certificate': '工作证明',
  resignation: '离职申请',
  'resignation-certificate': '离职证明',
  'labor-termination': '解除劳动合同',
  'leave-request': '请假申请',
};

export default function PersonnelPage({ section = 'onboarding' }: { section?: PersonnelSectionKey }) {
  const currentSectionLabel = personnelSectionLabels[section];
  const [query, setQuery] = useState('');
  const [keyword, setKeyword] = useState('');
  const [activeStatus, setActiveStatus] = useState<OnboardingStatus>('待审核');
  const [source, setSource] = useState('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [records, setRecords] = useState<OnboardingRecord[]>([]);
  const [counts, setCounts] = useState<OnboardingCounts>(emptyCounts);
  const [regularizationRecords, setRegularizationRecords] = useState<RegularizationRecord[]>([]);
  const [regularizationLoading, setRegularizationLoading] = useState(false);
  const [regularizationError, setRegularizationError] = useState('');
  const [regularizationListMode, setRegularizationListMode] = useState<'pending' | 'reviewed' | 'deleted'>('pending');
  const [regularizationReviewOpen, setRegularizationReviewOpen] = useState(false);
  const [regularizationReviewTarget, setRegularizationReviewTarget] = useState<RegularizationRecord | null>(null);
  const [regularizationReviewData, setRegularizationReviewData] = useState<RegularizationFormData | null>(null);
  const [regularizationReviewing, setRegularizationReviewing] = useState(false);
  const [regularizationViewOpen, setRegularizationViewOpen] = useState(false);
  const [regularizationViewTarget, setRegularizationViewTarget] = useState<RegularizationRecord | null>(null);
  const [regularizationEditOpen, setRegularizationEditOpen] = useState(false);
  const [regularizationEditTarget, setRegularizationEditTarget] = useState<RegularizationRecord | null>(null);
  const [regularizationEditData, setRegularizationEditData] = useState<RegularizationFormData | null>(null);
  const [regularizationSavingEdit, setRegularizationSavingEdit] = useState(false);
  const [workCertificateRecords, setWorkCertificateRecords] = useState<WorkCertificateRecord[]>([]);
  const [workCertificateLoading, setWorkCertificateLoading] = useState(false);
  const [workCertificateError, setWorkCertificateError] = useState('');
  const [workCertificateListMode, setWorkCertificateListMode] = useState<'pending' | 'reviewed' | 'deleted'>('pending');
  const [workCertificateReviewOpen, setWorkCertificateReviewOpen] = useState(false);
  const [workCertificateReviewTarget, setWorkCertificateReviewTarget] = useState<WorkCertificateRecord | null>(null);
  const [workCertificateReviewData, setWorkCertificateReviewData] = useState<WorkCertificateFormData | null>(null);
  const [workCertificateReviewing, setWorkCertificateReviewing] = useState(false);
  const [workCertificateFormMode, setWorkCertificateFormMode] = useState<'review' | 'edit'>('review');
  const [workCertificateViewOpen, setWorkCertificateViewOpen] = useState(false);
  const [workCertificateViewTarget, setWorkCertificateViewTarget] = useState<WorkCertificateRecord | null>(null);
  const [laborTerminationRecords, setLaborTerminationRecords] = useState<LaborContractTerminationRecord[]>([]);
  const [laborTerminationLoading, setLaborTerminationLoading] = useState(false);
  const [laborTerminationError, setLaborTerminationError] = useState('');
  const [laborTerminationListMode, setLaborTerminationListMode] = useState<'active' | 'deleted'>('active');
  const [laborTerminationFormOpen, setLaborTerminationFormOpen] = useState(false);
  const [laborTerminationFormMode, setLaborTerminationFormMode] = useState<'create' | 'edit'>('create');
  const [laborTerminationFormTarget, setLaborTerminationFormTarget] = useState<LaborContractTerminationRecord | null>(null);
  const [laborTerminationFormData, setLaborTerminationFormData] = useState<LaborContractTerminationFormData>(createLaborContractTerminationData);
  const [laborTerminationSaving, setLaborTerminationSaving] = useState(false);
  const [laborTerminationViewOpen, setLaborTerminationViewOpen] = useState(false);
  const [laborTerminationViewTarget, setLaborTerminationViewTarget] = useState<LaborContractTerminationRecord | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailTab, setDetailTab] = useState('basic');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<OnboardingRecord | null>(null);
  const [reviewerName, setReviewerName] = useState('');
  const [hrOpinion, setHrOpinion] = useState('同意入职。');
  const [reviewing, setReviewing] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<OnboardingRecord | null>(null);
  const [editData, setEditData] = useState<OnboardingFormData | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (keyword.trim()) params.set('keyword', keyword.trim());
      params.set('status', activeStatus);
      if (source !== 'all') params.set('source', source);

      const response = await fetch(`/api/onboarding?${params.toString()}`, { cache: 'no-store' });
      const result = await response.json().catch(() => ({})) as ListResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error || '获取入职登记列表失败');
      }

      const nextRecords = result.records || [];
      setRecords(nextRecords);
      setCounts(result.counts || { ...emptyCounts, total: nextRecords.length });
      setSelectedId((current) => {
        if (current && nextRecords.some((record) => record.id === current)) return current;
        if (current) setDetailVisible(false);
        return null;
      });
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '获取入职登记列表失败');
      setRecords([]);
      setSelectedId(null);
      setDetailVisible(false);
    } finally {
      setLoading(false);
    }
  }, [activeStatus, keyword, source]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const loadRegularizationRecords = useCallback(async () => {
    setRegularizationLoading(true);
    setRegularizationError('');
    try {
      const params = new URLSearchParams();
      if (regularizationListMode === 'deleted') params.set('deleted', '1');
      const response = await fetch(`/api/regularization?${params.toString()}`, { cache: 'no-store' });
      const result = await response.json().catch(() => ({})) as RegularizationListResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '获取转正申请列表失败');
      }
      const nextRecords = result.records || [];
      setRegularizationRecords(nextRecords.filter((record) => {
        if (regularizationListMode === 'deleted') return true;
        if (regularizationListMode === 'pending') return record.status === '待处理';
        return record.status === '已审核';
      }));
    } catch (fetchError) {
      setRegularizationError(fetchError instanceof Error ? fetchError.message : '获取转正申请列表失败');
      setRegularizationRecords([]);
    } finally {
      setRegularizationLoading(false);
    }
  }, [regularizationListMode]);

  useEffect(() => {
    void loadRegularizationRecords();
  }, [loadRegularizationRecords]);

  const loadWorkCertificateRecords = useCallback(async () => {
    setWorkCertificateLoading(true);
    setWorkCertificateError('');
    try {
      const params = new URLSearchParams();
      if (workCertificateListMode === 'deleted') {
        params.set('deleted', '1');
      } else {
        params.set('status', workCertificateListMode === 'pending' ? '待审核' : '已审核');
      }
      const response = await fetch(`/api/work-certificate?${params.toString()}`, { cache: 'no-store' });
      const result = await response.json().catch(() => ({})) as WorkCertificateListResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '获取工作证明申请失败');
      }
      setWorkCertificateRecords(result.records || []);
    } catch (fetchError) {
      setWorkCertificateError(fetchError instanceof Error ? fetchError.message : '获取工作证明申请失败');
      setWorkCertificateRecords([]);
    } finally {
      setWorkCertificateLoading(false);
    }
  }, [workCertificateListMode]);

  useEffect(() => {
    void loadWorkCertificateRecords();
  }, [loadWorkCertificateRecords]);

  const loadLaborTerminationRecords = useCallback(async () => {
    setLaborTerminationLoading(true);
    setLaborTerminationError('');
    try {
      const params = new URLSearchParams();
      if (laborTerminationListMode === 'deleted') params.set('deleted', '1');
      const response = await fetch(`/api/labor-contract-termination?${params.toString()}`, { cache: 'no-store' });
      const result = await response.json().catch(() => ({})) as LaborContractTerminationListResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '获取解除劳动合同通知书失败');
      }
      setLaborTerminationRecords(result.records || []);
    } catch (fetchError) {
      setLaborTerminationError(fetchError instanceof Error ? fetchError.message : '获取解除劳动合同通知书失败');
      setLaborTerminationRecords([]);
    } finally {
      setLaborTerminationLoading(false);
    }
  }, [laborTerminationListMode]);

  useEffect(() => {
    void loadLaborTerminationRecords();
  }, [loadLaborTerminationRecords]);

  const visibleRecords = useMemo(() => {
    return records.filter((record) => {
      const hireDate = record.hireDate || record.data.hireDate;
      const matchStart = !dateStart || (hireDate && hireDate >= dateStart);
      const matchEnd = !dateEnd || (hireDate && hireDate <= dateEnd);
      return matchStart && matchEnd;
    });
  }, [dateEnd, dateStart, records]);

  const selectedRecord = useMemo(() => {
    if (!selectedId) return null;
    return records.find((record) => record.id === selectedId) || null;
  }, [records, selectedId]);

  const statItems = useMemo(() => [
    { label: '全部登记', value: counts.total, icon: Archive, tone: 'bg-blue-50 text-blue-600' },
    { label: '待审核', value: counts.pending, icon: Hourglass, tone: 'bg-orange-50 text-orange-600' },
    { label: '已审核', value: counts.reviewed, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' },
    { label: '已离职', value: counts.resigned, icon: UserMinus, tone: 'bg-slate-100 text-slate-600' },
  ], [counts]);

  const statusPages: Array<{ status: OnboardingStatus; label: string; count: number }> = [
    { status: '待审核', label: '待审核', count: counts.pending },
    { status: '已审核', label: '已审核', count: counts.reviewed },
    { status: '已离职', label: '已离职', count: counts.resigned },
  ];

  const contact = selectedRecord?.data.emergencyContacts[0];
  const editContact = editData?.emergencyContacts[0] || emptyContact;

  const runSearch = () => setKeyword(query);

  const resetFilters = () => {
    setQuery('');
    setKeyword('');
    setSource('all');
    setDateStart('');
    setDateEnd('');
  };

  const changeStatusPage = (value: string) => {
    setActiveStatus(value as OnboardingStatus);
    setSelectedId(null);
    setDetailVisible(false);
  };

  const showDetail = (record: OnboardingRecord) => {
    setSelectedId(record.id);
    setDetailVisible(true);
    setDetailTab('basic');
  };

  const openReview = (record: OnboardingRecord) => {
    if (record.status !== '待审核') return;
    setReviewTarget(record);
    setReviewerName(record.reviewerName || '');
    setHrOpinion(record.hrOpinion || '同意入职。');
    setReviewOpen(true);
  };

  const openEdit = (record: OnboardingRecord) => {
    setEditingRecord(record);
    setEditData(cloneOnboardingData(record.data));
    setEditOpen(true);
  };

  const updateEditField = <K extends keyof OnboardingFormData>(field: K, value: OnboardingFormData[K]) => {
    setEditData((current) => current ? { ...current, [field]: value } : current);
  };

  const updateEditContactField = <K extends keyof EmergencyContact>(field: K, value: EmergencyContact[K]) => {
    setEditData((current) => {
      if (!current) return current;
      return {
        ...current,
        emergencyContacts: [{
          ...(current.emergencyContacts[0] || emptyContact),
          [field]: value,
        }],
      };
    });
  };

  const submitReview = async () => {
    if (!reviewTarget) return;

    if (!reviewerName.trim()) {
      alert('请手动输入审核人姓名');
      return;
    }

    setReviewing(true);
    try {
      const response = await fetch(`/api/onboarding/${reviewTarget.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewerName: reviewerName.trim(),
          hrOpinion: hrOpinion.trim() || '同意入职。',
        }),
      });
      const result = await response.json().catch(() => ({})) as MutateResponse;

      if (!response.ok || !result.success || !result.record) {
        throw new Error(result.error || '审核失败');
      }

      setReviewOpen(false);
      setReviewTarget(null);
      setSelectedId(null);
      setDetailVisible(false);
      await loadRecords();
    } catch (reviewError) {
      alert(reviewError instanceof Error ? reviewError.message : '审核失败');
    } finally {
      setReviewing(false);
    }
  };

  const submitEdit = async () => {
    if (!editingRecord || !editData) return;

    if (!editData.name.trim()) {
      alert('姓名不能为空');
      return;
    }
    if (!editData.phone.trim()) {
      alert('联系电话不能为空');
      return;
    }
    if (!editData.position.trim()) {
      alert('入职岗位不能为空');
      return;
    }

    setSavingEdit(true);
    try {
      const response = await fetch(`/api/onboarding/${editingRecord.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: editData }),
      });
      const result = await response.json().catch(() => ({})) as MutateResponse;

      if (!response.ok || !result.success || !result.record) {
        throw new Error(result.error || '修改失败');
      }

      setRecords((current) => current.map((record) => (record.id === result.record?.id ? result.record : record)));
      setSelectedId(result.record.id);
      setEditOpen(false);
      setEditingRecord(null);
      setEditData(null);
      await loadRecords();
    } catch (editError) {
      alert(editError instanceof Error ? editError.message : '修改失败');
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteRecord = async (record: OnboardingRecord) => {
    if (!confirm(`确定删除 ${record.name} 的入职登记吗？`)) return;

    try {
      const response = await fetch(`/api/onboarding/${record.id}`, { method: 'DELETE' });
      const result = await response.json().catch(() => ({})) as MutateResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error || '删除失败');
      }

      if (selectedId === record.id) {
        setSelectedId(null);
        setDetailVisible(false);
      }
      await loadRecords();
    } catch (deleteError) {
      alert(deleteError instanceof Error ? deleteError.message : '删除失败');
    }
  };

  const resignRecord = async (record: OnboardingRecord) => {
    if (record.status !== '已审核') return;
    if (!confirm(`确定将 ${record.name} 标记为已离职吗？`)) return;

    try {
      const response = await fetch(`/api/onboarding/${record.id}/resign`, { method: 'PATCH' });
      const result = await response.json().catch(() => ({})) as MutateResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error || '设置离职失败');
      }

      setSelectedId(null);
      setDetailVisible(false);
      setActiveStatus('已离职');
    } catch (resignError) {
      alert(resignError instanceof Error ? resignError.message : '设置离职失败');
    }
  };

  const ensurePrintable = (record: OnboardingRecord) => {
    if (canOutput(record)) return true;
    alert('请先完成人事审核，审核后才能导出和打印登记表');
    return false;
  };

  const exportRecord = (record: OnboardingRecord) => {
    if (!ensurePrintable(record)) return;
    window.open(`/api/onboarding/${record.id}/export`, '_blank', 'noopener,noreferrer');
  };

  const printRecord = (record: OnboardingRecord) => {
    if (!ensurePrintable(record)) return;
    window.open(`/api/onboarding/${record.id}/print`, '_blank', 'noopener,noreferrer');
  };

  const openRegularizationView = (record: RegularizationRecord) => {
    setRegularizationViewTarget(record);
    setRegularizationViewOpen(true);
  };

  const openRegularizationReview = (record: RegularizationRecord) => {
    setRegularizationReviewTarget(record);
    setRegularizationReviewData(JSON.parse(JSON.stringify(record.data)) as RegularizationFormData);
    setRegularizationReviewOpen(true);
  };

  const openRegularizationEdit = (record: RegularizationRecord) => {
    setRegularizationEditTarget(record);
    setRegularizationEditData(JSON.parse(JSON.stringify(record.data)) as RegularizationFormData);
    setRegularizationEditOpen(true);
  };

  const updateRegularizationEditField = <K extends keyof RegularizationFormData>(field: K, value: RegularizationFormData[K]) => {
    setRegularizationEditData((current) => current ? { ...current, [field]: value } : current);
  };

  const updateRegularizationReviewField = <K extends keyof RegularizationFormData>(field: K, value: RegularizationFormData[K]) => {
    setRegularizationReviewData((current) => current ? { ...current, [field]: value } : current);
  };

  const submitRegularizationReview = async () => {
    if (!regularizationReviewTarget || !regularizationReviewData) return;

    setRegularizationReviewing(true);
    try {
      const response = await fetch(`/api/regularization/${regularizationReviewTarget.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: regularizationReviewData }),
      });
      const result = await response.json().catch(() => ({})) as RegularizationMutateResponse;
      if (!response.ok || !result.success || !result.record) {
        throw new Error(result.error || '审核转正申请失败');
      }
      setRegularizationReviewOpen(false);
      setRegularizationReviewTarget(null);
      setRegularizationReviewData(null);
      await loadRegularizationRecords();
    } catch (reviewError) {
      alert(reviewError instanceof Error ? reviewError.message : '审核转正申请失败');
    } finally {
      setRegularizationReviewing(false);
    }
  };

  const submitRegularizationEdit = async () => {
    if (!regularizationEditTarget || !regularizationEditData) return;
    setRegularizationSavingEdit(true);
    try {
      const response = await fetch(`/api/regularization/${regularizationEditTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: regularizationEditData }),
      });
      const result = await response.json().catch(() => ({})) as RegularizationMutateResponse;
      if (!response.ok || !result.success || !result.record) {
        throw new Error(result.error || '修改转正申请失败');
      }
      setRegularizationEditOpen(false);
      setRegularizationEditTarget(null);
      setRegularizationEditData(null);
      await loadRegularizationRecords();
    } catch (editError) {
      alert(editError instanceof Error ? editError.message : '修改转正申请失败');
    } finally {
      setRegularizationSavingEdit(false);
    }
  };

  const deleteRegularizationRecord = async (record: RegularizationRecord) => {
    if (!confirm(`确定删除 ${record.applicantName} 的转正申请吗？删除后一周内可恢复，超过一周会完全删除。`)) return;
    try {
      const response = await fetch(`/api/regularization/${record.id}`, { method: 'DELETE' });
      const result = await response.json().catch(() => ({})) as RegularizationMutateResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '删除转正申请失败');
      }
      await loadRegularizationRecords();
    } catch (deleteError) {
      alert(deleteError instanceof Error ? deleteError.message : '删除转正申请失败');
    }
  };

  const restoreRegularizationRecord = async (record: RegularizationRecord) => {
    try {
      const response = await fetch(`/api/regularization/${record.id}/restore`, { method: 'PATCH' });
      const result = await response.json().catch(() => ({})) as RegularizationMutateResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '恢复转正申请失败');
      }
      await loadRegularizationRecords();
    } catch (restoreError) {
      alert(restoreError instanceof Error ? restoreError.message : '恢复转正申请失败');
    }
  };

  const exportRegularizationRecord = (record: RegularizationRecord) => {
    if (record.status !== '已审核') {
      alert('请先审核转正申请，再导出表格');
      return;
    }
    window.open(`/api/regularization/${record.id}/export`, '_blank', 'noopener,noreferrer');
    setTimeout(() => void loadRegularizationRecords(), 800);
  };

  const openWorkCertificateReview = (record: WorkCertificateRecord) => {
    setWorkCertificateFormMode('review');
    setWorkCertificateReviewTarget(record);
    setWorkCertificateReviewData(JSON.parse(JSON.stringify(record.data)) as WorkCertificateFormData);
    setWorkCertificateReviewOpen(true);
  };

  const openWorkCertificateEdit = (record: WorkCertificateRecord) => {
    setWorkCertificateFormMode('edit');
    setWorkCertificateReviewTarget(record);
    setWorkCertificateReviewData(JSON.parse(JSON.stringify(record.data)) as WorkCertificateFormData);
    setWorkCertificateReviewOpen(true);
  };

  const updateWorkCertificateReviewField = <K extends keyof WorkCertificateFormData>(field: K, value: WorkCertificateFormData[K]) => {
    setWorkCertificateReviewData((current) => current ? { ...current, [field]: value } : current);
  };

  const submitWorkCertificateReview = async () => {
    if (!workCertificateReviewTarget || !workCertificateReviewData) return;
    setWorkCertificateReviewing(true);
    try {
      const response = await fetch(
        workCertificateFormMode === 'review'
          ? `/api/work-certificate/${workCertificateReviewTarget.id}/review`
          : `/api/work-certificate/${workCertificateReviewTarget.id}`,
        {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: workCertificateReviewData }),
        },
      );
      const result = await response.json().catch(() => ({})) as WorkCertificateMutateResponse;
      if (!response.ok || !result.success || !result.record) {
        throw new Error(result.error || (workCertificateFormMode === 'review' ? '审核工作证明失败' : '修改工作证明失败'));
      }
      setWorkCertificateReviewOpen(false);
      setWorkCertificateReviewTarget(null);
      setWorkCertificateReviewData(null);
      if (workCertificateFormMode === 'review') {
        setWorkCertificateListMode('reviewed');
      }
      await loadWorkCertificateRecords();
    } catch (reviewError) {
      alert(reviewError instanceof Error ? reviewError.message : (workCertificateFormMode === 'review' ? '审核工作证明失败' : '修改工作证明失败'));
    } finally {
      setWorkCertificateReviewing(false);
    }
  };

  const deleteWorkCertificateRecord = async (record: WorkCertificateRecord) => {
    if (!confirm(`确定删除 ${record.name} 的工作证明申请吗？删除后一周内可恢复，超过一周会完全删除。`)) return;
    try {
      const response = await fetch(`/api/work-certificate/${record.id}`, { method: 'DELETE' });
      const result = await response.json().catch(() => ({})) as WorkCertificateMutateResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '删除工作证明申请失败');
      }
      await loadWorkCertificateRecords();
    } catch (deleteError) {
      alert(deleteError instanceof Error ? deleteError.message : '删除工作证明申请失败');
    }
  };

  const restoreWorkCertificateRecord = async (record: WorkCertificateRecord) => {
    try {
      const response = await fetch(`/api/work-certificate/${record.id}/restore`, { method: 'PATCH' });
      const result = await response.json().catch(() => ({})) as WorkCertificateMutateResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '恢复工作证明申请失败');
      }
      await loadWorkCertificateRecords();
    } catch (restoreError) {
      alert(restoreError instanceof Error ? restoreError.message : '恢复工作证明申请失败');
    }
  };

  const exportWorkCertificateRecord = (record: WorkCertificateRecord) => {
    if (record.status !== '已审核') {
      alert('请先审核工作证明申请，再导出');
      return;
    }
    window.open(`/api/work-certificate/${record.id}/export`, '_blank', 'noopener,noreferrer');
  };

  const openWorkCertificateView = (record: WorkCertificateRecord) => {
    setWorkCertificateViewTarget(record);
    setWorkCertificateViewOpen(true);
  };

  const openLaborTerminationCreate = () => {
    setLaborTerminationFormMode('create');
    setLaborTerminationFormTarget(null);
    setLaborTerminationFormData(createLaborContractTerminationData());
    setLaborTerminationFormOpen(true);
  };

  const openLaborTerminationEdit = (record: LaborContractTerminationRecord) => {
    setLaborTerminationFormMode('edit');
    setLaborTerminationFormTarget(record);
    setLaborTerminationFormData(JSON.parse(JSON.stringify(record.data)) as LaborContractTerminationFormData);
    setLaborTerminationFormOpen(true);
  };

  const openLaborTerminationView = (record: LaborContractTerminationRecord) => {
    setLaborTerminationViewTarget(record);
    setLaborTerminationViewOpen(true);
  };

  const updateLaborTerminationField = <K extends keyof LaborContractTerminationFormData>(field: K, value: LaborContractTerminationFormData[K]) => {
    setLaborTerminationFormData((current) => ({ ...current, [field]: value }));
  };

  const submitLaborTerminationForm = async () => {
    setLaborTerminationSaving(true);
    try {
      const response = await fetch(
        laborTerminationFormMode === 'create'
          ? '/api/labor-contract-termination'
          : `/api/labor-contract-termination/${laborTerminationFormTarget?.id}`,
        {
          method: laborTerminationFormMode === 'create' ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: laborTerminationFormData }),
        },
      );
      const result = await response.json().catch(() => ({})) as LaborContractTerminationMutateResponse;
      if (!response.ok || !result.success || !result.record) {
        throw new Error(result.error || (laborTerminationFormMode === 'create' ? '保存解除劳动合同通知书失败' : '修改解除劳动合同通知书失败'));
      }
      setLaborTerminationFormOpen(false);
      setLaborTerminationFormTarget(null);
      await loadLaborTerminationRecords();
    } catch (saveError) {
      alert(saveError instanceof Error ? saveError.message : '保存解除劳动合同通知书失败');
    } finally {
      setLaborTerminationSaving(false);
    }
  };

  const deleteLaborTerminationRecord = async (record: LaborContractTerminationRecord) => {
    if (!confirm(`确定删除 ${record.employeeName} 的解除劳动合同通知书吗？删除后一周内可恢复，超过一周会完全删除。`)) return;
    try {
      const response = await fetch(`/api/labor-contract-termination/${record.id}`, { method: 'DELETE' });
      const result = await response.json().catch(() => ({})) as LaborContractTerminationMutateResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '删除解除劳动合同通知书失败');
      }
      await loadLaborTerminationRecords();
    } catch (deleteError) {
      alert(deleteError instanceof Error ? deleteError.message : '删除解除劳动合同通知书失败');
    }
  };

  const restoreLaborTerminationRecord = async (record: LaborContractTerminationRecord) => {
    try {
      const response = await fetch(`/api/labor-contract-termination/${record.id}/restore`, { method: 'PATCH' });
      const result = await response.json().catch(() => ({})) as LaborContractTerminationMutateResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '恢复解除劳动合同通知书失败');
      }
      await loadLaborTerminationRecords();
    } catch (restoreError) {
      alert(restoreError instanceof Error ? restoreError.message : '恢复解除劳动合同通知书失败');
    }
  };

  const exportLaborTerminationRecord = (record: LaborContractTerminationRecord) => {
    window.open(`/api/labor-contract-termination/${record.id}/export`, '_blank', 'noopener,noreferrer');
    setTimeout(() => void loadLaborTerminationRecords(), 800);
  };

  const printLaborTerminationRecord = (record: LaborContractTerminationRecord) => {
    window.open(`/api/labor-contract-termination/${record.id}/print`, '_blank', 'noopener,noreferrer');
    setTimeout(() => void loadLaborTerminationRecords(), 800);
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-slate-50 p-4 text-slate-950 md:p-6">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm text-slate-500">
            人事管理 / <span className="text-slate-800">{currentSectionLabel}</span>
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-normal text-slate-950">{currentSectionLabel}</h1>
        </div>
        <div className="flex flex-wrap items-start justify-end gap-2">
          <div className="group relative z-30">
            <Button className="bg-blue-600 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md">
              <Plus className="h-4 w-4" />
              人事办理
              <ChevronDown className="h-4 w-4 transition-transform duration-200 group-hover:rotate-180 group-focus-within:rotate-180" />
            </Button>
            <div className="pointer-events-none absolute right-0 top-full w-[620px] max-w-[calc(100vw-2rem)] origin-top-right translate-y-1 pt-2 opacity-0 transition-all duration-200 ease-out group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100">
              <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-xl ring-1 ring-slate-900/5">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <Link
                    href="/onboarding"
                    target="_blank"
                    className="flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-100 hover:shadow-sm"
                  >
                    <Plus className="h-4 w-4" />
                    员工入职
                  </Link>
                  <Link
                    href="/regularization"
                    target="_blank"
                    className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:shadow-sm"
                  >
                    <FileCheck2 className="h-4 w-4" />
                    转正申请
                  </Link>
                  <Link
                    href="/work-certificate"
                    target="_blank"
                    className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:shadow-sm"
                  >
                    <FileCheck2 className="h-4 w-4" />
                    工作证明
                  </Link>
                  <Link
                    href="/resignation"
                    target="_blank"
                    className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:shadow-sm"
                  >
                    <FileCheck2 className="h-4 w-4" />
                    离职申请
                  </Link>
                  <Link
                    href="/resignation-certificate"
                    target="_blank"
                    className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:shadow-sm"
                  >
                    <FileCheck2 className="h-4 w-4" />
                    离职证明
                  </Link>
                  <Link
                    href="#social-security-management"
                    className="flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-100 hover:shadow-sm"
                  >
                    <FileCheck2 className="h-4 w-4" />
                    社保管理
                  </Link>
                  <Link
                    href="/social-security?type=no_purchase"
                    target="_blank"
                    className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:shadow-sm"
                  >
                    <FileCheck2 className="h-4 w-4" />
                    不购买社保
                  </Link>
                  <Link
                    href="/social-security?type=waiver"
                    target="_blank"
                    className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:shadow-sm"
                  >
                    <FileCheck2 className="h-4 w-4" />
                    放弃社保
                  </Link>
                </div>
              </div>
            </div>
          </div>
          {section === 'onboarding' && (
            <>
              <Button
                variant="outline"
                disabled={!canOutput(selectedRecord)}
                onClick={() => selectedRecord && exportRecord(selectedRecord)}
              >
                <Download className="h-4 w-4" />
                导出登记表
              </Button>
              <Button
                variant="outline"
                disabled={!canOutput(selectedRecord)}
                onClick={() => selectedRecord && printRecord(selectedRecord)}
              >
                <Printer className="h-4 w-4" />
                打印件
              </Button>
            </>
          )}
        </div>
      </div>

      {section === 'onboarding' && (
      <>
      <div className="mb-4 rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_150px_160px_160px_auto] md:items-end">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">姓名 / 手机号 / 身份证号</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') runSearch();
                }}
                placeholder="请输入关键词"
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">招聘来源</label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger>
                <SelectValue placeholder="请选择" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {sourceOptions.map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">入职开始</label>
            <Input type="date" value={dateStart} onChange={(event) => setDateStart(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">入职结束</label>
            <Input type="date" value={dateEnd} onChange={(event) => setDateEnd(event.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="min-w-20" onClick={resetFilters}>
              重置
            </Button>
            <Button className="min-w-20 bg-blue-600 hover:bg-blue-700" onClick={runSearch}>
              查询
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className={cn('grid gap-4', detailVisible && selectedRecord ? 'xl:grid-cols-[minmax(0,1fr)_440px]' : 'grid-cols-1')}>
        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {statItems.map((item) => (
              <StatCard key={item.label} {...item} />
            ))}
          </div>

          <div className="rounded-lg border border-slate-100 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950">{activeStatus}列表</h2>
                <p className="mt-1 text-sm text-slate-500">当前展示 {visibleRecords.length} 条记录</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Tabs value={activeStatus} onValueChange={changeStatusPage}>
                  <TabsList className="grid h-10 grid-cols-3 bg-slate-100 p-1">
                    {statusPages.map((item) => (
                      <TabsTrigger key={item.status} value={item.status} className="min-w-24 px-3 text-sm">
                        {item.label}
                        <span className="ml-1 text-xs text-slate-500">{item.count}</span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <Button variant="outline" size="sm" onClick={() => void loadRecords()} disabled={loading}>
                  <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
                  刷新
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead className="w-14">序号</TableHead>
                    <TableHead>姓名</TableHead>
                    <TableHead>性别</TableHead>
                    <TableHead>手机号</TableHead>
                    <TableHead>入职岗位</TableHead>
                    <TableHead>入职日期</TableHead>
                    <TableHead>招聘来源</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>填表日期</TableHead>
                    <TableHead className="min-w-72">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <YearMonthGroupedTableBody
                  records={visibleRecords}
                  loading={loading}
                  colSpan={10}
                  loadingText="正在加载入职登记..."
                  emptyText={`暂无${activeStatus}记录`}
                  getDate={(record) => record.createdAt}
                  renderRow={(record) => {
                    const index = visibleRecords.findIndex((item) => item.id === record.id);
                    return (
                    <TableRow
                      key={record.id}
                      className={cn(selectedRecord?.id === record.id && detailVisible && 'bg-blue-50/60')}
                    >
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">{record.name}</TableCell>
                      <TableCell>{record.gender}</TableCell>
                      <TableCell>{maskPhone(record.phone)}</TableCell>
                      <TableCell>{display(record.position)}</TableCell>
                      <TableCell>{formatDate(record.hireDate)}</TableCell>
                      <TableCell>{display(record.recruitmentSource)}</TableCell>
                      <TableCell><StatusBadge status={record.status} /></TableCell>
                      <TableCell>{formatDateTime(record.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <button type="button" className="text-sm font-medium text-blue-600 hover:text-blue-700" onClick={() => showDetail(record)}>
                            查看
                          </button>
                          <button type="button" className="text-sm font-medium text-blue-600 hover:text-blue-700" onClick={() => openEdit(record)}>
                            修改
                          </button>
                          <button type="button" className="text-sm font-medium text-red-600 hover:text-red-700" onClick={() => void deleteRecord(record)}>
                            删除
                          </button>
                          {record.status === '待审核' && (
                            <button type="button" className="text-sm font-medium text-blue-600 hover:text-blue-700" onClick={() => openReview(record)}>
                              审核
                            </button>
                          )}
                          {record.status === '已审核' && (
                            <button type="button" className="text-sm font-medium text-orange-600 hover:text-orange-700" onClick={() => void resignRecord(record)}>
                              已离职
                            </button>
                          )}
                          {canOutput(record) && (
                            <>
                              <button type="button" className="text-sm font-medium text-blue-600 hover:text-blue-700" onClick={() => exportRecord(record)}>
                                导出
                              </button>
                              <button type="button" className="text-sm font-medium text-blue-600 hover:text-blue-700" onClick={() => printRecord(record)}>
                                打印
                              </button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  }}
                />
              </Table>
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>共 {visibleRecords.length} 条</span>
              <span>导出和打印必须先完成人事审核；打印使用浏览器打印页面</span>
            </div>
          </div>
        </div>

        {detailVisible && selectedRecord && (
          <aside className="overflow-hidden rounded-lg border border-slate-100 bg-white shadow-sm xl:sticky xl:top-20 xl:h-[calc(100vh-7rem)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-950">入职登记详情</h2>
                <p className="mt-1 text-sm text-slate-500">{selectedRecord.name} - {display(selectedRecord.position)}</p>
              </div>
              <button
                type="button"
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                onClick={() => setDetailVisible(false)}
                aria-label="关闭详情"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <Tabs value={detailTab} onValueChange={setDetailTab} className="h-[calc(100%-4.5rem)] gap-0">
              <div className="border-b border-slate-100 px-5 pt-3">
                <TabsList className="h-9 bg-transparent p-0">
                  <TabsTrigger value="basic" className="rounded-none border-b-2 border-transparent px-3 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none">
                    基本信息
                  </TabsTrigger>
                  <TabsTrigger value="notice" className="rounded-none border-b-2 border-transparent px-3 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none">
                    入厂须知
                  </TabsTrigger>
                  <TabsTrigger value="health" className="rounded-none border-b-2 border-transparent px-3 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none">
                    健康信息
                  </TabsTrigger>
                  <TabsTrigger value="review" className="rounded-none border-b-2 border-transparent px-3 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none">
                    审核签名
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="h-[calc(100%-7rem)] overflow-y-auto">
                <TabsContent value="basic" className="m-0">
                  <DetailSection title="个人基本信息">
                    <DetailGrid
                      pairs={[
                        ['姓名', selectedRecord.data.name],
                        ['性别', selectedRecord.data.gender],
                        ['民族', selectedRecord.data.ethnicity],
                        ['籍贯', selectedRecord.data.nativePlace],
                        ['学历', selectedRecord.data.education],
                        ['政治面貌', selectedRecord.data.politicalStatus],
                        ['婚姻状况', selectedRecord.data.maritalStatus],
                        ['身份证号', selectedRecord.data.idCard],
                        ['联系电话', selectedRecord.data.phone],
                        ['微信/QQ', selectedRecord.data.wechat],
                        ['邮箱', selectedRecord.data.email],
                      ]}
                    />
                  </DetailSection>
                  <DetailSection title="紧急联系人">
                    <DetailGrid
                      pairs={[
                        ['姓名', contact?.name],
                        ['关系', contact?.relation],
                        ['联系电话', contact?.phone],
                        ['单位住址', contact?.address],
                      ]}
                    />
                  </DetailSection>
                  <DetailSection title="岗位信息">
                    <DetailGrid
                      pairs={[
                        ['入职岗位', selectedRecord.data.position],
                        ['所属部门', selectedRecord.data.department],
                        ['入职日期', formatDate(selectedRecord.data.hireDate)],
                        ['填表日期', formatDate(selectedRecord.data.fillDate)],
                        ['招聘来源', selectedRecord.recruitmentSource],
                        ['使用机器', selectedRecord.data.machineAgreement],
                        ['工资方式', selectedRecord.data.wageMethod],
                      ]}
                    />
                  </DetailSection>
                </TabsContent>

                <TabsContent value="notice" className="m-0">
                  <DetailSection title="合同与试用信息">
                    <DetailGrid
                      pairs={[
                        ['合同期限', selectedRecord.data.contractTerm],
                        ['试用期', selectedRecord.data.probationMonths ? `${selectedRecord.data.probationMonths} 个月` : ''],
                        ['试用工资', money(selectedRecord.data.probationSalary)],
                        ['工资方式', selectedRecord.data.wageMethod],
                      ]}
                    />
                  </DetailSection>
                  <DetailSection title="员工承诺">
                    <div className="space-y-3 text-sm leading-6 text-slate-700">
                      <p>本人确认已了解岗位、工作地点、工作条件、职业危害、安全生产状况、劳动报酬及相关规章制度。</p>
                      <p>本人承诺填写的入职登记信息真实有效，如有虚假，用人单位可按制度处理。</p>
                      <p className="text-blue-600">{selectedRecord.data.promiseConfirmed ? '员工已确认承诺内容' : '员工未确认承诺内容'}</p>
                    </div>
                  </DetailSection>
                </TabsContent>

                <TabsContent value="health" className="m-0">
                  <DetailSection title="健康信息">
                    <DetailGrid
                      pairs={[
                        ['利手', selectedRecord.data.dominantHand],
                        ['重大疾病', withNote(selectedRecord.data.majorDisease, selectedRecord.data.majorDiseaseNote)],
                        ['残疾证明', withNote(selectedRecord.data.disabilityProof, selectedRecord.data.disabilityProofNote)],
                        ['繁重工种', withNote(selectedRecord.data.heavyWork, selectedRecord.data.heavyWorkNote)],
                        ['职业疾病', withNote(selectedRecord.data.occupationalDisease, selectedRecord.data.occupationalDiseaseNote)],
                      ]}
                    />
                  </DetailSection>
                </TabsContent>

                <TabsContent value="review" className="m-0">
                  <DetailSection title="电子签名">
                    {selectedRecord.data.signatureDataUrl ? (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3">
                        {/* eslint-disable-next-line @next/next/no-img-element -- Employee signatures are stored as local data URLs. */}
                        <img
                          src={selectedRecord.data.signatureDataUrl}
                          alt={`${selectedRecord.name}签名`}
                          className="mx-auto h-24 max-w-full object-contain"
                        />
                        <p className="mt-2 text-center text-sm text-slate-500">签名日期：{formatDate(selectedRecord.data.signatureDate)}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">暂无电子签名</p>
                    )}
                  </DetailSection>
                  <DetailSection title="人事部门意见">
                    <div className="space-y-3 text-sm text-slate-700">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">状态</span>
                        <StatusBadge status={selectedRecord.status} />
                      </div>
                      {selectedRecord.status !== '待审核' ? (
                        <DetailGrid
                          pairs={[
                            ['审核意见', selectedRecord.hrOpinion],
                            ['审核人', selectedRecord.reviewerName],
                            ['审核日期', formatDateTime(selectedRecord.reviewedAt)],
                            ['员工档案ID', selectedRecord.employeeId],
                          ]}
                        />
                      ) : (
                        <p className="rounded-md bg-orange-50 px-3 py-2 text-orange-700">
                          待人事审核。审核时必须手动输入审核人姓名，审核完成后才能导出和打印登记表。
                        </p>
                      )}
                    </div>
                  </DetailSection>
                </TabsContent>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-slate-100 px-5 py-3">
                <Button variant="outline" className="flex-1" onClick={() => setDetailVisible(false)}>
                  关闭
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => openEdit(selectedRecord)}>
                  <Pencil className="h-4 w-4" />
                  修改
                </Button>
                {selectedRecord.status === '待审核' ? (
                  <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={() => openReview(selectedRecord)}>
                    <FileCheck2 className="h-4 w-4" />
                    审核
                  </Button>
                ) : (
                  <>
                    {selectedRecord.status === '已审核' && (
                      <Button variant="outline" className="flex-1 border-orange-200 text-orange-700 hover:bg-orange-50" onClick={() => void resignRecord(selectedRecord)}>
                        <UserMinus className="h-4 w-4" />
                        已离职
                      </Button>
                    )}
                    <Button variant="outline" className="flex-1" onClick={() => exportRecord(selectedRecord)}>
                      <Download className="h-4 w-4" />
                      导出
                    </Button>
                    <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={() => printRecord(selectedRecord)}>
                      <Printer className="h-4 w-4" />
                      打印
                    </Button>
                  </>
                )}
              </div>
            </Tabs>
          </aside>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <ClipboardCheck className="h-4 w-4 text-blue-600" />
            入职审核流程
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            员工提交登记后进入待审核页。人事审核时填写审核意见和审核人姓名，系统同步建立员工档案；审核后可导出登记表或通过浏览器打印，已离职人员归入单独页面。
          </p>
        </div>
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
              <UserRound className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-950">员工扫码填写页面</p>
              <p className="text-xs text-slate-500">/onboarding</p>
            </div>
          </div>
          <Button asChild variant="outline" className="mt-4 w-full border-blue-200 bg-white text-blue-700 hover:bg-blue-50">
            <Link href="/onboarding" target="_blank">
              打开登记页
            </Link>
          </Button>
        </div>
      </div>

      </>
      )}

      {section === 'social-security' && <SocialSecurityAdminSection mode="applications" />}

      {section === 'social-security-purchase' && <SocialSecurityAdminSection mode="purchase" />}

      {section === 'regularization' && (
      <div id="personnel-regularization-section" className="scroll-mt-24 mt-4 rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <FileCheck2 className="h-4 w-4 text-blue-600" />
              转正申请
            </div>
            <p className="mt-1 text-sm text-slate-500">移动端提交后在这里查看，导出时使用你提供的员工转正申请表模板。</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={regularizationListMode === 'pending' ? 'default' : 'outline'}
              className={regularizationListMode === 'pending' ? 'bg-slate-950 hover:bg-slate-800' : ''}
              onClick={() => setRegularizationListMode('pending')}
            >
              待审核
            </Button>
            <Button
              variant={regularizationListMode === 'reviewed' ? 'default' : 'outline'}
              className={regularizationListMode === 'reviewed' ? 'bg-slate-950 hover:bg-slate-800' : ''}
              onClick={() => setRegularizationListMode('reviewed')}
            >
              已审核
            </Button>
            <Button
              variant={regularizationListMode === 'deleted' ? 'default' : 'outline'}
              className={regularizationListMode === 'deleted' ? 'bg-slate-950 hover:bg-slate-800' : ''}
              onClick={() => setRegularizationListMode('deleted')}
            >
              已删除
            </Button>
            <Button asChild variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
              <Link href="/regularization" target="_blank">打开移动端入口</Link>
            </Button>
            <Button variant="outline" onClick={() => void loadRegularizationRecords()} disabled={regularizationLoading}>
              {regularizationLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              刷新
            </Button>
          </div>
        </div>

        {regularizationError && (
          <div className="mt-3 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            {regularizationError}
          </div>
        )}

        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>申请人</TableHead>
                <TableHead>部门</TableHead>
                <TableHead>岗位</TableHead>
                <TableHead>入职日期</TableHead>
                <TableHead>转正日期</TableHead>
                <TableHead>状态</TableHead>
                {regularizationListMode === 'deleted' && <TableHead>恢复截止</TableHead>}
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <YearMonthGroupedTableBody
              records={regularizationRecords}
              loading={regularizationLoading}
              colSpan={regularizationListMode === 'deleted' ? 8 : 7}
              loadingText="正在加载转正申请..."
              emptyText={regularizationListMode === 'deleted' ? '暂无已删除转正申请记录' : regularizationListMode === 'pending' ? '暂无待审核转正申请记录' : '暂无已审核转正申请记录'}
              getDate={(record) => record.createdAt}
              renderRow={(record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium text-slate-900">{display(record.applicantName)}</TableCell>
                  <TableCell>{display(record.department)}</TableCell>
                  <TableCell>{display(record.position)}</TableCell>
                  <TableCell>{formatDate(record.hireDate)}</TableCell>
                  <TableCell>{formatDate(record.regularizationDate)}</TableCell>
                  <TableCell>{record.status}</TableCell>
                  {regularizationListMode === 'deleted' && <TableCell>{formatDateTime(record.restoreUntil)}</TableCell>}
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => openRegularizationView(record)}>
                      <Eye className="h-4 w-4" />
                      查看
                    </Button>
                    {regularizationListMode === 'deleted' ? (
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => restoreRegularizationRecord(record)}>
                        <RotateCcw className="h-4 w-4" />
                        恢复
                      </Button>
                    ) : (
                      <>
                    <Button variant="outline" size="sm" onClick={() => openRegularizationEdit(record)}>
                      <Pencil className="h-4 w-4" />
                      修改
                    </Button>
                    {record.status === '已审核' ? (
                      <Button variant="outline" size="sm" onClick={() => exportRegularizationRecord(record)}>
                        <Download className="h-4 w-4" />
                        导出
                      </Button>
                    ) : (
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => openRegularizationReview(record)}>
                        <FileCheck2 className="h-4 w-4" />
                        审核
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => deleteRegularizationRecord(record)}>
                      <Trash2 className="h-4 w-4" />
                      删除
                    </Button>
                      </>
                    )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            />
          </Table>
        </div>
      </div>
      )}

      {section === 'work-certificate' && (
      <div id="personnel-work-certificate-section" className="scroll-mt-24 mt-4 rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <FileCheck2 className="h-4 w-4 text-blue-600" />
              工作证明申请
            </div>
            <p className="mt-1 text-sm text-slate-500">员工移动端只填写个人信息，后台审核时填写部门、岗位、入职日期和证明日期。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={workCertificateListMode === 'pending' ? 'default' : 'outline'}
              className={workCertificateListMode === 'pending' ? 'bg-slate-950 hover:bg-slate-800' : ''}
              onClick={() => setWorkCertificateListMode('pending')}
            >
              待审核
            </Button>
            <Button
              variant={workCertificateListMode === 'reviewed' ? 'default' : 'outline'}
              className={workCertificateListMode === 'reviewed' ? 'bg-slate-950 hover:bg-slate-800' : ''}
              onClick={() => setWorkCertificateListMode('reviewed')}
            >
              已审核
            </Button>
            <Button
              variant={workCertificateListMode === 'deleted' ? 'default' : 'outline'}
              className={workCertificateListMode === 'deleted' ? 'bg-slate-950 hover:bg-slate-800' : ''}
              onClick={() => setWorkCertificateListMode('deleted')}
            >
              已删除
            </Button>
            <Button asChild variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
              <Link href="/work-certificate" target="_blank">打开移动端入口</Link>
            </Button>
            <Button variant="outline" onClick={() => void loadWorkCertificateRecords()} disabled={workCertificateLoading}>
              {workCertificateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              刷新
            </Button>
          </div>
        </div>

        {workCertificateError && (
          <div className="mt-3 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            {workCertificateError}
          </div>
        )}

        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>姓名</TableHead>
                <TableHead>性别</TableHead>
                <TableHead>身份证</TableHead>
                <TableHead>部门</TableHead>
                <TableHead>岗位</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <YearMonthGroupedTableBody
              records={workCertificateRecords}
              loading={workCertificateLoading}
              colSpan={7}
              loadingText="正在加载工作证明申请..."
              emptyText={workCertificateListMode === 'pending'
                ? '暂无待审核工作证明申请'
                : workCertificateListMode === 'reviewed'
                  ? '暂无已审核工作证明申请'
                  : '暂无已删除工作证明申请'}
              getDate={(record) => record.createdAt}
              renderRow={(record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium text-slate-900">{display(record.name)}</TableCell>
                  <TableCell>{display(record.gender)}</TableCell>
                  <TableCell>{display(record.idCard)}</TableCell>
                  <TableCell>{display(record.department)}</TableCell>
                  <TableCell>{display(record.position)}</TableCell>
                  <TableCell>{record.deletedAt ? '已删除' : record.status}</TableCell>
                  <TableCell className="text-right">
                    {workCertificateListMode === 'deleted' ? (
                      <div className="flex flex-wrap justify-end gap-2">
                        <span className="self-center text-xs text-slate-500">保留至 {record.restoreUntil || '-'}</span>
                        <Button variant="outline" size="sm" onClick={() => openWorkCertificateView(record)}>
                          <Eye className="h-4 w-4" />
                          查看
                        </Button>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => restoreWorkCertificateRecord(record)}>
                          <RotateCcw className="h-4 w-4" />
                          恢复
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openWorkCertificateView(record)}>
                          <Eye className="h-4 w-4" />
                          查看
                        </Button>
                        {record.status === '已审核' ? (
                          <Button variant="outline" size="sm" onClick={() => exportWorkCertificateRecord(record)}>
                            <Download className="h-4 w-4" />
                            导出
                          </Button>
                        ) : (
                          <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => openWorkCertificateReview(record)}>
                            <FileCheck2 className="h-4 w-4" />
                            审核
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => openWorkCertificateEdit(record)}>
                          <Pencil className="h-4 w-4" />
                          修改
                        </Button>
                        <Button variant="outline" size="sm" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => deleteWorkCertificateRecord(record)}>
                          <Trash2 className="h-4 w-4" />
                          删除
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )}
            />
          </Table>
        </div>
      </div>
      )}

      {section === 'resignation' && (
      <div id="personnel-resignation-section" className="scroll-mt-24">
        <ResignationAdminSection />
      </div>
      )}

      {section === 'resignation-certificate' && (
      <div id="personnel-resignation-certificate-section" className="scroll-mt-24">
        <ResignationCertificateAdminSection />
      </div>
      )}

      {section === 'labor-termination' && (
      <div id="personnel-labor-termination-section" className="scroll-mt-24 mt-4 rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <ClipboardCheck className="h-4 w-4 text-red-600" />
              解除劳动合同通知书
            </div>
            <p className="mt-1 text-sm text-slate-500">管理员填写并保存记录，导出和打印都会记录时间；员工确认书部分保持模板原样。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={laborTerminationListMode === 'active' ? 'default' : 'outline'}
              className={laborTerminationListMode === 'active' ? 'bg-slate-950 hover:bg-slate-800' : ''}
              onClick={() => setLaborTerminationListMode('active')}
            >
              在用记录
            </Button>
            <Button
              variant={laborTerminationListMode === 'deleted' ? 'default' : 'outline'}
              className={laborTerminationListMode === 'deleted' ? 'bg-slate-950 hover:bg-slate-800' : ''}
              onClick={() => setLaborTerminationListMode('deleted')}
            >
              已删除
            </Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={openLaborTerminationCreate}>
              <Plus className="h-4 w-4" />
              新增通知书
            </Button>
            <Button variant="outline" onClick={() => void loadLaborTerminationRecords()} disabled={laborTerminationLoading}>
              {laborTerminationLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              刷新
            </Button>
          </div>
        </div>

        {laborTerminationError && (
          <div className="mt-3 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            {laborTerminationError}
          </div>
        )}

        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>员工姓名</TableHead>
                <TableHead>称谓</TableHead>
                <TableHead>解除日期</TableHead>
                <TableHead>办理截止</TableHead>
                <TableHead>通知日期</TableHead>
                <TableHead>导出/打印</TableHead>
                {laborTerminationListMode === 'deleted' && <TableHead>恢复截止</TableHead>}
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <YearMonthGroupedTableBody
              records={laborTerminationRecords}
              loading={laborTerminationLoading}
              colSpan={laborTerminationListMode === 'deleted' ? 8 : 7}
              loadingText="正在加载解除劳动合同通知书..."
              emptyText={laborTerminationListMode === 'deleted' ? '暂无已删除解除劳动合同通知书' : '暂无解除劳动合同通知书记录'}
              getDate={(record) => record.createdAt}
              renderRow={(record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium text-slate-900">{display(record.employeeName)}</TableCell>
                  <TableCell>{display(record.honorific)}</TableCell>
                  <TableCell>{formatDate(record.terminationDate)}</TableCell>
                  <TableCell>{formatDate(record.procedureDeadline)}</TableCell>
                  <TableCell>{formatDate(record.noticeDate)}</TableCell>
                  <TableCell className="text-xs text-slate-600">
                    导出：{formatDateTime(record.exportedAt)}
                    <br />
                    打印：{formatDateTime(record.printedAt)}
                  </TableCell>
                  {laborTerminationListMode === 'deleted' && <TableCell>{formatDateTime(record.restoreUntil)}</TableCell>}
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openLaborTerminationView(record)}>
                        <Eye className="h-4 w-4" />
                        查看
                      </Button>
                      {laborTerminationListMode === 'deleted' ? (
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => restoreLaborTerminationRecord(record)}>
                          <RotateCcw className="h-4 w-4" />
                          恢复
                        </Button>
                      ) : (
                        <>
                          <Button variant="outline" size="sm" onClick={() => openLaborTerminationEdit(record)}>
                            <Pencil className="h-4 w-4" />
                            修改
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => exportLaborTerminationRecord(record)}>
                            <Download className="h-4 w-4" />
                            导出
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => printLaborTerminationRecord(record)}>
                            <Printer className="h-4 w-4" />
                            打印
                          </Button>
                          <Button variant="outline" size="sm" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => deleteLaborTerminationRecord(record)}>
                            <Trash2 className="h-4 w-4" />
                            删除
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            />
          </Table>
        </div>
      </div>
      )}

      {section === 'leave-request' && (
        <div id="personnel-leave-request-section" className="scroll-mt-24">
          <LeaveRequestAdminSection />
        </div>
      )}

      <Dialog open={workCertificateViewOpen} onOpenChange={setWorkCertificateViewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>查看工作证明申请</DialogTitle>
            <DialogDescription>查看员工提交信息、后台审核内容和删除恢复时间。</DialogDescription>
          </DialogHeader>
          {workCertificateViewTarget && (
            <div className="space-y-4">
              <DetailGrid pairs={[
                ['姓名', workCertificateViewTarget.name],
                ['性别', workCertificateViewTarget.gender],
                ['身份证', workCertificateViewTarget.idCard],
                ['电话', workCertificateViewTarget.phone],
                ['部门', workCertificateViewTarget.department],
                ['岗位', workCertificateViewTarget.position],
                ['入职日期', formatDate(workCertificateViewTarget.hireDate)],
                ['用途', workCertificateViewTarget.purpose],
                ['状态', workCertificateViewTarget.deletedAt ? '已删除' : workCertificateViewTarget.status],
                ['审核人', workCertificateViewTarget.reviewerName],
                ['审核时间', formatDateTime(workCertificateViewTarget.reviewedAt)],
                ['删除时间', formatDateTime(workCertificateViewTarget.deletedAt)],
                ['恢复截止', formatDateTime(workCertificateViewTarget.restoreUntil)],
              ]} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setWorkCertificateViewOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={laborTerminationFormOpen} onOpenChange={setLaborTerminationFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{laborTerminationFormMode === 'create' ? '新增解除劳动合同通知书' : '修改解除劳动合同通知书'}</DialogTitle>
            <DialogDescription>这里填写通知书上半部分内容；底部员工确认书和签名横线会保持模板原样。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">员工姓名</label>
              <Input value={laborTerminationFormData.employeeName} onChange={(event) => updateLaborTerminationField('employeeName', event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">称谓</label>
              <Select value={laborTerminationFormData.honorific} onValueChange={(value) => updateLaborTerminationField('honorific', value as LaborContractTerminationFormData['honorific'])}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择称谓" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="女士/先生">女士/先生</SelectItem>
                  <SelectItem value="女士">女士</SelectItem>
                  <SelectItem value="先生">先生</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">解除日期</label>
              <Input type="date" value={laborTerminationFormData.terminationDate} onChange={(event) => updateLaborTerminationField('terminationDate', event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">离职手续办理截止日期</label>
              <Input type="date" value={laborTerminationFormData.procedureDeadline} onChange={(event) => updateLaborTerminationField('procedureDeadline', event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">公司名称</label>
              <Input value={laborTerminationFormData.companyName} onChange={(event) => updateLaborTerminationField('companyName', event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">通知日期</label>
              <Input type="date" value={laborTerminationFormData.noticeDate} onChange={(event) => updateLaborTerminationField('noticeDate', event.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">解除原因</label>
              <Textarea value={laborTerminationFormData.reason} onChange={(event) => updateLaborTerminationField('reason', event.target.value)} rows={3} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">备注</label>
              <Textarea value={laborTerminationFormData.remark} onChange={(event) => updateLaborTerminationField('remark', event.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLaborTerminationFormOpen(false)} disabled={laborTerminationSaving}>取消</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={submitLaborTerminationForm} disabled={laborTerminationSaving}>
              {laborTerminationSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {laborTerminationFormMode === 'create' ? '保存记录' : '保存修改'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={laborTerminationViewOpen} onOpenChange={setLaborTerminationViewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>查看解除劳动合同通知书</DialogTitle>
            <DialogDescription>查看已保存的通知书字段和导出打印记录。</DialogDescription>
          </DialogHeader>
          {laborTerminationViewTarget && (
            <div className="space-y-4">
              <DetailGrid pairs={[
                ['员工姓名', laborTerminationViewTarget.employeeName],
                ['称谓', laborTerminationViewTarget.honorific],
                ['解除日期', formatDate(laborTerminationViewTarget.terminationDate)],
                ['办理截止', formatDate(laborTerminationViewTarget.procedureDeadline)],
                ['通知日期', formatDate(laborTerminationViewTarget.noticeDate)],
                ['公司名称', laborTerminationViewTarget.companyName],
                ['解除原因', laborTerminationViewTarget.reason],
                ['创建人', laborTerminationViewTarget.createdByName],
                ['创建时间', formatDateTime(laborTerminationViewTarget.createdAt)],
                ['导出时间', formatDateTime(laborTerminationViewTarget.exportedAt)],
                ['打印时间', formatDateTime(laborTerminationViewTarget.printedAt)],
                ['删除时间', formatDateTime(laborTerminationViewTarget.deletedAt)],
                ['恢复截止', formatDateTime(laborTerminationViewTarget.restoreUntil)],
              ]} />
              {laborTerminationViewTarget.data.remark && (
                <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                  <div className="mb-1 font-medium text-slate-900">备注</div>
                  {laborTerminationViewTarget.data.remark}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLaborTerminationViewOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={workCertificateReviewOpen} onOpenChange={setWorkCertificateReviewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{workCertificateFormMode === 'review' ? '审核工作证明申请' : '修改工作证明申请'}</DialogTitle>
            <DialogDescription>
              {workCertificateFormMode === 'review'
                ? '员工只填写个人信息，这里由管理员填写证明中的部门、岗位、入职日期和落款信息。'
                : '可修改员工个人信息和证明内容，保存后会同步到导出的工作证明。'}
            </DialogDescription>
          </DialogHeader>
          {workCertificateReviewTarget && workCertificateReviewData && (
            <div className="space-y-5">
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {workCertificateReviewTarget.name} / {display(workCertificateReviewTarget.gender)} / {display(workCertificateReviewTarget.idCard)}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">姓名</label>
                  <Input value={workCertificateReviewData.name} onChange={(event) => updateWorkCertificateReviewField('name', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">性别</label>
                  <Select value={workCertificateReviewData.gender || undefined} onValueChange={(value) => updateWorkCertificateReviewField('gender', value as WorkCertificateFormData['gender'])}>
                    <SelectTrigger>
                      <SelectValue placeholder="请选择性别" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="男">男</SelectItem>
                      <SelectItem value="女">女</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">身份证号</label>
                  <Input value={workCertificateReviewData.idCard} onChange={(event) => updateWorkCertificateReviewField('idCard', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">联系电话</label>
                  <Input value={workCertificateReviewData.phone} onChange={(event) => updateWorkCertificateReviewField('phone', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">部门</label>
                  <Input value={workCertificateReviewData.department} onChange={(event) => updateWorkCertificateReviewField('department', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">岗位</label>
                  <Input value={workCertificateReviewData.position} onChange={(event) => updateWorkCertificateReviewField('position', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">入职日期</label>
                  <Input type="date" value={workCertificateReviewData.hireDate} onChange={(event) => updateWorkCertificateReviewField('hireDate', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">证明日期</label>
                  <Input type="date" value={workCertificateReviewData.issueDate} onChange={(event) => updateWorkCertificateReviewField('issueDate', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">用途</label>
                  <Input value={workCertificateReviewData.purpose} onChange={(event) => updateWorkCertificateReviewField('purpose', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">公司名称</label>
                  <Input value={workCertificateReviewData.companyName} onChange={(event) => updateWorkCertificateReviewField('companyName', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">审核人</label>
                  <Input value={workCertificateReviewData.reviewerName} onChange={(event) => updateWorkCertificateReviewField('reviewerName', event.target.value)} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setWorkCertificateReviewOpen(false)} disabled={workCertificateReviewing}>
              取消
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={submitWorkCertificateReview} disabled={workCertificateReviewing}>
              {workCertificateReviewing && <Loader2 className="h-4 w-4 animate-spin" />}
              {workCertificateFormMode === 'review' ? '完成审核' : '保存修改'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={regularizationViewOpen} onOpenChange={setRegularizationViewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>查看转正申请</DialogTitle>
            <DialogDescription>
              查看员工移动端提交内容和后台审核意见。
            </DialogDescription>
          </DialogHeader>
          {regularizationViewTarget && (
            <div className="space-y-5">
              <DetailSection title="员工填写">
                <DetailGrid
                  pairs={[
                    ['申请人', regularizationViewTarget.applicantName],
                    ['部门', regularizationViewTarget.department],
                    ['岗位', regularizationViewTarget.position],
                    ['填表日期', formatDate(regularizationViewTarget.data.fillDate)],
                    ['入职日期', formatDate(regularizationViewTarget.hireDate)],
                    ['转正日期', formatDate(regularizationViewTarget.regularizationDate)],
                    ['申请日期', formatDate(regularizationViewTarget.data.applicantDate)],
                    ['状态', regularizationViewTarget.status],
                  ]}
                />
                <div className="mt-4">
                  <p className="mb-2 text-sm font-medium text-slate-700">试用期工作小结</p>
                  <div className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                    {regularizationViewTarget.data.workSummary || '-'}
                  </div>
                </div>
                {regularizationViewTarget.data.applicantSignatureDataUrl ? (
                  <div className="mt-4">
                    <p className="mb-2 text-sm font-medium text-slate-700">手写签名</p>
                    {/* eslint-disable-next-line @next/next/no-img-element -- Employee signatures are stored as local data URLs. */}
                    <img
                      src={regularizationViewTarget.data.applicantSignatureDataUrl}
                      alt="申请人签名"
                      className="h-24 max-w-full rounded-md border border-slate-200 bg-white object-contain p-2"
                    />
                  </div>
                ) : null}
              </DetailSection>

              <DetailSection title="部门负责人和相关部门填写">
                <DetailGrid
                  pairs={[
                    ['综合评级', regularizationViewTarget.data.rating],
                    ['转正建议', regularizationViewTarget.data.suggestion],
                    ['建议日期', formatDate(regularizationViewTarget.data.suggestionDate)],
                    ['建议岗位', regularizationViewTarget.data.transferPosition],
                    ['薪酬建议', regularizationViewTarget.data.salarySuggestion],
                    ['薪酬金额', regularizationViewTarget.data.salaryAmount],
                    ['社保意见', regularizationViewTarget.data.socialSecurity],
                    ['社保年月', regularizationViewTarget.data.socialSecurityMonth],
                    ['部门负责人', regularizationViewTarget.data.departmentManager],
                    ['部门日期', formatDate(regularizationViewTarget.data.departmentDate)],
                    ['人资签字', regularizationViewTarget.data.hrLeader],
                    ['人资日期', formatDate(regularizationViewTarget.data.hrDate)],
                    ['公司签字', regularizationViewTarget.data.companyLeader],
                    ['公司日期', formatDate(regularizationViewTarget.data.companyDate)],
                  ]}
                />
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-sm font-medium text-slate-700">其他意见</p>
                    <div className="min-h-16 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                      {regularizationViewTarget.data.otherOpinion || '-'}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-slate-700">人力资源部领导意见</p>
                    <div className="min-h-16 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                      {regularizationViewTarget.data.hrOpinion || '-'}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="mb-2 text-sm font-medium text-slate-700">公司领导意见</p>
                    <div className="min-h-16 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                      {regularizationViewTarget.data.companyOpinion || '-'}
                    </div>
                  </div>
                </div>
              </DetailSection>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegularizationViewOpen(false)}>
              关闭
            </Button>
            {regularizationViewTarget?.status === '待处理' && !regularizationViewTarget.deletedAt && (
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  setRegularizationViewOpen(false);
                  openRegularizationReview(regularizationViewTarget);
                }}
              >
                <FileCheck2 className="h-4 w-4" />
                审核
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={regularizationEditOpen} onOpenChange={setRegularizationEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>修改转正申请</DialogTitle>
            <DialogDescription>
              修改员工提交内容和后台填写内容，保存后会同步更新导出的转正申请表。
            </DialogDescription>
          </DialogHeader>
          {regularizationEditData && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">申请人</label>
                  <Input value={regularizationEditData.applicantName} onChange={(event) => updateRegularizationEditField('applicantName', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">部门</label>
                  <Input value={regularizationEditData.department} onChange={(event) => updateRegularizationEditField('department', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">岗位</label>
                  <Input value={regularizationEditData.position} onChange={(event) => updateRegularizationEditField('position', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">填表日期</label>
                  <Input type="date" value={regularizationEditData.fillDate} onChange={(event) => updateRegularizationEditField('fillDate', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">入职日期</label>
                  <Input type="date" value={regularizationEditData.hireDate} onChange={(event) => updateRegularizationEditField('hireDate', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">转正日期</label>
                  <Input type="date" value={regularizationEditData.regularizationDate} onChange={(event) => updateRegularizationEditField('regularizationDate', event.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">试用期工作小结</label>
                <Textarea value={regularizationEditData.workSummary} onChange={(event) => updateRegularizationEditField('workSummary', event.target.value)} className="min-h-28" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">综合评级</label>
                  <select
                    value={regularizationEditData.rating}
                    onChange={(event) => updateRegularizationEditField('rating', event.target.value as RegularizationFormData['rating'])}
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="">不选择</option>
                    <option value="优秀">优秀</option>
                    <option value="良好">良好</option>
                    <option value="合格">合格</option>
                    <option value="需改进">需改进</option>
                    <option value="不合格">不合格</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">转正建议</label>
                  <select
                    value={regularizationEditData.suggestion}
                    onChange={(event) => updateRegularizationEditField('suggestion', event.target.value as RegularizationFormData['suggestion'])}
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="">不选择</option>
                    <option value="提前转正">提前转正</option>
                    <option value="按期转正">按期转正</option>
                    <option value="辞退">辞退</option>
                    <option value="转岗">转岗</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">建议日期</label>
                  <Input type="date" value={regularizationEditData.suggestionDate} onChange={(event) => updateRegularizationEditField('suggestionDate', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">建议岗位</label>
                  <Input value={regularizationEditData.transferPosition} onChange={(event) => updateRegularizationEditField('transferPosition', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">薪酬建议</label>
                  <select
                    value={regularizationEditData.salarySuggestion}
                    onChange={(event) => updateRegularizationEditField('salarySuggestion', event.target.value as RegularizationFormData['salarySuggestion'])}
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="">不选择</option>
                    <option value="无">无</option>
                    <option value="建议为">建议为</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">薪酬金额</label>
                  <Input value={regularizationEditData.salaryAmount} onChange={(event) => updateRegularizationEditField('salaryAmount', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">社保意见</label>
                  <select
                    value={regularizationEditData.socialSecurity}
                    onChange={(event) => updateRegularizationEditField('socialSecurity', event.target.value as RegularizationFormData['socialSecurity'])}
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="">不选择</option>
                    <option value="不买社保">不买社保</option>
                    <option value="社保起购年月">社保起购年月</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">社保起购年月</label>
                  <Input value={regularizationEditData.socialSecurityMonth} onChange={(event) => updateRegularizationEditField('socialSecurityMonth', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">部门负责人</label>
                  <Input value={regularizationEditData.departmentManager} onChange={(event) => updateRegularizationEditField('departmentManager', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">部门日期</label>
                  <Input type="date" value={regularizationEditData.departmentDate} onChange={(event) => updateRegularizationEditField('departmentDate', event.target.value)} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">其他意见</label>
                  <Textarea value={regularizationEditData.otherOpinion} onChange={(event) => updateRegularizationEditField('otherOpinion', event.target.value)} className="min-h-20" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">人力资源部领导意见</label>
                  <Textarea value={regularizationEditData.hrOpinion} onChange={(event) => updateRegularizationEditField('hrOpinion', event.target.value)} className="min-h-20" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">人资签字</label>
                  <Input value={regularizationEditData.hrLeader} onChange={(event) => updateRegularizationEditField('hrLeader', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">人资日期</label>
                  <Input type="date" value={regularizationEditData.hrDate} onChange={(event) => updateRegularizationEditField('hrDate', event.target.value)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-sm font-medium text-slate-700">公司领导意见</label>
                  <Textarea value={regularizationEditData.companyOpinion} onChange={(event) => updateRegularizationEditField('companyOpinion', event.target.value)} className="min-h-20" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">公司领导签字</label>
                  <Input value={regularizationEditData.companyLeader} onChange={(event) => updateRegularizationEditField('companyLeader', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">公司日期</label>
                  <Input type="date" value={regularizationEditData.companyDate} onChange={(event) => updateRegularizationEditField('companyDate', event.target.value)} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegularizationEditOpen(false)} disabled={regularizationSavingEdit}>
              取消
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={submitRegularizationEdit} disabled={regularizationSavingEdit}>
              {regularizationSavingEdit && <Loader2 className="h-4 w-4 animate-spin" />}
              保存修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={regularizationReviewOpen} onOpenChange={setRegularizationReviewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>审核转正申请</DialogTitle>
            <DialogDescription>
              这里填写模板中“以下由部门负责人和相关部门填写”的内容，审核完成后才能导出完整转正申请表。
            </DialogDescription>
          </DialogHeader>
          {regularizationReviewTarget && regularizationReviewData && (
            <div className="space-y-5">
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {regularizationReviewTarget.applicantName} / {display(regularizationReviewTarget.department)} / {display(regularizationReviewTarget.position)}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">综合评级</label>
                  <select
                    value={regularizationReviewData.rating}
                    onChange={(event) => updateRegularizationReviewField('rating', event.target.value as RegularizationFormData['rating'])}
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="">请选择</option>
                    <option value="优秀">优秀</option>
                    <option value="良好">良好</option>
                    <option value="合格">合格</option>
                    <option value="需改进">需改进</option>
                    <option value="不合格">不合格</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">转正建议</label>
                  <select
                    value={regularizationReviewData.suggestion}
                    onChange={(event) => updateRegularizationReviewField('suggestion', event.target.value as RegularizationFormData['suggestion'])}
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="">不选择</option>
                    <option value="提前转正">提前转正</option>
                    <option value="按期转正">按期转正</option>
                    <option value="辞退">辞退</option>
                    <option value="转岗">转岗</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">建议日期</label>
                  <Input type="date" value={regularizationReviewData.suggestionDate} onChange={(event) => updateRegularizationReviewField('suggestionDate', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">建议岗位</label>
                  <Input value={regularizationReviewData.transferPosition} onChange={(event) => updateRegularizationReviewField('transferPosition', event.target.value)} placeholder="转岗时填写" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">薪酬建议</label>
                  <select
                    value={regularizationReviewData.salarySuggestion}
                    onChange={(event) => updateRegularizationReviewField('salarySuggestion', event.target.value as RegularizationFormData['salarySuggestion'])}
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="">不选择</option>
                    <option value="无">无</option>
                    <option value="建议为">建议为</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">薪酬金额</label>
                  <Input value={regularizationReviewData.salaryAmount} onChange={(event) => updateRegularizationReviewField('salaryAmount', event.target.value)} placeholder="例如 4500元/月" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">社保意见</label>
                  <select
                    value={regularizationReviewData.socialSecurity}
                    onChange={(event) => updateRegularizationReviewField('socialSecurity', event.target.value as RegularizationFormData['socialSecurity'])}
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="">不选择</option>
                    <option value="不买社保">不买社保</option>
                    <option value="社保起购年月">社保起购年月</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">社保起购年月</label>
                  <Input value={regularizationReviewData.socialSecurityMonth} onChange={(event) => updateRegularizationReviewField('socialSecurityMonth', event.target.value)} placeholder="例如 2026年07月" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">其他意见</label>
                <Textarea value={regularizationReviewData.otherOpinion} onChange={(event) => updateRegularizationReviewField('otherOpinion', event.target.value)} className="min-h-20" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">部门负责人</label>
                  <Input value={regularizationReviewData.departmentManager} onChange={(event) => updateRegularizationReviewField('departmentManager', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">部门日期</label>
                  <Input type="date" value={regularizationReviewData.departmentDate} onChange={(event) => updateRegularizationReviewField('departmentDate', event.target.value)} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-sm font-medium text-slate-700">人力资源部领导意见</label>
                  <Textarea value={regularizationReviewData.hrOpinion} onChange={(event) => updateRegularizationReviewField('hrOpinion', event.target.value)} className="min-h-20" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">人资签字</label>
                  <Input value={regularizationReviewData.hrLeader} onChange={(event) => updateRegularizationReviewField('hrLeader', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">人资日期</label>
                  <Input type="date" value={regularizationReviewData.hrDate} onChange={(event) => updateRegularizationReviewField('hrDate', event.target.value)} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-sm font-medium text-slate-700">公司领导意见</label>
                  <Textarea value={regularizationReviewData.companyOpinion} onChange={(event) => updateRegularizationReviewField('companyOpinion', event.target.value)} className="min-h-20" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">公司领导签字</label>
                  <Input value={regularizationReviewData.companyLeader} onChange={(event) => updateRegularizationReviewField('companyLeader', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">公司日期</label>
                  <Input type="date" value={regularizationReviewData.companyDate} onChange={(event) => updateRegularizationReviewField('companyDate', event.target.value)} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegularizationReviewOpen(false)} disabled={regularizationReviewing}>
              取消
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={submitRegularizationReview} disabled={regularizationReviewing}>
              {regularizationReviewing && <Loader2 className="h-4 w-4 animate-spin" />}
              完成审核
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>人事审核</DialogTitle>
            <DialogDescription>
              审核通过后会写入人事部门意见，并生成员工档案。审核完成后才能导出和打印登记表。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {reviewTarget ? `${reviewTarget.name} / ${display(reviewTarget.position)} / ${maskPhone(reviewTarget.phone)}` : '未选择登记记录'}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                审核人姓名<span className="text-red-500">*</span>
              </label>
              <Input value={reviewerName} onChange={(event) => setReviewerName(event.target.value)} placeholder="请手动输入审核人姓名" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">人事部门意见</label>
              <Textarea
                value={hrOpinion}
                onChange={(event) => setHrOpinion(event.target.value)}
                placeholder="请输入人事部门意见"
                className="min-h-28"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)} disabled={reviewing}>
              取消
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={submitReview} disabled={reviewing}>
              {reviewing && <Loader2 className="h-4 w-4 animate-spin" />}
              完成审核
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>修改入职登记</DialogTitle>
            <DialogDescription>
              修改后会同步更新入职登记关键字段；已审核记录会同步更新关联员工档案。
            </DialogDescription>
          </DialogHeader>
          {editData && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">姓名</label>
                  <Input value={editData.name} onChange={(event) => updateEditField('name', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">性别</label>
                  <Select value={editData.gender} onValueChange={(value) => updateEditField('gender', value as OnboardingFormData['gender'])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="男">男</SelectItem>
                      <SelectItem value="女">女</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">手机号</label>
                  <Input value={editData.phone} onChange={(event) => updateEditField('phone', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">身份证号</label>
                  <Input value={editData.idCard} onChange={(event) => updateEditField('idCard', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">入职岗位</label>
                  <Input value={editData.position} onChange={(event) => updateEditField('position', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">所属部门</label>
                  <Input value={editData.department} onChange={(event) => updateEditField('department', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">入职日期</label>
                  <Input type="date" value={editData.hireDate} onChange={(event) => updateEditField('hireDate', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">填表日期</label>
                  <Input type="date" value={editData.fillDate} onChange={(event) => updateEditField('fillDate', event.target.value)} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">招聘来源</label>
                  <Select
                    value={editData.recruitmentSource[0] || '未选择'}
                    onValueChange={(value) => updateEditField('recruitmentSource', value === '未选择' ? [] : [value])}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="未选择">未选择</SelectItem>
                      {sourceOptions.map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">其他来源</label>
                  <Input
                    value={editData.otherRecruitmentSource}
                    onChange={(event) => updateEditField('otherRecruitmentSource', event.target.value)}
                    disabled={editData.recruitmentSource[0] !== '其他'}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">合同期限</label>
                  <Input value={editData.contractTerm} onChange={(event) => updateEditField('contractTerm', event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">试用期（底薪）</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={editData.probationMonths} onChange={(event) => updateEditField('probationMonths', event.target.value)} placeholder="月数" />
                    <Input value={editData.probationSalary} onChange={(event) => updateEditField('probationSalary', event.target.value)} placeholder="底薪" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">工资方式</label>
                  <Select value={editData.wageMethod} onValueChange={(value) => updateEditField('wageMethod', value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {wageMethodOptions.map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">使用机器约定</label>
                  <Input value={editData.machineAgreement} onChange={(event) => updateEditField('machineAgreement', event.target.value)} />
                </div>
              </div>

              <div className="rounded-lg border border-slate-100 p-3">
                <h3 className="mb-3 text-sm font-semibold text-slate-950">紧急联系人</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">姓名</label>
                    <Input value={editContact.name} onChange={(event) => updateEditContactField('name', event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">关系</label>
                    <Input value={editContact.relation} onChange={(event) => updateEditContactField('relation', event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">联系电话</label>
                    <Input value={editContact.phone} onChange={(event) => updateEditContactField('phone', event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">单位住址</label>
                    <Input value={editContact.address} onChange={(event) => updateEditContactField('address', event.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={savingEdit}>
              取消
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={submitEdit} disabled={savingEdit}>
              {savingEdit && <Loader2 className="h-4 w-4 animate-spin" />}
              保存修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
