'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Eye, FileSpreadsheet, Loader2, Pencil, Plus, RefreshCcw, RotateCcw, Search, Trash2, Upload } from 'lucide-react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  createDefaultSocialSecurityPurchaseData,
  socialSecurityPurchaseCategoryLabel,
  socialSecurityPurchaseHeaders,
} from '@/lib/social-security-purchase-records';
import type {
  SocialSecurityPurchaseCategory,
  SocialSecurityPurchaseFormData,
  SocialSecurityPurchaseRecord,
} from '@/types/social-security-purchase';
import type { SocialSecurityRecord } from '@/types/social-security';

type CategoryFilter = SocialSecurityPurchaseCategory;
type ListMode = 'active' | 'resigned' | 'deleted';

interface ListResponse {
  success: boolean;
  records?: SocialSecurityPurchaseRecord[];
  error?: string;
}

interface AgreementListResponse {
  success: boolean;
  records?: SocialSecurityRecord[];
  error?: string;
}

interface MutateResponse {
  success: boolean;
  record?: SocialSecurityPurchaseRecord;
  error?: string;
}

interface ImportResponse {
  success: boolean;
  message?: string;
  imported?: number;
  updated?: number;
  total?: number;
  error?: string;
}

function display(value: unknown) {
  const text = String(value ?? '').trim();
  return text || '-';
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return String(value).replace('T', ' ').slice(0, 19);
}

function isAgreementPurchaseRecord(record: SocialSecurityPurchaseRecord) {
  const text = `${record.insuranceStatus || ''} ${record.contractStatus || ''} ${record.remarks || ''}`;
  return /放弃|不购买|不买|弃保/.test(text);
}

function resolveAgreementCategory(department?: string | null): SocialSecurityPurchaseCategory {
  return String(department || '').includes('管理') ? 'management' : 'production';
}

function cloneData(record: SocialSecurityPurchaseRecord): SocialSecurityPurchaseFormData {
  return {
    category: record.category,
    contractStatus: record.contractStatus,
    department: record.department,
    employeeName: record.employeeName,
    domicile: record.domicile,
    idCard: record.idCard,
    phone: record.phone,
    bankCard: record.bankCard,
    gender: record.gender,
    birthDate: record.birthDate,
    education: record.education,
    insuranceStatus: record.insuranceStatus,
    contractCount: record.contractCount,
    contractStartDate: record.contractStartDate,
    contractTermYears: record.contractTermYears,
    contractEndDate: record.contractEndDate,
    dueDays: record.dueDays,
    employmentStatus: record.employmentStatus,
    resignationDate: record.resignationDate,
    confidentialityAgreement: record.confidentialityAgreement,
    probationSalary: record.probationSalary,
    remarks: record.remarks,
  };
}

function Field({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function CategorySelect({
  value,
  onChange,
}: {
  value: CategoryFilter;
  onChange: (value: CategoryFilter) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as CategoryFilter)}
      className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
    >
      <option value="management">管理部</option>
      <option value="production">车间</option>
    </select>
  );
}

function InfoGrid({ pairs }: { pairs: Array<[string, unknown]> }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {pairs.map(([label, value]) => (
        <div key={label} className="rounded-md bg-slate-50 px-3 py-2">
          <div className="text-xs text-slate-500">{label}</div>
          <div className="mt-1 break-words text-sm font-medium text-slate-900">{display(value)}</div>
        </div>
      ))}
    </div>
  );
}

