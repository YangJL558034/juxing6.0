'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileCheck2,
  Hourglass,
  Loader2,
  Pencil,
  Plus,
  Printer,
  RefreshCcw,
  Search,
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
  TableBody,
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

export default function PersonnelPage() {
  const [query, setQuery] = useState('');
  const [keyword, setKeyword] = useState('');
  const [activeStatus, setActiveStatus] = useState<OnboardingStatus>('待审核');
  const [source, setSource] = useState('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [records, setRecords] = useState<OnboardingRecord[]>([]);
  const [counts, setCounts] = useState<OnboardingCounts>(emptyCounts);
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

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-slate-50 p-4 text-slate-950 md:p-6">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm text-slate-500">
            员工管理 / <span className="text-slate-800">入职登记</span>
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-normal text-slate-950">人事管理</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link href="/onboarding" target="_blank">
              <Plus className="h-4 w-4" />
              员工入职
            </Link>
          </Button>
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
        </div>
      </div>

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
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={10} className="h-28 text-center text-sm text-slate-500">
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          正在加载入职登记...
                        </span>
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && visibleRecords.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="h-28 text-center text-sm text-slate-500">
                        暂无{activeStatus}记录
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && visibleRecords.map((record, index) => (
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
                  ))}
                </TableBody>
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
