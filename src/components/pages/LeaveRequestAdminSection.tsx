'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, ExternalLink, Eye, Loader2, Pencil, Printer, RefreshCcw, Search, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { formatLeaveDateRange, formatLeaveDuration } from '@/lib/leave-records';
import type { LeaveDuration, LeaveRequestFormData, LeaveRequestRecord } from '@/types/leave-request';

interface LeaveListResponse {
  success?: boolean;
  records?: LeaveRequestRecord[];
  error?: string;
}

interface LeaveMutateResponse {
  success?: boolean;
  record?: LeaveRequestRecord;
  error?: string;
}

type StatusFilter = '待审核' | '已审核' | 'all' | 'deleted';

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return value.replace('T', ' ').slice(0, 16);
}

function display(value?: string | number | null) {
  if (value === undefined || value === null) return '-';
  const text = String(value).trim();
  return text || '-';
}

function statusBadgeClass(status: string) {
  return status === '已审核'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-amber-200 bg-amber-50 text-amber-700';
}

function triggerDownload(record: LeaveRequestRecord) {
  window.open(`/api/leave-requests/${record.id}/export`, '_blank', 'noopener,noreferrer');
}

function triggerPrint(record: LeaveRequestRecord) {
  window.open(`/api/leave-requests/${record.id}/print`, '_blank', 'noopener,noreferrer');
}

