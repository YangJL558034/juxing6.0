'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Download,
  Eye,
  FileCheck2,
  FilePenLine,
  Hourglass,
  Loader2,
  Pencil,
  Phone,
  Plus,
  Printer,
  RefreshCcw,
  Search,
  Trash2,
  UserMinus,
  UserRound,
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
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import MobileHrDocumentManager, { type MobileHrModuleKey } from '@/components/mobile/MobileHrDocumentManager';
import { cn } from '@/lib/utils';
import type {
  OnboardingFormData,
  OnboardingRecord,
  OnboardingStatus,
} from '@/types/onboarding';

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

const emptyCounts: OnboardingCounts = { total: 0, pending: 0, reviewed: 0, resigned: 0 };

const statusTabs: Array<{ value: OnboardingStatus; label: string; countKey: keyof OnboardingCounts; icon: React.ElementType }> = [
  { value: '待审核', label: '待审核', countKey: 'pending', icon: Hourglass },
  { value: '已审核', label: '已审核', countKey: 'reviewed', icon: CheckCircle2 },
  { value: '已离职', label: '已离职', countKey: 'resigned', icon: UserMinus },
];

const sourceOptions = ['网络', '人才市场', '内部推荐', '其他'];

const quickActions = [
  { label: '请假申请', key: 'leaveRequest', icon: FilePenLine, public: true },
  { label: '员工入职', key: 'onboarding', icon: Plus },
  { label: '转正申请', key: 'regularization', icon: FileCheck2 },
  { label: '工作证明', key: 'workCertificate', icon: FileCheck2 },
  { label: '离职申请', key: 'resignation', icon: UserMinus },
  { label: '离职证明', key: 'resignationCertificate', icon: FileCheck2 },
  { label: '不购买社保', key: 'socialSecurityNoPurchase', icon: FileCheck2 },
  { label: '放弃社保', key: 'socialSecurityWaiver', icon: FileCheck2 },
] as const;

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

function cloneData(data: OnboardingFormData): OnboardingFormData {
  return JSON.parse(JSON.stringify(data)) as OnboardingFormData;
}

function canOutput(record: OnboardingRecord | null | undefined) {
  return Boolean(record && record.status !== '待审核');
}

function StatusPill({ status }: { status: OnboardingStatus }) {
  const tone = status === '待审核'
    ? 'bg-orange-50 text-orange-700 ring-orange-200'
    : status === '已审核'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : 'bg-slate-100 text-slate-700 ring-slate-200';

  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1', tone)}>
      {status}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-2.5 last:border-b-0">
      <span className="shrink-0 text-sm text-slate-500">{label}</span>
      <span className="min-w-0 break-all text-right text-sm font-medium text-slate-900">{display(value)}</span>
    </div>
  );
}