export default function SocialSecurityPurchaseManager() {
  const [records, setRecords] = useState<SocialSecurityPurchaseRecord[]>([]);
  const [agreements, setAgreements] = useState<SocialSecurityRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [agreementsLoading, setAgreementsLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreementsError, setAgreementsError] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('management');
  const [importCategory, setImportCategory] = useState<SocialSecurityPurchaseCategory>('management');
  const [listMode, setListMode] = useState<ListMode>('active');
  const [viewOpen, setViewOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<SocialSecurityPurchaseRecord | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SocialSecurityPurchaseRecord | null>(null);
  const [editData, setEditData] = useState<SocialSecurityPurchaseFormData>(() => createDefaultSocialSecurityPurchaseData());
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (listMode === 'deleted') params.set('deleted', '1');
      params.set('category', categoryFilter);
      if (listMode !== 'deleted') params.set('employment', listMode);
      if (keyword.trim()) params.set('keyword', keyword.trim());
      const response = await fetch(`/api/social-security/purchase?${params.toString()}`, { cache: 'no-store' });
      const result = await response.json().catch(() => ({})) as ListResponse;
      if (!response.ok || !result.success) throw new Error(result.error || '获取购买社保记录失败');
      setRecords(result.records || []);
    } catch (fetchError) {
      setRecords([]);
      setError(fetchError instanceof Error ? fetchError.message : '获取购买社保记录失败');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, keyword, listMode]);

  const loadAgreements = useCallback(async () => {
    setAgreementsLoading(true);
    setAgreementsError('');
    try {
      const params = new URLSearchParams();
      params.set('approved', '1');
      params.set('type', 'all');
      if (keyword.trim()) params.set('keyword', keyword.trim());
      const response = await fetch(`/api/social-security?${params.toString()}`, { cache: 'no-store' });
      const result = await response.json().catch(() => ({})) as AgreementListResponse;
      if (!response.ok || !result.success) throw new Error(result.error || '获取放弃协议失败');
      setAgreements(result.records || []);
    } catch (fetchError) {
      setAgreements([]);
      setAgreementsError(fetchError instanceof Error ? fetchError.message : '获取放弃协议失败');
    } finally {
      setAgreementsLoading(false);
    }
  }, [keyword]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    void loadAgreements();
  }, [loadAgreements]);

  const runSearch = () => setKeyword(keywordInput);

  const updateField = <K extends keyof SocialSecurityPurchaseFormData>(field: K, value: SocialSecurityPurchaseFormData[K]) => {
    setEditData((current) => ({ ...current, [field]: value }));
  };

  const openCreate = () => {
    setEditTarget(null);
    setEditData(createDefaultSocialSecurityPurchaseData(importCategory));
    setEditOpen(true);
  };

  const openEdit = (record: SocialSecurityPurchaseRecord) => {
    setEditTarget(record);
    setEditData(cloneData(record));
    setEditOpen(true);
  };

  const openView = (record: SocialSecurityPurchaseRecord) => {
    setViewTarget(record);
    setViewOpen(true);
  };

  const submitEdit = async () => {
    setSaving(true);
    try {
      const response = await fetch(
        editTarget ? `/api/social-security/purchase/${editTarget.id}` : '/api/social-security/purchase',
        {
          method: editTarget ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: editData }),
        },
      );
      const result = await response.json().catch(() => ({})) as MutateResponse;
      if (!response.ok || !result.success) throw new Error(result.error || '保存购买社保记录失败');
      setEditOpen(false);
      setEditTarget(null);
      await loadRecords();
    } catch (saveError) {
      alert(saveError instanceof Error ? saveError.message : '保存购买社保记录失败');
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async (record: SocialSecurityPurchaseRecord) => {
    if (!confirm(`确定删除 ${record.employeeName} 的购买社保记录吗？删除后一周内可恢复。`)) return;
    try {
      const response = await fetch(`/api/social-security/purchase/${record.id}`, { method: 'DELETE' });
      const result = await response.json().catch(() => ({})) as MutateResponse;
      if (!response.ok || !result.success) throw new Error(result.error || '删除购买社保记录失败');
      await loadRecords();
    } catch (deleteError) {
      alert(deleteError instanceof Error ? deleteError.message : '删除购买社保记录失败');
    }
  };

  const restoreRecord = async (record: SocialSecurityPurchaseRecord) => {
    try {
      const response = await fetch(`/api/social-security/purchase/${record.id}/restore`, { method: 'PATCH' });
      const result = await response.json().catch(() => ({})) as MutateResponse;
      if (!response.ok || !result.success) throw new Error(result.error || '恢复购买社保记录失败');
      await loadRecords();
    } catch (restoreError) {
      alert(restoreError instanceof Error ? restoreError.message : '恢复购买社保记录失败');
    }
  };

  const exportRecords = () => {
    const params = new URLSearchParams();
    params.set('category', categoryFilter);
    if (listMode === 'deleted') params.set('deleted', '1');
    if (listMode !== 'deleted') params.set('employment', listMode);
    if (keyword.trim()) params.set('keyword', keyword.trim());
    window.open(`/api/social-security/purchase/export?${params.toString()}`, '_blank', 'noopener,noreferrer');
    setTimeout(() => void loadRecords(), 800);
  };

  const exportAgreement = (record: SocialSecurityRecord) => {
    window.open(`/api/social-security/${record.id}/export`, '_blank', 'noopener,noreferrer');
    setTimeout(() => void loadAgreements(), 800);
  };

  const importFile = async (file: File) => {
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', importCategory);
      const response = await fetch('/api/social-security/purchase/import', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json().catch(() => ({})) as ImportResponse;
      if (!response.ok || !result.success) throw new Error(result.error || '导入购买社保记录失败');
      alert(result.message || `导入完成：新增 ${result.imported || 0} 条，更新 ${result.updated || 0} 条`);
      await loadRecords();
    } catch (importError) {
      alert(importError instanceof Error ? importError.message : '导入购买社保记录失败');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const agreementPurchaseRecords = records.filter(isAgreementPurchaseRecord);
  const visibleRecords = records.filter((record) => !isAgreementPurchaseRecord(record));
  const visibleAgreements = agreements.filter((record) => resolveAgreementCategory(record.department) === categoryFilter);
  const agreementTotal = visibleAgreements.length + agreementPurchaseRecords.length;

  return (
    <div id="social-security-purchase-management" className="scroll-mt-24 mt-4 rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            购买社保
          </div>
          <p className="mt-1 text-sm text-slate-500">后台填写或按劳动合同台账导入，管理部和车间分开管理，在职、离职和放弃协议分开展示。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-9 items-center rounded-md border border-slate-200 bg-white px-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') runSearch();
              }}
              placeholder="姓名/身份证/部门/保险"
              className="h-full w-40 bg-transparent px-2 text-sm outline-none"
            />
          </div>
          <Button variant="outline" onClick={runSearch}>搜索</Button>
          <div className="flex rounded-md border border-slate-200 bg-white p-1">
            {([
              ['management', '管理部'],
              ['production', '车间'],
            ] as const).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                variant={categoryFilter === value ? 'default' : 'ghost'}
                size="sm"
                className={categoryFilter === value ? 'bg-slate-950 hover:bg-slate-800' : ''}
                onClick={() => {
                  setCategoryFilter(value);
                  setImportCategory(value);
                }}
              >
                {label}
              </Button>
            ))}
          </div>
          <Button
            variant={listMode === 'active' ? 'default' : 'outline'}
            className={listMode === 'active' ? 'bg-slate-950 hover:bg-slate-800' : ''}
            onClick={() => setListMode('active')}
          >
            在职
          </Button>
          <Button
            variant={listMode === 'resigned' ? 'default' : 'outline'}
            className={listMode === 'resigned' ? 'bg-slate-950 hover:bg-slate-800' : ''}
            onClick={() => setListMode('resigned')}
          >
            离职
          </Button>
          <Button
            variant={listMode === 'deleted' ? 'default' : 'outline'}
            className={listMode === 'deleted' ? 'bg-slate-950 hover:bg-slate-800' : ''}
            onClick={() => setListMode('deleted')}
          >
            已删除
          </Button>
          <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1">
            <CategorySelect value={importCategory} onChange={setImportCategory} />
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importFile(file);
              }}
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              导入
            </Button>
          </div>
          <Button variant="outline" onClick={exportRecords}>
            <Download className="h-4 w-4" />
            导出
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            新增
          </Button>
          <Button variant="outline" onClick={() => void loadRecords()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            刷新
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>分类</TableHead>
              <TableHead>员工</TableHead>
              <TableHead>身份证号</TableHead>
              <TableHead>手机号</TableHead>
              <TableHead>部门</TableHead>
              <TableHead>保险情况</TableHead>
              <TableHead>合同开始</TableHead>
              <TableHead>合同结束</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>导出时间</TableHead>
              {listMode === 'deleted' && <TableHead>恢复截止</TableHead>}
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={listMode === 'deleted' ? 12 : 11} className="h-28 text-center text-sm text-slate-500">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    正在加载购买社保记录...
                  </span>
                </TableCell>
              </TableRow>
            )}
            {!loading && visibleRecords.length === 0 && (
              <TableRow>
                <TableCell colSpan={listMode === 'deleted' ? 12 : 11} className="h-28 text-center text-sm text-slate-500">
                  {listMode === 'deleted' ? '暂无已删除购买社保记录' : `暂无${listMode === 'resigned' ? '离职' : '在职'}购买社保记录`}
                </TableCell>
              </TableRow>
            )}
            {!loading && visibleRecords.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="font-medium text-slate-900">{record.categoryLabel}</TableCell>
                <TableCell>{display(record.employeeName)}</TableCell>
                <TableCell>{display(record.idCard)}</TableCell>
                <TableCell>{display(record.phone)}</TableCell>
                <TableCell>{display(record.department)}</TableCell>
                <TableCell>{display(record.insuranceStatus)}</TableCell>
                <TableCell>{display(record.contractStartDate)}</TableCell>
                <TableCell>{display(record.contractEndDate)}</TableCell>
                <TableCell>{record.deletedAt ? '已删除' : display(record.employmentStatus || (listMode === 'resigned' ? '离职' : '在职'))}</TableCell>
                <TableCell>{formatDateTime(record.exportedAt)}</TableCell>
                {listMode === 'deleted' && <TableCell>{formatDateTime(record.restoreUntil)}</TableCell>}
                <TableCell className="text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => openView(record)}>
                      <Eye className="h-4 w-4" />
                      查看
                    </Button>
                    {listMode === 'deleted' ? (
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => restoreRecord(record)}>
                        <RotateCcw className="h-4 w-4" />
                        恢复
                      </Button>
                    ) : (
                      <>
                        <Button variant="outline" size="sm" onClick={() => openEdit(record)}>
                          <Pencil className="h-4 w-4" />
                          修改
                        </Button>
                        <Button variant="outline" size="sm" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => deleteRecord(record)}>
                          <Trash2 className="h-4 w-4" />
                          删除
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-6 rounded-lg border border-slate-100 bg-slate-50/60 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-950">放弃协议</div>
            <p className="mt-1 text-sm text-slate-500">这里单独显示已审核的不购买社保申请、自愿放弃社保声明，以及台账中保险情况为放弃协议的人员。</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadAgreements()} disabled={agreementsLoading}>
            {agreementsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            刷新协议
          </Button>
        </div>

        {agreementsError && (
          <div className="mt-3 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            {agreementsError}
          </div>
        )}

        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-100 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>协议</TableHead>
                <TableHead>员工</TableHead>
                <TableHead>身份证</TableHead>
                <TableHead>手机号</TableHead>
                <TableHead>部门</TableHead>
                <TableHead>岗位</TableHead>
                <TableHead>提交时间</TableHead>
                <TableHead>审核人</TableHead>
                <TableHead>审核时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agreementsLoading && (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center text-sm text-slate-500">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      正在加载放弃协议...
                    </span>
                  </TableCell>
                </TableRow>
              )}
              {!agreementsLoading && agreementTotal === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center text-sm text-slate-500">
                    暂无放弃协议
                  </TableCell>
                </TableRow>
              )}
              {!agreementsLoading && visibleAgreements.map((record) => (
                <TableRow key={`application-${record.id}`}>
                  <TableCell className="font-medium text-slate-900">{record.documentTitle}</TableCell>
                  <TableCell>{display(record.name)}</TableCell>
                  <TableCell>{display(record.idCard)}</TableCell>
                  <TableCell>{display(record.phone)}</TableCell>
                  <TableCell>{display(record.department)}</TableCell>
                  <TableCell>{display(record.position)}</TableCell>
                  <TableCell>{formatDateTime(record.submittedAt)}</TableCell>
                  <TableCell>{display(record.reviewerName)}</TableCell>
                  <TableCell>{formatDateTime(record.reviewedAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => exportAgreement(record)}>
                      <Download className="h-4 w-4" />
                      导出协议
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!agreementsLoading && agreementPurchaseRecords.map((record) => (
                <TableRow key={`purchase-${record.id}`}>
                  <TableCell className="font-medium text-slate-900">{display(record.insuranceStatus || '放弃协议')}</TableCell>
                  <TableCell>{display(record.employeeName)}</TableCell>
                  <TableCell>{display(record.idCard)}</TableCell>
                  <TableCell>{display(record.phone)}</TableCell>
                  <TableCell>{display(record.department)}</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>{formatDateTime(record.createdAt)}</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openView(record)}>
                        <Eye className="h-4 w-4" />
                        查看
                      </Button>
                      {listMode !== 'deleted' && (
                        <Button variant="outline" size="sm" onClick={() => openEdit(record)}>
                          <Pencil className="h-4 w-4" />
                          修改
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>查看购买社保记录</DialogTitle>
            <DialogDescription>查看后台填写或导入的购买社保台账字段。</DialogDescription>
          </DialogHeader>
          {viewTarget && (
            <InfoGrid pairs={[
              ['分类', viewTarget.categoryLabel],
              ...socialSecurityPurchaseHeaders.map(([key, label]) => [label, viewTarget[key]] as [string, unknown]),
              ['创建时间', formatDateTime(viewTarget.createdAt)],
              ['导出时间', formatDateTime(viewTarget.exportedAt)],
              ['删除时间', formatDateTime(viewTarget.deletedAt)],
              ['恢复截止', formatDateTime(viewTarget.restoreUntil)],
            ]} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editTarget ? '修改购买社保记录' : '新增购买社保记录'}</DialogTitle>
            <DialogDescription>可手动维护购买社保台账字段；也可以直接导入车间或管理部模板。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">分类</label>
              <CategorySelect
                value={editData.category}
                onChange={(value) => {
                  setEditData((current) => ({
                    ...current,
                    category: value,
                    department: current.department || socialSecurityPurchaseCategoryLabel(value),
                  }));
                }}
              />
            </div>
            {socialSecurityPurchaseHeaders.map(([key, label]) => (
              <Field
                key={key}
                label={label}
                required={key === 'employeeName' || key === 'idCard'}
                value={String(editData[key] || '')}
                onChange={(value) => updateField(key, value)}
              />
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>取消</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={submitEdit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