export default function LeaveRequestAdminSection() {
  const [records, setRecords] = useState<LeaveRequestRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('待审核');
  const [viewTarget, setViewTarget] = useState<LeaveRequestRecord | null>(null);
  const [editTarget, setEditTarget] = useState<LeaveRequestRecord | null>(null);
  const [editForm, setEditForm] = useState<LeaveRequestFormData | null>(null);

  const counts = useMemo(() => ({
    all: records.filter(record => !record.deletedAt).length,
    pending: records.filter(record => !record.deletedAt && record.status !== '已审核').length,
    reviewed: records.filter(record => !record.deletedAt && record.status === '已审核').length,
    deleted: records.filter(record => record.deletedAt).length,
  }), [records]);

  const visibleRecords = useMemo(() => records.filter(record => {
    if (statusFilter === 'deleted') return Boolean(record.deletedAt);
    if (record.deletedAt) return false;
    if (statusFilter === 'all') return true;
    if (statusFilter === '已审核') return record.status === '已审核';
    return record.status !== '已审核';
  }), [records, statusFilter]);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (keyword.trim()) params.set('keyword', keyword.trim());
      params.set('includeDeleted', '1');
      const response = await fetch(`/api/leave-requests?${params.toString()}`, { cache: 'no-store' });
      const result = await response.json().catch(() => ({})) as LeaveListResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '获取请假申请失败');
      }
      setRecords(result.records || []);
      setError('');
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '获取请假申请失败');
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const reviewRecord = async (record: LeaveRequestRecord) => {
    const reviewerName = window.prompt('请输入审核人姓名', record.reviewerName || '');
    if (reviewerName === null) return;
    setActingId(record.id);
    try {
      const response = await fetch(`/api/leave-requests/${record.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewerName }),
      });
      const result = await response.json().catch(() => ({})) as LeaveMutateResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '审核请假申请失败');
      }
      await loadRecords();
    } catch (reviewError) {
      alert(reviewError instanceof Error ? reviewError.message : '审核请假申请失败');
    } finally {
      setActingId(null);
    }
  };

  const openEdit = (record: LeaveRequestRecord) => {
    setEditTarget(record);
    setEditForm({
      employeeId: record.employeeId,
      employeeName: record.employeeName,
      idCard: record.idCard,
      phone: record.phone,
      department: record.department,
      position: record.position,
      leaveDate: record.leaveStartDate || record.leaveDate,
      leaveStartDate: record.leaveStartDate || record.leaveDate,
      leaveEndDate: record.leaveEndDate || record.leaveStartDate || record.leaveDate,
      duration: record.duration,
      halfDayPeriod: record.halfDayPeriod || '上午',
      leaveType: record.leaveType,
      reason: record.reason,
      applicantSignatureDataUrl: record.applicantSignatureDataUrl,
    });
  };

  const updateEdit = <K extends keyof LeaveRequestFormData>(field: K, value: LeaveRequestFormData[K]) => {
    setEditForm(current => current ? { ...current, [field]: value } : current);
  };

  const saveEdit = async () => {
    if (!editTarget || !editForm) return;
    if (!editForm.employeeName.trim()) {
      alert('员工姓名不能为空');
      return;
    }
    if (!editForm.leaveStartDate || !editForm.leaveEndDate || editForm.leaveEndDate < editForm.leaveStartDate) {
      alert('请检查请假开始日期和结束日期');
      return;
    }

    setActingId(editTarget.id);
    try {
      const response = await fetch(`/api/leave-requests/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: editForm }),
      });
      const result = await response.json().catch(() => ({})) as LeaveMutateResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '更改请假申请失败');
      }
      setEditTarget(null);
      setEditForm(null);
      await loadRecords();
    } catch (saveError) {
      alert(saveError instanceof Error ? saveError.message : '更改请假申请失败');
    } finally {
      setActingId(null);
    }
  };

  const deleteRecord = async (record: LeaveRequestRecord) => {
    if (!confirm(`确定删除 ${record.employeeName} 的请假申请吗？删除后7天自动彻底清除。`)) return;
    setActingId(record.id);
    try {
      const response = await fetch(`/api/leave-requests/${record.id}`, { method: 'DELETE' });
      const result = await response.json().catch(() => ({})) as LeaveMutateResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '删除请假申请失败');
      }
      await loadRecords();
    } catch (deleteError) {
      alert(deleteError instanceof Error ? deleteError.message : '删除请假申请失败');
    } finally {
      setActingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>请假申请</CardTitle>
            <CardDescription>员工在移动端提交申请，后台只审核、导出和打印。审核通过后同步到工资工时的打卡记录。</CardDescription>
          </div>
          <Button variant="outline" onClick={() => window.open('/leave-request', '_blank', 'noopener,noreferrer')}>
            <ExternalLink className="h-4 w-4" />
            打开移动端申请页
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
            <TabsList>
              <TabsTrigger value="待审核">待审核 {counts.pending}</TabsTrigger>
              <TabsTrigger value="已审核">已审核 {counts.reviewed}</TabsTrigger>
              <TabsTrigger value="all">全部 {counts.all}</TabsTrigger>
              <TabsTrigger value="deleted">已删除 {counts.deleted}</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={keyword}
                onChange={event => setKeyword(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') void loadRecords();
                }}
                placeholder="姓名/身份证/部门"
                className="w-56 pl-9"
              />
            </div>
            <Button variant="outline" onClick={() => void loadRecords()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              刷新
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>员工</TableHead>
                <TableHead>身份证</TableHead>
                <TableHead>手机号</TableHead>
                <TableHead>部门</TableHead>
                <TableHead>岗位</TableHead>
                <TableHead>请假日期</TableHead>
                <TableHead>时长</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>提交时间</TableHead>
                <TableHead>审核信息</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={12} className="h-24 text-center text-slate-500">
                    正在加载请假申请...
                  </TableCell>
                </TableRow>
              )}
              {!loading && visibleRecords.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="h-24 text-center text-slate-500">
                    暂无请假申请
                  </TableCell>
                </TableRow>
              )}
              {!loading && visibleRecords.map(record => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">{display(record.employeeName)}</TableCell>
                  <TableCell>{display(record.idCard)}</TableCell>
                  <TableCell>{display(record.phone)}</TableCell>
                  <TableCell>{display(record.department)}</TableCell>
                  <TableCell>{display(record.position)}</TableCell>
                  <TableCell>{formatLeaveDateRange(record)}</TableCell>
                  <TableCell>{formatLeaveDuration(record.duration, record.halfDayPeriod)}</TableCell>
                  <TableCell>{display(record.leaveType)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={record.deletedAt ? 'border-red-200 bg-red-50 text-red-700' : statusBadgeClass(record.status)}>
                      {record.deletedAt ? '已删除' : display(record.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDateTime(record.createdAt)}</TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm">
                      <div>{display(record.reviewerName)}</div>
                      <div className="text-xs text-slate-500">{formatDateTime(record.reviewedAt)}</div>
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[420px] text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setViewTarget(record)}>
                        <Eye className="h-4 w-4" />
                        查看
                      </Button>
                      {!record.deletedAt && (
                        <Button variant="outline" size="sm" onClick={() => openEdit(record)}>
                          <Pencil className="h-4 w-4" />
                          更改
                        </Button>
                      )}
                      {!record.deletedAt && record.status !== '已审核' ? (
                        <Button size="sm" onClick={() => void reviewRecord(record)} disabled={actingId === record.id}>
                          {actingId === record.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          审核
                        </Button>
                      ) : !record.deletedAt ? (
                        <>
                          <Button variant="outline" size="sm" onClick={() => triggerDownload(record)}>
                            <Download className="h-4 w-4" />
                            导出
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => triggerPrint(record)}>
                            <Printer className="h-4 w-4" />
                            打印
                          </Button>
                        </>
                      ) : null}
                      {!record.deletedAt && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          disabled={actingId === record.id}
                          onClick={() => void deleteRecord(record)}
                        >
                          <Trash2 className="h-4 w-4" />
                          删除
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={Boolean(viewTarget)} onOpenChange={(open) => !open && setViewTarget(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>查看请假申请</DialogTitle>
            <DialogDescription>查看员工提交的请假信息和签字。</DialogDescription>
          </DialogHeader>
          {viewTarget && (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-lg border p-4 text-sm md:grid-cols-2">
                {[
                  ['员工', viewTarget.employeeName],
                  ['身份证', viewTarget.idCard],
                  ['手机号', viewTarget.phone],
                  ['部门', viewTarget.department],
                  ['岗位', viewTarget.position],
                  ['请假日期', formatLeaveDateRange(viewTarget)],
                  ['时长', formatLeaveDuration(viewTarget.duration, viewTarget.halfDayPeriod)],
                  ['类型', viewTarget.leaveType],
                  ['状态', viewTarget.status],
                  ['提交时间', formatDateTime(viewTarget.createdAt)],
                  ['审核人', viewTarget.reviewerName],
                  ['审核时间', formatDateTime(viewTarget.reviewedAt)],
                ].map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[84px_minmax(0,1fr)] gap-2">
                    <span className="font-medium text-slate-500">{label}</span>
                    <span>{display(value)}</span>
                  </div>
                ))}
              </div>
              <div>
                <Label>请假原因</Label>
                <div className="mt-2 min-h-24 whitespace-pre-wrap rounded-lg border bg-slate-50 p-3 text-sm">
                  {display(viewTarget.reason)}
                </div>
              </div>
              <div>
                <Label>员工签字</Label>
                <div className="mt-2 rounded-lg border bg-white p-3">
                  {viewTarget.applicantSignatureDataUrl ? (
                    <img src={viewTarget.applicantSignatureDataUrl} alt="员工签字" className="max-h-40 max-w-full object-contain" />
                  ) : (
                    <p className="text-sm text-slate-500">暂无签字</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editTarget && editForm)} onOpenChange={(open) => {
        if (!open) {
          setEditTarget(null);
          setEditForm(null);
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>更改请假申请</DialogTitle>
            <DialogDescription>更改后会保留原提交记录和员工签字。</DialogDescription>
          </DialogHeader>
          {editForm && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>员工</Label>
                <Input value={editForm.employeeName} onChange={event => updateEdit('employeeName', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>身份证</Label>
                <Input value={editForm.idCard} onChange={event => updateEdit('idCard', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>手机号</Label>
                <Input value={editForm.phone} onChange={event => updateEdit('phone', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>部门</Label>
                <Input value={editForm.department} onChange={event => updateEdit('department', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>岗位</Label>
                <Input value={editForm.position} onChange={event => updateEdit('position', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>开始日期</Label>
                <Input
                  type="date"
                  value={editForm.leaveStartDate}
                  onChange={event => {
                    updateEdit('leaveStartDate', event.target.value);
                    updateEdit('leaveDate', event.target.value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>结束日期</Label>
                <Input type="date" value={editForm.leaveEndDate} onChange={event => updateEdit('leaveEndDate', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>时长</Label>
                <Select value={editForm.duration} onValueChange={(value) => updateEdit('duration', value as LeaveDuration)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">全天</SelectItem>
                    <SelectItem value="half">半天</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editForm.duration === 'half' && (
                <div className="space-y-2">
                  <Label>半天时段</Label>
                  <Select value={editForm.halfDayPeriod || '上午'} onValueChange={(value) => updateEdit('halfDayPeriod', value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="上午">上午</SelectItem>
                      <SelectItem value="下午">下午</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>类型</Label>
                <Select value={editForm.leaveType || '事假'} onValueChange={(value) => updateEdit('leaveType', value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="事假">事假</SelectItem>
                    <SelectItem value="病假">病假</SelectItem>
                    <SelectItem value="年假">年假</SelectItem>
                    <SelectItem value="调休">调休</SelectItem>
                    <SelectItem value="其他">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>请假原因</Label>
                <Textarea value={editForm.reason} onChange={event => updateEdit('reason', event.target.value)} className="min-h-28" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditTarget(null);
              setEditForm(null);
            }}>
              取消
            </Button>
            <Button onClick={() => void saveEdit()} disabled={actingId === editTarget?.id}>
              {actingId === editTarget?.id && <Loader2 className="h-4 w-4 animate-spin" />}
              保存更改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