export default function MobilePersonnelPage({ canManage = false }: { canManage?: boolean }) {
  const [activeStatus, setActiveStatus] = useState<OnboardingStatus>('待审核');
  const [query, setQuery] = useState('');
  const [keyword, setKeyword] = useState('');
  const [source, setSource] = useState('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [records, setRecords] = useState<OnboardingRecord[]>([]);
  const [counts, setCounts] = useState<OnboardingCounts>(emptyCounts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<OnboardingRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [adminModule, setAdminModule] = useState<MobileHrModuleKey | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<OnboardingRecord | null>(null);
  const [reviewerName, setReviewerName] = useState('');
  const [hrOpinion, setHrOpinion] = useState('同意入职。');
  const [reviewing, setReviewing] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<OnboardingRecord | null>(null);
  const [editData, setEditData] = useState<OnboardingFormData | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const openLeaveRequest = () => {
    window.open('/leave-request', '_blank', 'noopener,noreferrer');
  };

  const loadRecords = useCallback(async () => {
    if (!canManage) {
      setRecords([]);
      setCounts(emptyCounts);
      setLoading(false);
      setError('');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      params.set('status', activeStatus);
      if (keyword.trim()) params.set('keyword', keyword.trim());
      if (source !== 'all') params.set('source', source);

      const response = await fetch(`/api/onboarding?${params.toString()}`, { cache: 'no-store' });
      const result = await response.json().catch(() => ({})) as ListResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error || '获取入职登记失败');
      }

      setRecords(result.records || []);
      setCounts(result.counts || emptyCounts);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '获取入职登记失败');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [activeStatus, canManage, keyword, source]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const visibleRecords = useMemo(() => {
    return records.filter((record) => {
      const hireDate = record.hireDate || record.data.hireDate;
      const matchStart = !dateStart || (hireDate && hireDate >= dateStart);
      const matchEnd = !dateEnd || (hireDate && hireDate <= dateEnd);
      return matchStart && matchEnd;
    });
  }, [dateEnd, dateStart, records]);

  const reviewedTotal = counts.reviewed + counts.resigned;

  const runSearch = () => setKeyword(query.trim());

  const resetFilters = () => {
    setQuery('');
    setKeyword('');
    setSource('all');
    setDateStart('');
    setDateEnd('');
  };

  const openDetail = (record: OnboardingRecord) => {
    setSelectedRecord(record);
    setDetailOpen(true);
  };

  const openReview = (record: OnboardingRecord) => {
    setReviewTarget(record);
    setReviewerName(record.reviewerName || '');
    setHrOpinion(record.hrOpinion || '同意入职。');
    setReviewOpen(true);
  };

  const openEdit = (record: OnboardingRecord) => {
    setEditingRecord(record);
    setEditData(cloneData(record.data));
    setEditOpen(true);
  };

  const updateEditField = <K extends keyof OnboardingFormData>(field: K, value: OnboardingFormData[K]) => {
    setEditData((current) => current ? { ...current, [field]: value } : current);
  };

  const submitReview = async () => {
    if (!reviewTarget) return;
    if (!reviewerName.trim()) {
      alert('请输入审核人姓名');
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

      if (!response.ok || !result.success) {
        throw new Error(result.error || '审核失败');
      }

      setReviewOpen(false);
      setReviewTarget(null);
      setActiveStatus('已审核');
      await loadRecords();
    } catch (reviewError) {
      alert(reviewError instanceof Error ? reviewError.message : '审核失败');
    } finally {
      setReviewing(false);
    }
  };

  const submitEdit = async () => {
    if (!editingRecord || !editData) return;
    if (!editData.name.trim() || !editData.phone.trim() || !editData.position.trim()) {
      alert('姓名、手机号、入职岗位不能为空');
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

      if (!response.ok || !result.success) {
        throw new Error(result.error || '修改失败');
      }

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

      setDetailOpen(false);
      setSelectedRecord(null);
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

      setDetailOpen(false);
      setSelectedRecord(null);
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

  if (adminModule) {
    return <MobileHrDocumentManager moduleKey={adminModule} onBack={() => setAdminModule(null)} />;
  }

  return (
    <div className="space-y-4">
      <section className="mobile-ios-glass rounded-[28px] p-4 text-slate-950">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-blue-600">组织人事</p>
            <h1 className="mt-1 text-2xl font-bold tracking-normal">人事管理</h1>
            <p className="mt-2 text-sm text-slate-600">
              {canManage ? '移动端办理、审核、查看和打印同后台数据同步。' : '移动端可提交请假申请，提交后由人事后台审核。'}
            </p>
          </div>
          {canManage && (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="h-11 w-11 shrink-0 rounded-2xl border border-white/70 bg-white/[0.58] text-blue-700 shadow-sm backdrop-blur-xl hover:bg-white/75"
              onClick={() => void loadRecords()}
              disabled={loading}
            >
              <RefreshCcw className={cn('h-5 w-5', loading && 'animate-spin')} />
            </Button>
          )}
        </div>

        {canManage ? (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="mobile-ios-tile rounded-2xl p-3">
              <div className="text-2xl font-bold">{counts.total}</div>
              <div className="mt-1 text-xs text-slate-500">全部登记</div>
            </div>
            <div className="mobile-ios-tile rounded-2xl p-3">
              <div className="text-2xl font-bold">{counts.pending}</div>
              <div className="mt-1 text-xs text-slate-500">待审核</div>
            </div>
            <div className="mobile-ios-tile rounded-2xl p-3">
              <div className="text-2xl font-bold">{reviewedTotal}</div>
              <div className="mt-1 text-xs text-slate-500">已处理</div>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-3xl border border-white/70 bg-white/[0.7] p-4 shadow-sm backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
                <FilePenLine className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="text-base font-semibold text-slate-950">请假申请</div>
                <p className="mt-1 text-sm leading-5 text-slate-600">所有员工都可以提交，请填写姓名和身份证并完成签字。</p>
              </div>
            </div>
            <Button className="mt-4 h-12 w-full rounded-2xl bg-blue-600 text-base" onClick={openLeaveRequest}>
              <FilePenLine className="mr-2 h-5 w-5" />
              请假申请
            </Button>
          </div>
        )}
      </section>

      {canManage && (
      <section className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') runSearch();
              }}
              placeholder="姓名 / 手机 / 身份证"
              className="h-12 rounded-2xl border-slate-200 bg-slate-50 pl-9 text-base"
            />
          </div>
          <Button className="h-12 rounded-2xl bg-blue-600 px-5" onClick={runSearch}>
            查询
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-11 rounded-2xl" onClick={() => setActionsOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            人事办理
          </Button>
          <Button variant="outline" className="h-11 rounded-2xl" onClick={() => setFiltersOpen(true)}>
            <CalendarDays className="mr-2 h-4 w-4" />
            筛选
          </Button>
        </div>
      </section>
      )}

      {canManage && (
      <section className="grid grid-cols-3 gap-2">
        {statusTabs.map((tab) => {
          const active = activeStatus === tab.value;
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveStatus(tab.value)}
              className={cn(
                'rounded-2xl border p-3 text-left transition active:scale-[0.98]',
                active
                  ? 'border-blue-200 bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'border-slate-200 bg-white text-slate-600',
              )}
            >
              <Icon className="h-4 w-4" />
              <div className="mt-2 text-sm font-semibold">{tab.label}</div>
              <div className={cn('mt-0.5 text-xs', active ? 'text-blue-100' : 'text-slate-400')}>
                {counts[tab.countKey]} 条
              </div>
            </button>
          );
        })}
      </section>
      )}

      {canManage && error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {canManage && (
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-semibold text-slate-950">{activeStatus}列表</h2>
          <span className="text-sm text-slate-500">{visibleRecords.length} 条</span>
        </div>

        {loading && (
          <div className="rounded-[24px] border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-blue-600" />
            正在加载
          </div>
        )}

        {!loading && visibleRecords.length === 0 && (
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            暂无{activeStatus}记录
          </div>
        )}

        {!loading && visibleRecords.map((record) => (
          <article key={record.id} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <UserRound className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-lg font-semibold text-slate-950">{record.name}</h3>
                    <StatusPill status={record.status} />
                  </div>
                  <p className="mt-1 truncate text-sm text-slate-500">{display(record.department)} / {display(record.position)}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Phone className="h-3.5 w-3.5" />
                  手机号
                </div>
                <div className="mt-1 font-medium text-slate-900">{maskPhone(record.phone)}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <CalendarDays className="h-3.5 w-3.5" />
                  入职日期
                </div>
                <div className="mt-1 font-medium text-slate-900">{formatDate(record.hireDate)}</div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => openDetail(record)}>
                <Eye className="mr-1 h-4 w-4" />
                查看
              </Button>
              {record.status === '待审核' && (
                <Button size="sm" className="rounded-full bg-blue-600" onClick={() => openReview(record)}>
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                  审核
                </Button>
              )}
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => openEdit(record)}>
                <Pencil className="mr-1 h-4 w-4" />
                修改
              </Button>
              {record.status === '已审核' && (
                <Button size="sm" variant="outline" className="rounded-full border-orange-200 text-orange-700" onClick={() => void resignRecord(record)}>
                  <UserMinus className="mr-1 h-4 w-4" />
                  离职
                </Button>
              )}
            </div>
          </article>
        ))}
      </section>
      )}

      <Sheet open={actionsOpen} onOpenChange={setActionsOpen}>
        <SheetContent side="bottom" className="max-h-[80dvh] rounded-t-[26px] p-0">
          <SheetHeader className="border-b border-slate-100 px-4 py-4 text-left">
            <SheetTitle>人事办理</SheetTitle>
            <SheetDescription>员工移动端填写，后台在这里审核和管理。</SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2 p-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.key}
                  type="button"
                  onClick={() => {
                    setActionsOpen(false);
                    if (action.key === 'leaveRequest') {
                      openLeaveRequest();
                      return;
                    }
                    if (action.key === 'onboarding') return;
                    setAdminModule(action.key);
                  }}
                  className="flex min-h-[4.5rem] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-3 text-left text-sm font-semibold text-slate-800 shadow-sm transition active:scale-[0.98] hover:border-blue-200 hover:bg-blue-50"
                >
                  <Icon className="h-5 w-5 text-blue-600" />
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="rounded-t-[26px] p-0">
          <SheetHeader className="border-b border-slate-100 px-4 py-4 text-left">
            <SheetTitle>筛选记录</SheetTitle>
            <SheetDescription>按来源和入职日期过滤。</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 p-4">
            <div className="space-y-2">
              <Label>招聘来源</Label>
              <select
                value={source}
                onChange={(event) => setSource(event.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-base outline-none focus:border-blue-400"
              >
                <option value="all">全部</option>
                {sourceOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>入职开始</Label>
                <Input type="date" value={dateStart} onChange={(event) => setDateStart(event.target.value)} className="h-12 rounded-2xl" />
              </div>
              <div className="space-y-2">
                <Label>入职结束</Label>
                <Input type="date" value={dateEnd} onChange={(event) => setDateEnd(event.target.value)} className="h-12 rounded-2xl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button variant="outline" className="h-12 rounded-2xl" onClick={resetFilters}>重置</Button>
              <Button className="h-12 rounded-2xl bg-blue-600" onClick={() => setFiltersOpen(false)}>完成</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="bottom" className="max-h-[88dvh] rounded-t-[26px] p-0">
          <SheetHeader className="border-b border-slate-100 px-4 py-4 text-left">
            <SheetTitle>{selectedRecord?.name || '登记详情'}</SheetTitle>
            <SheetDescription>{selectedRecord ? `${display(selectedRecord.department)} / ${display(selectedRecord.position)}` : ''}</SheetDescription>
          </SheetHeader>

          {selectedRecord && (
            <div className="max-h-[calc(88dvh-8rem)] overflow-y-auto px-4 py-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-2">
                <DetailRow label="状态" value={selectedRecord.status} />
                <DetailRow label="性别" value={selectedRecord.gender} />
                <DetailRow label="手机号" value={selectedRecord.phone} />
                <DetailRow label="身份证" value={selectedRecord.idCard} />
                <DetailRow label="招聘来源" value={selectedRecord.recruitmentSource} />
                <DetailRow label="入职日期" value={formatDate(selectedRecord.hireDate)} />
                <DetailRow label="填表时间" value={formatDateTime(selectedRecord.createdAt)} />
                <DetailRow label="审核人" value={selectedRecord.reviewerName} />
                <DetailRow label="审核时间" value={formatDateTime(selectedRecord.reviewedAt)} />
                <DetailRow label="人事意见" value={selectedRecord.hrOpinion} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 pb-4">
                <Button variant="outline" className="rounded-2xl" onClick={() => openEdit(selectedRecord)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  修改
                </Button>
                <Button variant="outline" className="rounded-2xl border-red-200 text-red-600" onClick={() => void deleteRecord(selectedRecord)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除
                </Button>
                {selectedRecord.status === '待审核' && (
                  <Button className="rounded-2xl bg-blue-600" onClick={() => openReview(selectedRecord)}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    审核
                  </Button>
                )}
                {selectedRecord.status === '已审核' && (
                  <Button variant="outline" className="rounded-2xl border-orange-200 text-orange-700" onClick={() => void resignRecord(selectedRecord)}>
                    <UserMinus className="mr-2 h-4 w-4" />
                    离职
                  </Button>
                )}
                <Button variant="outline" className="rounded-2xl" disabled={!canOutput(selectedRecord)} onClick={() => exportRecord(selectedRecord)}>
                  <Download className="mr-2 h-4 w-4" />
                  导出
                </Button>
                <Button variant="outline" className="rounded-2xl" disabled={!canOutput(selectedRecord)} onClick={() => printRecord(selectedRecord)}>
                  <Printer className="mr-2 h-4 w-4" />
                  打印
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-[calc(100vw-1.5rem)] rounded-3xl">
          <DialogHeader>
            <DialogTitle>审核入职登记</DialogTitle>
            <DialogDescription>{reviewTarget ? `${reviewTarget.name} / ${display(reviewTarget.position)}` : ''}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>审核人</Label>
              <Input value={reviewerName} onChange={(event) => setReviewerName(event.target.value)} placeholder="请输入审核人姓名" className="h-12 rounded-2xl" />
            </div>
            <div className="space-y-2">
              <Label>人事部门意见</Label>
              <Textarea value={hrOpinion} onChange={(event) => setHrOpinion(event.target.value)} className="min-h-24 rounded-2xl" />
            </div>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-2 sm:flex">
            <Button variant="outline" className="rounded-2xl" onClick={() => setReviewOpen(false)} disabled={reviewing}>取消</Button>
            <Button className="rounded-2xl bg-blue-600" onClick={submitReview} disabled={reviewing}>
              {reviewing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              通过审核
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[86dvh] max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>修改入职登记</DialogTitle>
            <DialogDescription>移动端先提供常用信息修改，完整字段仍可在电脑版编辑。</DialogDescription>
          </DialogHeader>
          {editData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>姓名</Label>
                  <Input value={editData.name} onChange={(event) => updateEditField('name', event.target.value)} className="h-12 rounded-2xl" />
                </div>
                <div className="space-y-2">
                  <Label>性别</Label>
                  <select
                    value={editData.gender}
                    onChange={(event) => updateEditField('gender', event.target.value as OnboardingFormData['gender'])}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-base"
                  >
                    <option value="男">男</option>
                    <option value="女">女</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>手机号</Label>
                <Input value={editData.phone} onChange={(event) => updateEditField('phone', event.target.value)} className="h-12 rounded-2xl" />
              </div>
              <div className="space-y-2">
                <Label>身份证号</Label>
                <Input value={editData.idCard} onChange={(event) => updateEditField('idCard', event.target.value)} className="h-12 rounded-2xl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>部门</Label>
                  <Input value={editData.department} onChange={(event) => updateEditField('department', event.target.value)} className="h-12 rounded-2xl" />
                </div>
                <div className="space-y-2">
                  <Label>岗位</Label>
                  <Input value={editData.position} onChange={(event) => updateEditField('position', event.target.value)} className="h-12 rounded-2xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>入职日期</Label>
                  <Input type="date" value={editData.hireDate} onChange={(event) => updateEditField('hireDate', event.target.value)} className="h-12 rounded-2xl" />
                </div>
                <div className="space-y-2">
                  <Label>招聘来源</Label>
                  <select
                    value={editData.recruitmentSource[0] || '其他'}
                    onChange={(event) => updateEditField('recruitmentSource', [event.target.value])}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-base"
                  >
                    {sourceOptions.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="grid grid-cols-2 gap-2 sm:flex">
            <Button variant="outline" className="rounded-2xl" onClick={() => setEditOpen(false)} disabled={savingEdit}>取消</Button>
            <Button className="rounded-2xl bg-blue-600" onClick={submitEdit} disabled={savingEdit}>
              {savingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
