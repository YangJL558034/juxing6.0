'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, Loader2, PackageCheck, Plus, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type {
  ItemClaimListResponse,
  ItemClaimRecord,
  ItemInventoryListResponse,
  ItemInventoryRecord,
  ItemInventorySummary,
} from '@/types/item-management';

interface MobileItemClaimsProps {
  canManage: boolean;
  standaloneRequest?: boolean;
}

interface MutateItemResponse {
  success: boolean;
  error?: string;
  message?: string;
}

interface MutateClaimResponse {
  success: boolean;
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

const emptyStockForm = {
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

function statusClass(status: string) {
  if (status === '已审核') return 'bg-emerald-50 text-emerald-700';
  if (status === '已驳回') return 'bg-red-50 text-red-700';
  return 'bg-orange-50 text-orange-700';
}

export default function MobileItemClaims({ canManage, standaloneRequest = false }: MobileItemClaimsProps) {
  const [items, setItems] = useState<ItemInventoryRecord[]>([]);
  const [claims, setClaims] = useState<ItemClaimRecord[]>([]);
  const [summary, setSummary] = useState<ItemInventorySummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stocking, setStocking] = useState(false);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [stockOpen, setStockOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [error, setError] = useState('');
  const [stockForm, setStockForm] = useState(emptyStockForm);
  const [applicantName, setApplicantName] = useState('');
  const [claimForm, setClaimForm] = useState({
    itemId: '',
    quantity: '1',
    reason: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const itemsResponse = await fetch('/api/item-inventory', { cache: 'no-store', credentials: 'include' });
      const itemsData = await itemsResponse.json().catch(() => ({})) as ItemInventoryListResponse;
      if (!itemsResponse.ok || !itemsData.success) {
        throw new Error(itemsData.error || '获取物品库失败');
      }

      let nextClaims: ItemClaimRecord[] = [];
      if (!standaloneRequest) {
        const claimsResponse = await fetch('/api/item-claims', { cache: 'no-store', credentials: 'include' });
        const claimsData = await claimsResponse.json().catch(() => ({})) as ItemClaimListResponse;
        if (!claimsResponse.ok || !claimsData.success) {
          throw new Error(claimsData.error || '获取领用记录失败');
        }
        nextClaims = claimsData.claims || [];
      }

      const nextItems = itemsData.items || [];
      setItems(nextItems);
      setClaims(nextClaims);
      setSummary(itemsData.summary || emptySummary);
      setClaimForm((current) => ({
        ...current,
        itemId: current.itemId || (nextItems[0] ? String(nextItems[0].id) : ''),
      }));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '加载物品领用失败');
      setItems([]);
      setClaims([]);
      setSummary(emptySummary);
    } finally {
      setLoading(false);
    }
  }, [standaloneRequest]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedItem = useMemo(() => {
    return items.find((item) => String(item.id) === claimForm.itemId) || null;
  }, [claimForm.itemId, items]);

  const showStockControls = canManage && !standaloneRequest;
  const showClaimControls = !standaloneRequest;
  const claimFormOpen = standaloneRequest || claimOpen;
  const pendingClaims = useMemo(() => claims.filter((claim) => claim.status === '待审核'), [claims]);

  const submitStock = async () => {
    if (!stockForm.name.trim()) {
      alert('请填写物品名称');
      return;
    }
    if (!stockForm.quantity || Number(stockForm.quantity) <= 0) {
      alert('请填写入库数量');
      return;
    }

    setStocking(true);
    try {
      const response = await fetch('/api/item-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: stockForm.name,
          category: stockForm.category,
          unit: stockForm.unit,
          quantity: stockForm.quantity,
          unitPrice: stockForm.unitPrice,
          remark: stockForm.remark,
        }),
      });
      const result = await response.json().catch(() => ({})) as MutateItemResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '物品入库失败');
      }
      setStockForm(emptyStockForm);
      setStockOpen(false);
      await loadData();
    } catch (stockError) {
      alert(stockError instanceof Error ? stockError.message : '物品入库失败');
    } finally {
      setStocking(false);
    }
  };

  const submitClaim = async () => {
    if (standaloneRequest && !applicantName.trim()) {
      alert('请填写申请人名称');
      return;
    }
    if (!claimForm.itemId) {
      alert('请选择领用物品');
      return;
    }
    if (!claimForm.reason.trim()) {
      alert('请填写领用原因');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/item-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          applicantName: standaloneRequest ? applicantName.trim() : undefined,
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
      setClaimOpen(false);
      if (standaloneRequest) {
        alert(result.message || '物品领用申请已提交，等待后台审核');
      }
      await loadData();
    } catch (submitError) {
      alert(submitError instanceof Error ? submitError.message : '提交领用申请失败');
    } finally {
      setSubmitting(false);
    }
  };

  const reviewClaim = async (claim: ItemClaimRecord, action: 'approve' | 'reject') => {
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
      <section className="mobile-ios-glass rounded-[30px] p-5 text-slate-950">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-blue-600">行政管理</p>
            <h1 className="mt-1 text-2xl font-bold tracking-normal">{canManage && !standaloneRequest ? '物品管理' : '物品领用申请'}</h1>
            <p className="mt-2 text-sm text-slate-600">
              {canManage ? '查看物品剩余、领用数量和待审核申请。' : '选择物品并提交领用申请。'}
            </p>
          </div>
          <Button
            size="icon"
            variant="secondary"
            className="h-11 w-11 rounded-2xl border border-white/70 bg-white/[0.58] text-blue-700 shadow-sm backdrop-blur-xl hover:bg-white/75"
            onClick={() => void loadData()}
            disabled={loading}
          >
            <RefreshCcw className={cn('h-5 w-5', loading && 'animate-spin')} />
          </Button>
        </div>

        {showStockControls && (
          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="mobile-ios-tile rounded-2xl p-3">
              <div className="text-xl font-bold">{summary.remainingQuantity}</div>
              <div className="mt-1 text-xs text-slate-500">剩余</div>
            </div>
            <div className="mobile-ios-tile rounded-2xl p-3">
              <div className="text-xl font-bold">{summary.claimedQuantity}</div>
              <div className="mt-1 text-xs text-slate-500">已领用</div>
            </div>
            <div className="mobile-ios-tile rounded-2xl p-3">
              <div className="text-xl font-bold">{summary.pendingQuantity}</div>
              <div className="mt-1 text-xs text-slate-500">待审核</div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
        {showClaimControls && (
        <div className={cn('grid gap-2', showStockControls ? 'grid-cols-2' : 'grid-cols-1')}>
          {showStockControls && (
            <Button
              variant="outline"
              className="h-12 rounded-2xl text-base font-semibold"
              onClick={() => {
                setStockOpen((current) => !current);
                setClaimOpen(false);
              }}
            >
              <PackageCheck className="mr-2 h-4 w-4" />
              物品入库
            </Button>
          )}
          <Button
            className="h-12 rounded-2xl bg-blue-600 text-base font-semibold hover:bg-blue-700"
            onClick={() => {
              setClaimOpen((current) => !current);
              setStockOpen(false);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            物品领用申请
          </Button>
        </div>
        )}

        {showStockControls && stockOpen && (
          <div className="mt-3 space-y-3 rounded-2xl bg-slate-50 p-3">
            <Input
              className="h-12 rounded-2xl bg-white"
              value={stockForm.name}
              onChange={(event) => setStockForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="物品名称"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                className="h-12 rounded-2xl bg-white"
                value={stockForm.category}
                onChange={(event) => setStockForm((current) => ({ ...current, category: event.target.value }))}
                placeholder="分类"
              />
              <Input
                className="h-12 rounded-2xl bg-white"
                value={stockForm.unit}
                onChange={(event) => setStockForm((current) => ({ ...current, unit: event.target.value }))}
                placeholder="单位"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                className="h-12 rounded-2xl bg-white"
                type="number"
                min="1"
                value={stockForm.quantity}
                onChange={(event) => setStockForm((current) => ({ ...current, quantity: event.target.value }))}
                placeholder="入库数量"
              />
              <Input
                className="h-12 rounded-2xl bg-white"
                type="number"
                min="0"
                step="0.01"
                value={stockForm.unitPrice}
                onChange={(event) => setStockForm((current) => ({ ...current, unitPrice: event.target.value }))}
                placeholder="单价"
              />
            </div>
            <Textarea
              className="min-h-20 rounded-2xl bg-white"
              value={stockForm.remark}
              onChange={(event) => setStockForm((current) => ({ ...current, remark: event.target.value }))}
              placeholder="备注"
            />
            <Button className="h-12 w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700" onClick={submitStock} disabled={stocking}>
              {stocking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-2 h-4 w-4" />}
              提交入库
            </Button>
          </div>
        )}

        {claimFormOpen && (
          <div className="mt-3 space-y-3 rounded-2xl bg-slate-50 p-3">
            {standaloneRequest && (
              <Input
                className="h-12 rounded-2xl bg-white"
                value={applicantName}
                onChange={(event) => setApplicantName(event.target.value)}
                placeholder="申请人名称"
              />
            )}
            <Select value={claimForm.itemId} onValueChange={(value) => setClaimForm((current) => ({ ...current, itemId: value }))}>
              <SelectTrigger className="h-12 rounded-2xl bg-white">
                <SelectValue placeholder="选择物品" />
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
              className="h-12 rounded-2xl bg-white"
              type="number"
              min="1"
              max={selectedItem?.remainingQuantity || undefined}
              value={claimForm.quantity}
              onChange={(event) => setClaimForm((current) => ({ ...current, quantity: event.target.value }))}
              placeholder="领用数量"
            />
            <Textarea
              className="min-h-24 rounded-2xl bg-white"
              value={claimForm.reason}
              onChange={(event) => setClaimForm((current) => ({ ...current, reason: event.target.value }))}
              placeholder="领用原因"
            />
            <Button className="h-12 w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700" onClick={submitClaim} disabled={submitting || items.length === 0}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardList className="mr-2 h-4 w-4" />}
              提交申请
            </Button>
          </div>
        )}
      </section>

      {error && <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {canManage && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-semibold text-slate-950">物品库</h2>
            <span className="text-sm text-slate-500">{items.length} 类</span>
          </div>

          {loading && (
            <div className="rounded-[24px] border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-blue-600" />
              正在加载
            </div>
          )}

          {!loading && items.map((item) => (
            <article key={item.id} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <PackageCheck className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-lg font-semibold text-slate-950">{item.name}</h3>
                  <p className="mt-1 truncate text-sm text-slate-500">{display(item.category)} / 单价 ￥{item.unitPrice}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-xs text-slate-400">剩余</div>
                  <div className="mt-1 font-medium text-slate-900">{item.remainingQuantity}{item.unit}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-xs text-slate-400">已领用</div>
                  <div className="mt-1 font-medium text-slate-900">{item.claimedQuantity}{item.unit}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-xs text-slate-400">待审</div>
                  <div className="mt-1 font-medium text-slate-900">{item.pendingQuantity}{item.unit}</div>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {!standaloneRequest && (
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-semibold text-slate-950">{canManage ? '领用审核' : '我的领用'}</h2>
          <span className="text-sm text-slate-500">{claims.length} 条</span>
        </div>

        {!loading && claims.length === 0 && (
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">暂无领用记录</div>
        )}

        {(canManage ? pendingClaims : claims).map((claim) => (
          <article key={claim.id} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-950">{claim.itemName}</h3>
                <p className="mt-1 text-sm text-slate-500">{claim.applicantName} / {display(claim.department)}</p>
              </div>
              <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', statusClass(claim.status))}>{claim.status}</span>
            </div>
            <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
              数量 {claim.quantity}，原因：{display(claim.reason)}
            </div>
            {canManage && claim.status === '待审核' && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button className="rounded-2xl bg-emerald-600 hover:bg-emerald-700" onClick={() => void reviewClaim(claim, 'approve')} disabled={reviewingId === claim.id}>
                  {reviewingId === claim.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  通过
                </Button>
                <Button variant="outline" className="rounded-2xl" onClick={() => void reviewClaim(claim, 'reject')} disabled={reviewingId === claim.id}>
                  驳回
                </Button>
              </div>
            )}
          </article>
        ))}
      </section>
      )}
    </div>
  );
}
