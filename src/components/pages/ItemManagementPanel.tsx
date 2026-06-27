'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  Eye,
  Loader2,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
  XCircle,
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
  ItemClaimListResponse,
  ItemClaimRecord,
  ItemInventoryListResponse,
  ItemInventoryRecord,
  ItemInventorySummary,
} from '@/types/item-management';

interface MutateItemResponse {
  success: boolean;
  item?: ItemInventoryRecord;
  error?: string;
  message?: string;
}

interface MutateClaimResponse {
  success: boolean;
  claim?: ItemClaimRecord;
  error?: string;
  message?: string;
}

const emptySummary: ItemInventorySummary = {
  itemCount: 0,
  totalQuantity: 0,
  remainingQuantity: 0,
  claimedQuantity: 0,
  pendingQuantity: 0,
  totalValue: 0,
};

const emptyItemForm = {
  name: '',
  category: '',
  unit: '个',
  quantity: '',
  unitPrice: '',
  remark: '',
};

function display(value?: string | number | null) {
  if (value === undefined || value === null) return '-';
  const text = String(value).trim();
  return text || '-';
}

function formatMoney(value: number) {
  return `￥${Number(value || 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function isPending(status: string) {
  return status === '待审核';
}

function statusClass(status: string) {
  if (status === '已审核') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === '已驳回') return 'bg-red-50 text-red-700 ring-red-200';
  return 'bg-orange-50 text-orange-700 ring-orange-200';
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
      <div className={cn('mb-3 h-1.5 w-12 rounded-full', tone)} />
      <div className="text-sm font-medium text-slate-600">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">{value}</div>
    </div>
  );
}

function ClaimFormFields({
  items,
  itemId,
  quantity,
  reason,
  onItemChange,
  onQuantityChange,
  onReasonChange,
}: {
  items: ItemInventoryRecord[];
  itemId: string;
  quantity: string;
  reason: string;
  onItemChange: (value: string) => void;
  onQuantityChange: (value: string) => void;
  onReasonChange: (value: string) => void;
}) {
  const selectedItem = items.find((item) => String(item.id) === itemId) || null;

  return (
    <div className="space-y-3">
      <Select value={itemId} onValueChange={onItemChange}>
        <SelectTrigger>
          <SelectValue placeholder="选择领用物品" />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.id} value={String(item.id)}>
              {item.name}（剩余 {item.remainingQuantity}{item.unit}）
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={quantity}
        onChange={(event) => onQuantityChange(event.target.value)}
        type="number"
        min="1"
        max={selectedItem?.remainingQuantity || undefined}
        placeholder="领用数量"
      />
      <Textarea
        value={reason}
        onChange={(event) => onReasonChange(event.target.value)}
        placeholder="领用原因"
        rows={4}
      />
    </div>
  );
}

export default function ItemManagementPanel() {
  const [items, setItems] = useState<ItemInventoryRecord[]>([]);
  const [claims, setClaims] = useState<ItemClaimRecord[]>([]);
  const [summary, setSummary] = useState<ItemInventorySummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [savingItem, setSavingItem] = useState(false);
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [updatingClaim, setUpdatingClaim] = useState(false);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [viewClaimOpen, setViewClaimOpen] = useState(false);
  const [editClaimOpen, setEditClaimOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<ItemClaimRecord | null>(null);
  const [error, setError] = useState('');

  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [claimForm, setClaimForm] = useState({
    itemId: '',
    quantity: '1',
    reason: '',
  });
  const [editClaimForm, setEditClaimForm] = useState({
    itemId: '',
    quantity: '1',
    reason: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [itemsResponse, claimsResponse] = await Promise.all([
        fetch('/api/item-inventory', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/item-claims', { cache: 'no-store', credentials: 'include' }),
      ]);
      const itemsData = await itemsResponse.json().catch(() => ({})) as ItemInventoryListResponse;
      const claimsData = await claimsResponse.json().catch(() => ({})) as ItemClaimListResponse;

      if (!itemsResponse.ok || !itemsData.success) {
        throw new Error(itemsData.error || '获取物品库失败');
      }
      if (!claimsResponse.ok || !claimsData.success) {
        throw new Error(claimsData.error || '获取领用申请失败');
      }

      const nextItems = itemsData.items || [];
      setItems(nextItems);
      setClaims(claimsData.claims || []);
      setSummary(itemsData.summary || emptySummary);
      setClaimForm((current) => ({
        ...current,
        itemId: current.itemId || (nextItems[0] ? String(nextItems[0].id) : ''),
      }));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '加载物品管理数据失败');
      setItems([]);
      setClaims([]);
      setSummary(emptySummary);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const claimStats = useMemo(() => ({
    pending: claims.filter((claim) => claim.status === '待审核').length,
    approved: claims.filter((claim) => claim.status === '已审核').length,
    rejected: claims.filter((claim) => claim.status === '已驳回').length,
  }), [claims]);

  const openItemDialog = () => {
    setItemForm(emptyItemForm);
    setItemDialogOpen(true);
  };

  const openClaimDialog = () => {
    setClaimForm({
      itemId: items[0] ? String(items[0].id) : '',
      quantity: '1',
      reason: '',
    });
    setClaimDialogOpen(true);
  };

  const openViewClaim = (claim: ItemClaimRecord) => {
    setSelectedClaim(claim);
    setViewClaimOpen(true);
  };

  const openEditClaim = (claim: ItemClaimRecord) => {
    if (!isPending(claim.status)) {
      alert('已审核或已驳回的领用申请不能修改');
      return;
    }
    setSelectedClaim(claim);
    setEditClaimForm({
      itemId: String(claim.itemId),
      quantity: String(claim.quantity),
      reason: claim.reason,
    });
    setEditClaimOpen(true);
  };

  const handleCreateItem = async () => {
    if (!itemForm.name.trim()) {
      alert('请填写物品名称');
      return;
    }

    setSavingItem(true);
    try {
      const response = await fetch('/api/item-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: itemForm.name,
          category: itemForm.category,
          unit: itemForm.unit,
          quantity: itemForm.quantity,
          unitPrice: itemForm.unitPrice,
          remark: itemForm.remark,
        }),
      });
      const result = await response.json().catch(() => ({})) as MutateItemResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '新增物品失败');
      }

      setItemForm(emptyItemForm);
      setItemDialogOpen(false);
      await loadData();
    } catch (saveError) {
      alert(saveError instanceof Error ? saveError.message : '新增物品失败');
    } finally {
      setSavingItem(false);
    }
  };

  const handleSubmitClaim = async () => {
    if (!claimForm.itemId) {
      alert('请选择领用物品');
      return;
    }
    if (!claimForm.reason.trim()) {
      alert('请填写领用原因');
      return;
    }

    setSubmittingClaim(true);
    try {
      const response = await fetch('/api/item-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          itemId: claimForm.itemId,
          quantity: claimForm.quantity,
          reason: claimForm.reason,
        }),
      });
      const result = await response.json().catch(() => ({})) as MutateClaimResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '提交领用申请失败');
      }

      setClaimForm((current) => ({ ...current, quantity: '1', reason: '' }));
      setClaimDialogOpen(false);
      await loadData();
    } catch (submitError) {
      alert(submitError instanceof Error ? submitError.message : '提交领用申请失败');
    } finally {
      setSubmittingClaim(false);
    }
  };

  const handleUpdateClaim = async () => {
    if (!selectedClaim) return;
    if (!editClaimForm.itemId) {
      alert('请选择领用物品');
      return;
    }
    if (!editClaimForm.reason.trim()) {
      alert('请填写领用原因');
      return;
    }

    setUpdatingClaim(true);
    try {
      const response = await fetch(`/api/item-claims/${selectedClaim.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          itemId: editClaimForm.itemId,
          quantity: editClaimForm.quantity,
          reason: editClaimForm.reason,
        }),
      });
      const result = await response.json().catch(() => ({})) as MutateClaimResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '修改领用申请失败');
      }

      setEditClaimOpen(false);
      setSelectedClaim(null);
      await loadData();
    } catch (updateError) {
      alert(updateError instanceof Error ? updateError.message : '修改领用申请失败');
    } finally {
      setUpdatingClaim(false);
    }
  };

  const handleDeleteClaim = async (claim: ItemClaimRecord) => {
    if (!window.confirm(`确定删除 ${claim.applicantName} 的 ${claim.itemName} 领用申请吗？`)) return;

    setDeletingId(claim.id);
    try {
      const response = await fetch(`/api/item-claims/${claim.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const result = await response.json().catch(() => ({})) as MutateClaimResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '删除领用申请失败');
      }

      await loadData();
    } catch (deleteError) {
      alert(deleteError instanceof Error ? deleteError.message : '删除领用申请失败');
    } finally {
      setDeletingId(null);
    }
  };

  const handleReview = async (claim: ItemClaimRecord, action: 'approve' | 'reject') => {
    const actionText = action === 'approve' ? '通过' : '驳回';
    if (!window.confirm(`确定${actionText} ${claim.applicantName} 的 ${claim.itemName} 领用申请吗？`)) return;

    setReviewingId(claim.id);
    try {
      const response = await fetch(`/api/item-claims/${claim.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action }),
      });
      const result = await response.json().catch(() => ({})) as MutateClaimResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '审核失败');
      }

      await loadData();
    } catch (reviewError) {
      alert(reviewError instanceof Error ? reviewError.message : '审核失败');
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatTile label="物品种类" value={summary.itemCount} tone="bg-blue-500" />
        <StatTile label="剩余数量" value={summary.remainingQuantity} tone="bg-emerald-500" />
        <StatTile label="已领用数量" value={summary.claimedQuantity} tone="bg-violet-500" />
        <StatTile label="待审核领用" value={summary.pendingQuantity} tone="bg-orange-500" />
        <StatTile label="库存金额" value={formatMoney(summary.totalValue)} tone="bg-slate-900" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
                <PackageCheck className="h-4 w-4 text-blue-600" />
                物品库
              </h2>
              <p className="mt-1 text-sm text-slate-500">管理物品数量、单价和剩余库存，审核领用后自动扣减。</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}>
                <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
                刷新
              </Button>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={openItemDialog}>
                <Plus className="h-4 w-4" />
                新增物品
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead>物品</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>剩余数量</TableHead>
                  <TableHead>已领用</TableHead>
                  <TableHead>待审核</TableHead>
                  <TableHead>单价</TableHead>
                  <TableHead>剩余金额</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-28 text-center text-sm text-slate-500">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        正在加载物品库...
                      </span>
                    </TableCell>
                  </TableRow>
                )}
                {!loading && items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-28 text-center text-sm text-slate-500">暂无物品</TableCell>
                  </TableRow>
                )}
                {!loading && items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.name}
                      <div className="text-xs text-slate-500">{display(item.remark)}</div>
                    </TableCell>
                    <TableCell>{display(item.category)}</TableCell>
                    <TableCell>{item.remainingQuantity} {item.unit}</TableCell>
                    <TableCell>{item.claimedQuantity} {item.unit}</TableCell>
                    <TableCell>{item.pendingQuantity} {item.unit}</TableCell>
                    <TableCell>{formatMoney(item.unitPrice)}</TableCell>
                    <TableCell>{formatMoney(item.totalValue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <ClipboardList className="h-4 w-4 text-emerald-600" />
            物品领用
          </h2>
          <p className="mt-1 text-sm text-slate-500">点击按钮填写领用申请，审核后才扣减库存。</p>
          <Button className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700" onClick={openClaimDialog} disabled={items.length === 0}>
            <Plus className="h-4 w-4" />
            物品领用申请
          </Button>

          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-orange-50 p-3 text-orange-700">
              <div className="text-lg font-semibold">{claimStats.pending}</div>
              <div className="text-xs">待审核</div>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3 text-emerald-700">
              <div className="text-lg font-semibold">{claimStats.approved}</div>
              <div className="text-xs">已审核</div>
            </div>
            <div className="rounded-lg bg-red-50 p-3 text-red-700">
              <div className="text-lg font-semibold">{claimStats.rejected}</div>
              <div className="text-xs">已驳回</div>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-4">
          <h2 className="text-base font-semibold text-slate-950">领用审核记录</h2>
          <p className="mt-1 text-sm text-slate-500">待审核申请通过后，物品库剩余数量会同步减少。</p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead>申请人</TableHead>
                <TableHead>部门</TableHead>
                <TableHead>物品</TableHead>
                <TableHead>数量</TableHead>
                <TableHead>原因</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>审核人</TableHead>
                <TableHead className="min-w-72">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={8} className="h-28 text-center text-sm text-slate-500">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    正在加载领用记录...
                  </TableCell>
                </TableRow>
              )}
              {!loading && claims.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-28 text-center text-sm text-slate-500">暂无领用申请</TableCell>
                </TableRow>
              )}
              {!loading && claims.map((claim) => (
                <TableRow key={claim.id}>
                  <TableCell className="font-medium">{claim.applicantName}</TableCell>
                  <TableCell>{display(claim.department)}</TableCell>
                  <TableCell>{claim.itemName}</TableCell>
                  <TableCell>{claim.quantity}</TableCell>
                  <TableCell className="max-w-72 truncate" title={claim.reason}>{display(claim.reason)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('ring-1', statusClass(claim.status))}>{claim.status}</Badge>
                  </TableCell>
                  <TableCell>{display(claim.reviewerName)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => openViewClaim(claim)}>
                        <Eye className="h-4 w-4" />
                        查看
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEditClaim(claim)}>
                        <Pencil className="h-4 w-4" />
                        修改
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => void handleDeleteClaim(claim)}
                        disabled={deletingId === claim.id}
                      >
                        {deletingId === claim.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        删除
                      </Button>
                      {isPending(claim.status) && (
                        <>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => void handleReview(claim, 'approve')}
                            disabled={reviewingId === claim.id}
                          >
                            {reviewingId === claim.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            通过
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleReview(claim, 'reject')}
                            disabled={reviewingId === claim.id}
                          >
                            <XCircle className="h-4 w-4" />
                            驳回
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
      </section>

      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>新增物品</DialogTitle>
            <DialogDescription>填写物品名称、数量和单价，保存后进入物品库。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={itemForm.name}
              onChange={(event) => setItemForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="物品名称"
              className="sm:col-span-2"
            />
            <Input
              value={itemForm.category}
              onChange={(event) => setItemForm((current) => ({ ...current, category: event.target.value }))}
              placeholder="分类"
            />
            <Input
              value={itemForm.unit}
              onChange={(event) => setItemForm((current) => ({ ...current, unit: event.target.value }))}
              placeholder="单位"
            />
            <Input
              value={itemForm.quantity}
              onChange={(event) => setItemForm((current) => ({ ...current, quantity: event.target.value }))}
              placeholder="数量"
              type="number"
              min="0"
            />
            <Input
              value={itemForm.unitPrice}
              onChange={(event) => setItemForm((current) => ({ ...current, unitPrice: event.target.value }))}
              placeholder="单价"
              type="number"
              min="0"
              step="0.01"
            />
            <Input
              value={itemForm.remark}
              onChange={(event) => setItemForm((current) => ({ ...current, remark: event.target.value }))}
              placeholder="备注"
              className="sm:col-span-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialogOpen(false)}>取消</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleCreateItem} disabled={savingItem}>
              {savingItem ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              保存物品
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>物品领用申请</DialogTitle>
            <DialogDescription>选择物品并填写领用数量和原因，提交后等待审核。</DialogDescription>
          </DialogHeader>
          <ClaimFormFields
            items={items}
            itemId={claimForm.itemId}
            quantity={claimForm.quantity}
            reason={claimForm.reason}
            onItemChange={(value) => setClaimForm((current) => ({ ...current, itemId: value }))}
            onQuantityChange={(value) => setClaimForm((current) => ({ ...current, quantity: value }))}
            onReasonChange={(value) => setClaimForm((current) => ({ ...current, reason: value }))}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setClaimDialogOpen(false)}>取消</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSubmitClaim} disabled={submittingClaim || items.length === 0}>
              {submittingClaim ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              提交申请
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewClaimOpen} onOpenChange={setViewClaimOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>查看领用申请</DialogTitle>
            <DialogDescription>查看申请人、物品、数量和审核状态。</DialogDescription>
          </DialogHeader>
          {selectedClaim && (
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              {[
                ['申请人', selectedClaim.applicantName],
                ['部门', selectedClaim.department],
                ['物品', selectedClaim.itemName],
                ['数量', selectedClaim.quantity],
                ['状态', selectedClaim.status],
                ['审核人', selectedClaim.reviewerName],
                ['审核时间', selectedClaim.reviewedAt],
                ['提交时间', selectedClaim.createdAt],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="text-xs text-slate-500">{label}</div>
                  <div className="mt-1 font-medium text-slate-900">{display(value)}</div>
                </div>
              ))}
              <div className="rounded-lg bg-slate-50 px-3 py-2 sm:col-span-2">
                <div className="text-xs text-slate-500">领用原因</div>
                <div className="mt-1 whitespace-pre-wrap font-medium text-slate-900">{display(selectedClaim.reason)}</div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewClaimOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editClaimOpen} onOpenChange={setEditClaimOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>修改领用申请</DialogTitle>
            <DialogDescription>仅待审核的申请可以修改；已审核申请不能修改库存相关信息。</DialogDescription>
          </DialogHeader>
          <ClaimFormFields
            items={items}
            itemId={editClaimForm.itemId}
            quantity={editClaimForm.quantity}
            reason={editClaimForm.reason}
            onItemChange={(value) => setEditClaimForm((current) => ({ ...current, itemId: value }))}
            onQuantityChange={(value) => setEditClaimForm((current) => ({ ...current, quantity: value }))}
            onReasonChange={(value) => setEditClaimForm((current) => ({ ...current, reason: value }))}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditClaimOpen(false)}>取消</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleUpdateClaim} disabled={updatingClaim}>
              {updatingClaim ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              保存修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
