'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  BedDouble,
  CheckCircle2,
  DoorOpen,
  Download,
  Droplets,
  FileCheck2,
  Home,
  Hourglass,
  KeyRound,
  LogOut,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
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
import { cn } from '@/lib/utils';
import type {
  DormitoryBed,
  DormitoryRecord,
  DormitoryRoom,
  DormitoryRoomResident,
  DormitoryStatus,
} from '@/types/dormitory';
import type { WaterMeterRecord } from '@/types/water-meter';

interface DormitoryCounts {
  total: number;
  pending: number;
  reviewed: number;
  checkedIn: number;
  checkedOut: number;
}

interface ListResponse {
  success: boolean;
  records?: DormitoryRecord[];
  counts?: DormitoryCounts;
  error?: string;
}

interface MutateResponse {
  success: boolean;
  record?: DormitoryRecord;
  error?: string;
}

interface RoomsResponse {
  success: boolean;
  rooms?: DormitoryRoom[];
  error?: string;
}

interface BedsResponse {
  success: boolean;
  beds?: DormitoryBed[];
  error?: string;
}

interface RoomResidentsResponse {
  success: boolean;
  residents?: DormitoryRoomResident[];
  error?: string;
}

interface WaterMeterSummary {
  total: number;
  totalUsage: number;
  totalFee: number;
}

interface WaterMeterListResponse {
  success: boolean;
  records?: WaterMeterRecord[];
  summary?: WaterMeterSummary;
  error?: string;
}

const emptyCounts: DormitoryCounts = { total: 0, pending: 0, reviewed: 0, checkedIn: 0, checkedOut: 0 };
const emptyWaterSummary: WaterMeterSummary = { total: 0, totalUsage: 0, totalFee: 0 };

const statusTone: Record<DormitoryStatus, string> = {
  待审核: 'bg-orange-50 text-orange-700 ring-orange-200',
  已审核: 'bg-blue-50 text-blue-700 ring-blue-200',
  已入住: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  已退宿: 'bg-slate-100 text-slate-700 ring-slate-200',
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

function maskPhone(value?: string | null) {
  const phone = String(value || '').trim();
  if (phone.length < 7) return display(phone);
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function canExportDormitory(record?: DormitoryRecord | null) {
  return record?.status === '已入住' || record?.status === '已退宿';
}

function StatusBadge({ status }: { status: DormitoryStatus }) {
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

export default function AdministrationPage() {
  const [query, setQuery] = useState('');
  const [keyword, setKeyword] = useState('');
  const [activeStatus, setActiveStatus] = useState<DormitoryStatus>('待审核');
  const [records, setRecords] = useState<DormitoryRecord[]>([]);
  const [counts, setCounts] = useState<DormitoryCounts>(emptyCounts);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<DormitoryRecord | null>(null);
  const [reviewerName, setReviewerName] = useState('');
  const [reviewOpinion, setReviewOpinion] = useState('同意住宿。');
  const [reviewing, setReviewing] = useState(false);

  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInTarget, setCheckInTarget] = useState<DormitoryRecord | null>(null);
  const [roomNo, setRoomNo] = useState('');
  const [bedNo, setBedNo] = useState('');
  const [keyIssued, setKeyIssued] = useState('');
  const [handlerName, setHandlerName] = useState('');
  const [checkedInAt, setCheckedInAt] = useState(today());
  const [checkingIn, setCheckingIn] = useState(false);

  const [checkOutOpen, setCheckOutOpen] = useState(false);
  const [checkOutTarget, setCheckOutTarget] = useState<DormitoryRecord | null>(null);
  const [checkoutApplyDate, setCheckoutApplyDate] = useState(today());
  const [moveOutDate, setMoveOutDate] = useState(today());
  const [checkoutReason, setCheckoutReason] = useState('');
  const [keyReturned, setKeyReturned] = useState('');
  const [checkoutHandlerName, setCheckoutHandlerName] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);

  const [rooms, setRooms] = useState<DormitoryRoom[]>([]);
  const [beds, setBeds] = useState<DormitoryBed[]>([]);
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [bedsOpen, setBedsOpen] = useState(false);
  const [roomDetailOpen, setRoomDetailOpen] = useState(false);
  const [roomDetail, setRoomDetail] = useState<DormitoryRoom | null>(null);
  const [roomResidents, setRoomResidents] = useState<DormitoryRoomResident[]>([]);
  const [roomResidentsLoading, setRoomResidentsLoading] = useState(false);
  const [waterOpen, setWaterOpen] = useState(false);
  const [waterRecords, setWaterRecords] = useState<WaterMeterRecord[]>([]);
  const [waterSummary, setWaterSummary] = useState<WaterMeterSummary>(emptyWaterSummary);
  const [waterLoading, setWaterLoading] = useState(false);
  const [waterRoomFilter, setWaterRoomFilter] = useState('all');
  const [waterExportMonth, setWaterExportMonth] = useState(currentMonth());
  const [roomSaving, setRoomSaving] = useState(false);
  const [bedSaving, setBedSaving] = useState(false);
  const [newRoomNo, setNewRoomNo] = useState('');
  const [newRoomCapacity, setNewRoomCapacity] = useState('');
  const [newRoomRemark, setNewRoomRemark] = useState('');
  const [bedRoomId, setBedRoomId] = useState('');
  const [newBedNo, setNewBedNo] = useState('');

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      params.set('status', activeStatus);
      if (keyword.trim()) params.set('keyword', keyword.trim());

      const response = await fetch(`/api/dormitory?${params.toString()}`, { cache: 'no-store' });
      const result = await response.json().catch(() => ({})) as ListResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error || '获取住宿申请列表失败');
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
      setError(fetchError instanceof Error ? fetchError.message : '获取住宿申请列表失败');
      setRecords([]);
      setSelectedId(null);
      setDetailVisible(false);
    } finally {
      setLoading(false);
    }
  }, [activeStatus, keyword]);

  const loadRooms = useCallback(async () => {
    try {
      const response = await fetch('/api/dormitory/rooms', { cache: 'no-store' });
      const result = await response.json().catch(() => ({})) as RoomsResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '获取房号失败');
      }
      setRooms(result.rooms || []);
    } catch (fetchError) {
      alert(fetchError instanceof Error ? fetchError.message : '获取房号失败');
    }
  }, []);

  const loadBeds = useCallback(async () => {
    try {
      const response = await fetch('/api/dormitory/beds', { cache: 'no-store' });
      const result = await response.json().catch(() => ({})) as BedsResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '获取床号失败');
      }
      setBeds(result.beds || []);
    } catch (fetchError) {
      alert(fetchError instanceof Error ? fetchError.message : '获取床号失败');
    }
  }, []);

  const loadWaterRecords = useCallback(async () => {
    setWaterLoading(true);
    try {
      const params = new URLSearchParams();
      if (waterRoomFilter !== 'all') params.set('roomNo', waterRoomFilter);

      const response = await fetch(`/api/water-meter?${params.toString()}`, { cache: 'no-store' });
      const result = await response.json().catch(() => ({})) as WaterMeterListResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '获取水表记录失败');
      }

      setWaterRecords(result.records || []);
      setWaterSummary(result.summary || emptyWaterSummary);
    } catch (fetchError) {
      alert(fetchError instanceof Error ? fetchError.message : '获取水表记录失败');
      setWaterRecords([]);
      setWaterSummary(emptyWaterSummary);
    } finally {
      setWaterLoading(false);
    }
  }, [waterRoomFilter]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    void loadRooms();
    void loadBeds();
  }, [loadBeds, loadRooms]);

  const selectedRecord = useMemo(() => {
    if (!selectedId) return null;
    return records.find((record) => record.id === selectedId) || null;
  }, [records, selectedId]);

  const statItems = useMemo(() => [
    { label: '全部申请', value: counts.total, icon: Archive, tone: 'bg-slate-100 text-slate-700' },
    { label: '待审核', value: counts.pending, icon: Hourglass, tone: 'bg-orange-50 text-orange-600' },
    { label: '已审核', value: counts.reviewed, icon: CheckCircle2, tone: 'bg-blue-50 text-blue-600' },
    { label: '已入住', value: counts.checkedIn, icon: BedDouble, tone: 'bg-emerald-50 text-emerald-600' },
    { label: '已退宿', value: counts.checkedOut, icon: LogOut, tone: 'bg-slate-100 text-slate-600' },
  ], [counts]);

  const statusPages: Array<{ status: DormitoryStatus; label: string; count: number }> = [
    { status: '待审核', label: '待审核', count: counts.pending },
    { status: '已审核', label: '已审核', count: counts.reviewed },
    { status: '已入住', label: '已入住', count: counts.checkedIn },
    { status: '已退宿', label: '已退宿', count: counts.checkedOut },
  ];

  const selectedRoomBeds = useMemo(() => {
    return beds.filter((bed) => bed.roomNo === roomNo);
  }, [beds, roomNo]);

  const managementBeds = useMemo(() => {
    const selectedRoom = rooms.find((room) => String(room.id) === bedRoomId);
    if (!selectedRoom) return [];
    return beds.filter((bed) => bed.roomId === selectedRoom.id);
  }, [bedRoomId, beds, rooms]);

  const waterMonthGroups = useMemo(() => {
    const groups = new Map<string, WaterMeterRecord[]>();
    waterRecords.forEach((record) => {
      const month = record.readingDate?.slice(0, 7) || '未登记月份';
      groups.set(month, [...(groups.get(month) || []), record]);
    });

    return Array.from(groups.entries())
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([month, groupRecords]) => ({
        month,
        records: groupRecords,
        usage: Number(groupRecords.reduce((sum, record) => sum + (record.usageAmount || 0), 0).toFixed(2)),
        fee: Number(groupRecords.reduce((sum, record) => sum + (record.feeAmount || 0), 0).toFixed(2)),
      }));
  }, [waterRecords]);

  const runSearch = () => setKeyword(query);

  const addRoom = async () => {
    if (!newRoomNo.trim()) {
      alert('请填写房号');
      return;
    }

    setRoomSaving(true);
    try {
      const response = await fetch('/api/dormitory/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomNo: newRoomNo.trim(),
          capacity: Number(newRoomCapacity) || 0,
          remark: newRoomRemark.trim(),
        }),
      });
      const result = await response.json().catch(() => ({})) as MutateResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '添加房号失败');
      }
      setNewRoomNo('');
      setNewRoomCapacity('');
      setNewRoomRemark('');
      await loadRooms();
    } catch (roomError) {
      alert(roomError instanceof Error ? roomError.message : '添加房号失败');
    } finally {
      setRoomSaving(false);
    }
  };

  const deleteRoom = async (room: DormitoryRoom) => {
    if (!confirm(`确定删除房号 ${room.roomNo} 吗？`)) return;

    try {
      const response = await fetch(`/api/dormitory/rooms?id=${room.id}`, { method: 'DELETE' });
      const result = await response.json().catch(() => ({})) as MutateResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '删除房号失败');
      }
      if (bedRoomId === String(room.id)) setBedRoomId('');
      await loadRooms();
      await loadBeds();
    } catch (roomError) {
      alert(roomError instanceof Error ? roomError.message : '删除房号失败');
    }
  };

  const openRoomDetail = async (room: DormitoryRoom) => {
    setRoomDetail(room);
    setRoomResidents([]);
    setRoomDetailOpen(true);
    setRoomResidentsLoading(true);

    try {
      const response = await fetch(`/api/dormitory/rooms/${room.id}/residents`, { cache: 'no-store' });
      const result = await response.json().catch(() => ({})) as RoomResidentsResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '获取房号入住详情失败');
      }
      setRoomResidents(result.residents || []);
    } catch (detailError) {
      alert(detailError instanceof Error ? detailError.message : '获取房号入住详情失败');
      setRoomResidents([]);
    } finally {
      setRoomResidentsLoading(false);
    }
  };

  const addBed = async () => {
    if (!bedRoomId) {
      alert('请选择房号');
      return;
    }
    if (!newBedNo.trim()) {
      alert('请填写床号');
      return;
    }

    setBedSaving(true);
    try {
      const response = await fetch('/api/dormitory/beds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: Number(bedRoomId),
          bedNo: newBedNo.trim(),
        }),
      });
      const result = await response.json().catch(() => ({})) as MutateResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '添加床号失败');
      }
      setNewBedNo('');
      await loadRooms();
      await loadBeds();
    } catch (bedError) {
      alert(bedError instanceof Error ? bedError.message : '添加床号失败');
    } finally {
      setBedSaving(false);
    }
  };

  const deleteBed = async (bed: DormitoryBed) => {
    if (!confirm(`确定删除 ${bed.roomNo} 的 ${bed.bedNo} 床吗？`)) return;

    try {
      const response = await fetch(`/api/dormitory/beds?id=${bed.id}`, { method: 'DELETE' });
      const result = await response.json().catch(() => ({})) as MutateResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '删除床号失败');
      }
      await loadRooms();
      await loadBeds();
    } catch (bedError) {
      alert(bedError instanceof Error ? bedError.message : '删除床号失败');
    }
  };

  const changeStatusPage = (value: string) => {
    setActiveStatus(value as DormitoryStatus);
    setSelectedId(null);
    setDetailVisible(false);
  };

  const showDetail = (record: DormitoryRecord) => {
    setSelectedId(record.id);
    setDetailVisible(true);
  };

  const openReview = (record: DormitoryRecord) => {
    setReviewTarget(record);
    setReviewerName(record.reviewerName || '');
    setReviewOpinion(record.reviewOpinion || '同意住宿。');
    setRoomNo(record.roomNo || '');
    setBedNo(record.bedNo || '');
    setKeyIssued(record.keyIssued || '');
    setReviewOpen(true);
  };

  const openCheckIn = (record: DormitoryRecord) => {
    setCheckInTarget(record);
    setRoomNo(record.roomNo || '');
    setBedNo(record.bedNo || '');
    setKeyIssued(record.keyIssued || '');
    setHandlerName(record.handlerName || '');
    setCheckedInAt(formatDate(record.checkedInAt) === '-' ? today() : formatDate(record.checkedInAt));
    setCheckInOpen(true);
  };

  const openCheckOut = (record: DormitoryRecord) => {
    setCheckOutTarget(record);
    setCheckoutApplyDate(formatDate(record.checkoutApplyDate) === '-' ? today() : formatDate(record.checkoutApplyDate));
    setMoveOutDate(formatDate(record.moveOutDate) === '-' ? today() : formatDate(record.moveOutDate));
    setCheckoutReason(record.checkoutReason || '');
    setKeyReturned(record.keyReturned || '');
    setCheckoutHandlerName(record.checkoutHandlerName || '');
    setCheckOutOpen(true);
  };

  const submitReview = async () => {
    if (!reviewTarget) return;
    if (!reviewerName.trim()) {
      alert('请填写审核人姓名');
      return;
    }
    if (!roomNo) {
      alert('请选择房号');
      return;
    }
    if (!bedNo) {
      alert('请选择床号');
      return;
    }
    if (!keyIssued.trim()) {
      alert('请填写领用几把钥匙');
      return;
    }

    setReviewing(true);
    try {
      const response = await fetch(`/api/dormitory/${reviewTarget.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewerName: reviewerName.trim(),
          reviewOpinion: reviewOpinion.trim() || '同意住宿。',
          roomNo,
          bedNo,
          keyIssued: keyIssued.trim(),
        }),
      });
      const result = await response.json().catch(() => ({})) as MutateResponse;

      if (!response.ok || !result.success) {
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

  const submitCheckIn = async () => {
    if (!checkInTarget) return;
    if (!roomNo) {
      alert('请选择房号');
      return;
    }
    if (!bedNo) {
      alert('请选择床号');
      return;
    }
    if (!handlerName.trim()) {
      alert('请填写行政经办人');
      return;
    }
    if (!keyIssued.trim()) {
      alert('请填写领用几把钥匙');
      return;
    }

    setCheckingIn(true);
    try {
      const response = await fetch(`/api/dormitory/${checkInTarget.id}/check-in`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomNo,
          bedNo,
          keyIssued: keyIssued.trim(),
          handlerName: handlerName.trim(),
          checkedInAt,
        }),
      });
      const result = await response.json().catch(() => ({})) as MutateResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error || '办理入住失败');
      }

      setCheckInOpen(false);
      setCheckInTarget(null);
      setSelectedId(null);
      setDetailVisible(false);
      setActiveStatus('已入住');
    } catch (checkInError) {
      alert(checkInError instanceof Error ? checkInError.message : '办理入住失败');
    } finally {
      setCheckingIn(false);
    }
  };

  const submitCheckOut = async () => {
    if (!checkOutTarget) return;
    if (!checkoutApplyDate) {
      alert('请选择退宿申请日期');
      return;
    }
    if (!moveOutDate) {
      alert('请选择搬出日期');
      return;
    }
    if (!checkoutReason.trim()) {
      alert('请填写搬出原因');
      return;
    }
    if (!keyReturned.trim()) {
      alert('请填写归还几把钥匙');
      return;
    }
    if (!checkoutHandlerName.trim()) {
      alert('请填写行政经办人');
      return;
    }

    setCheckingOut(true);
    try {
      const response = await fetch(`/api/dormitory/${checkOutTarget.id}/check-out`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkoutApplyDate,
          moveOutDate,
          checkoutReason: checkoutReason.trim(),
          keyReturned: keyReturned.trim(),
          checkoutHandlerName: checkoutHandlerName.trim(),
        }),
      });
      const result = await response.json().catch(() => ({})) as MutateResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error || '办理退宿舍失败');
      }

      setCheckOutOpen(false);
      setCheckOutTarget(null);
      setSelectedId(null);
      setDetailVisible(false);
      setActiveStatus('已退宿');
      await loadRooms();
      await loadBeds();
    } catch (checkOutError) {
      alert(checkOutError instanceof Error ? checkOutError.message : '办理退宿舍失败');
    } finally {
      setCheckingOut(false);
    }
  };

  const exportRecord = (record: DormitoryRecord) => {
    if (!canExportDormitory(record)) {
      alert('请先完成办理入住，再导出住宿申请表');
      return;
    }
    window.open(`/api/dormitory/${record.id}/export`, '_blank', 'noopener,noreferrer');
  };

  const openWaterRecords = () => {
    setWaterOpen(true);
    void loadWaterRecords();
  };

  const exportWaterRecords = () => {
    if (!waterExportMonth) {
      alert('请选择要导出的月份');
      return;
    }

    const params = new URLSearchParams();
    if (waterRoomFilter !== 'all') params.set('roomNo', waterRoomFilter);
    params.set('month', waterExportMonth);
    window.open(`/api/water-meter/export?${params.toString()}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-slate-50 p-4 text-slate-950 md:p-6">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm text-slate-500">
            组织人事 / <span className="text-slate-800">行政管理</span>
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-normal text-slate-950">行政管理</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link href="/dormitory" target="_blank">
              <Plus className="h-4 w-4" />
              住宿申请
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/water-meter" target="_blank">
              <Droplets className="h-4 w-4" />
              水费登记
            </Link>
          </Button>
          <Button variant="outline" onClick={openWaterRecords}>
            <Droplets className="h-4 w-4" />
            水表记录
          </Button>
          <Button variant="outline" onClick={() => setRoomsOpen(true)}>
            <DoorOpen className="h-4 w-4" />
            房号管理
          </Button>
          <Button variant="outline" onClick={() => setBedsOpen(true)}>
            <BedDouble className="h-4 w-4" />
            床号管理
          </Button>
          <Button
            variant="outline"
            disabled={!canExportDormitory(selectedRecord)}
            onClick={() => selectedRecord && exportRecord(selectedRecord)}
          >
            <Download className="h-4 w-4" />
            导出申请表
          </Button>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_auto] md:items-end">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">姓名 / 手机号 / 身份证号 / 部门 / 职位</label>
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
          <div className="flex gap-2">
            <Button variant="outline" className="min-w-20" onClick={() => { setQuery(''); setKeyword(''); }}>
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

      <div className={cn('grid gap-4', detailVisible && selectedRecord ? 'xl:grid-cols-[minmax(0,1fr)_420px]' : 'grid-cols-1')}>
        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {statItems.map((item) => (
              <StatCard key={item.label} {...item} />
            ))}
          </div>

          <div className="rounded-lg border border-slate-100 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950">{activeStatus}列表</h2>
                <p className="mt-1 text-sm text-slate-500">当前展示 {records.length} 条记录</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Tabs value={activeStatus} onValueChange={changeStatusPage}>
                  <TabsList className="grid h-10 grid-cols-4 bg-slate-100 p-1">
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
                    <TableHead>手机号</TableHead>
                    <TableHead>部门/职位</TableHead>
                    <TableHead>安排入住日期</TableHead>
                    <TableHead>宿舍房/床号</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>提交时间</TableHead>
                    <TableHead className="min-w-64">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={9} className="h-28 text-center text-sm text-slate-500">
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          正在加载住宿申请...
                        </span>
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && records.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="h-28 text-center text-sm text-slate-500">
                        暂无{activeStatus}记录
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && records.map((record, index) => (
                    <TableRow
                      key={record.id}
                      className={cn(selectedRecord?.id === record.id && detailVisible && 'bg-blue-50/60')}
                    >
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">{record.name}</TableCell>
                      <TableCell>{maskPhone(record.phone)}</TableCell>
                      <TableCell>{[record.department, record.position].filter(Boolean).join(' / ') || '-'}</TableCell>
                      <TableCell>{formatDate(record.expectedCheckInDate)}</TableCell>
                      <TableCell>{display(record.roomBed)}</TableCell>
                      <TableCell><StatusBadge status={record.status} /></TableCell>
                      <TableCell>{formatDateTime(record.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <button type="button" className="text-sm font-medium text-blue-600 hover:text-blue-700" onClick={() => showDetail(record)}>
                            查看
                          </button>
                          {record.status === '待审核' && (
                            <button type="button" className="text-sm font-medium text-blue-600 hover:text-blue-700" onClick={() => openReview(record)}>
                              审核
                            </button>
                          )}
                          {record.status === '已审核' && (
                            <button type="button" className="text-sm font-medium text-emerald-600 hover:text-emerald-700" onClick={() => openCheckIn(record)}>
                              办理入住
                            </button>
                          )}
                          {record.status === '已入住' && (
                            <>
                              <button type="button" className="text-sm font-medium text-slate-700 hover:text-slate-950" onClick={() => openCheckOut(record)}>
                                办理退宿舍
                              </button>
                              <button type="button" className="text-sm font-medium text-blue-600 hover:text-blue-700" onClick={() => exportRecord(record)}>
                                导出
                              </button>
                            </>
                          )}
                          {record.status === '已退宿' && (
                            <button type="button" className="text-sm font-medium text-blue-600 hover:text-blue-700" onClick={() => exportRecord(record)}>
                              导出
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>共 {records.length} 条</span>
              <span>办理入住后可导出 Excel 住宿申请表，退宿后会补齐表格下半部分</span>
            </div>
          </div>
        </div>

        {detailVisible && selectedRecord && (
          <aside className="overflow-hidden rounded-lg border border-slate-100 bg-white shadow-sm xl:sticky xl:top-20 xl:h-[calc(100vh-7rem)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-950">住宿申请详情</h2>
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

            <div className="h-[calc(100%-4.5rem)] overflow-y-auto">
              <section className="border-b border-slate-100 px-5 py-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-950">申请信息</h3>
                <DetailGrid
                  pairs={[
                    ['姓名', selectedRecord.name],
                    ['手机号', selectedRecord.phone],
                    ['部门', selectedRecord.department],
                    ['职位', selectedRecord.position],
                    ['身份证号', selectedRecord.idCard],
                    ['安排入住', formatDate(selectedRecord.expectedCheckInDate)],
                    ['入住原因', selectedRecord.reason],
                    ['状态', selectedRecord.status],
                  ]}
                />
              </section>
              <section className="border-b border-slate-100 px-5 py-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-950">审核信息</h3>
                <DetailGrid
                  pairs={[
                    ['审核人', selectedRecord.reviewerName],
                    ['审核意见', selectedRecord.reviewOpinion],
                    ['审核时间', formatDateTime(selectedRecord.reviewedAt)],
                  ]}
                />
              </section>
              <section className="border-b border-slate-100 px-5 py-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-950">入住办理</h3>
                <DetailGrid
                  pairs={[
                    ['房号', selectedRecord.roomNo],
                    ['床号', selectedRecord.bedNo],
                    ['宿舍房/床号', selectedRecord.roomBed],
                    ['领用钥匙数量', selectedRecord.keyIssued],
                    ['行政经办人', selectedRecord.handlerName],
                    ['入住日期', formatDate(selectedRecord.checkedInAt)],
                  ]}
                />
              </section>
              {selectedRecord.status === '已退宿' && (
                <section className="border-b border-slate-100 px-5 py-4">
                  <h3 className="mb-3 text-sm font-semibold text-slate-950">退宿办理</h3>
                  <DetailGrid
                    pairs={[
                      ['退宿申请日期', formatDate(selectedRecord.checkoutApplyDate)],
                      ['搬出日期', formatDate(selectedRecord.moveOutDate)],
                      ['搬出原因', selectedRecord.checkoutReason],
                      ['归还钥匙数量', selectedRecord.keyReturned],
                      ['退宿经办人', selectedRecord.checkoutHandlerName],
                      ['退宿办理时间', formatDateTime(selectedRecord.checkedOutAt)],
                    ]}
                  />
                </section>
              )}
              <div className="flex flex-wrap gap-2 px-5 py-4">
                {selectedRecord.status === '待审核' && (
                  <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={() => openReview(selectedRecord)}>
                    <FileCheck2 className="h-4 w-4" />
                    审核
                  </Button>
                )}
                {selectedRecord.status === '已审核' && (
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => openCheckIn(selectedRecord)}>
                    <KeyRound className="h-4 w-4" />
                    办理入住
                  </Button>
                )}
                {selectedRecord.status === '已入住' && (
                  <>
                    <Button variant="outline" className="flex-1" onClick={() => openCheckOut(selectedRecord)}>
                      <LogOut className="h-4 w-4" />
                      办理退宿舍
                    </Button>
                    <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={() => exportRecord(selectedRecord)}>
                      <Download className="h-4 w-4" />
                      导出申请表
                    </Button>
                  </>
                )}
                {selectedRecord.status === '已退宿' && (
                  <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={() => exportRecord(selectedRecord)}>
                    <Download className="h-4 w-4" />
                    导出申请表
                  </Button>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px_280px]">
        <div className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <Home className="h-4 w-4 text-blue-600" />
            住宿申请流程
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            员工提交住宿申请后进入待审核页；行政审核通过后进入已审核页；填写宿舍房/床号、钥匙领用和行政经办人后完成入住；办理退宿舍后进入已退宿页，并补齐 Excel 表格下半部分。
          </p>
        </div>
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
              <BedDouble className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-950">员工住宿申请页面</p>
              <p className="text-xs text-slate-500">/dormitory</p>
            </div>
          </div>
          <Button asChild variant="outline" className="mt-4 w-full border-blue-200 bg-white text-blue-700 hover:bg-blue-50">
            <Link href="/dormitory" target="_blank">
              打开申请页
            </Link>
          </Button>
        </div>
        <div className="rounded-lg border border-cyan-100 bg-cyan-50 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-600 text-white">
              <Droplets className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-950">移动端水费登记页面</p>
              <p className="text-xs text-slate-500">/water-meter</p>
            </div>
          </div>
          <Button asChild variant="outline" className="mt-4 w-full border-cyan-200 bg-white text-cyan-700 hover:bg-cyan-50">
            <Link href="/water-meter" target="_blank">
              打开登记页
            </Link>
          </Button>
        </div>
      </div>

      <Dialog open={roomsOpen} onOpenChange={setRoomsOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>房号管理</DialogTitle>
            <DialogDescription>
              维护宿舍房号和最大可住人数，用于判断房间是否住满。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-[1fr_140px_1fr_auto] md:items-end">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">房号</label>
              <Input value={newRoomNo} onChange={(event) => setNewRoomNo(event.target.value)} placeholder="例如：A栋302" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">可住人数</label>
              <Input value={newRoomCapacity} onChange={(event) => setNewRoomCapacity(event.target.value)} placeholder="例如：4" inputMode="numeric" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">备注</label>
              <Input value={newRoomRemark} onChange={(event) => setNewRoomRemark(event.target.value)} placeholder="可选" />
            </div>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => void addRoom()} disabled={roomSaving}>
              {roomSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              添加房号
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>房号</TableHead>
                  <TableHead>已住/可住</TableHead>
                  <TableHead>床位数</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead className="w-36">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-sm text-slate-500">
                      暂无房号
                    </TableCell>
                  </TableRow>
                )}
                {rooms.map((room) => (
                  <TableRow key={room.id}>
                    <TableCell className="font-medium">{room.roomNo}</TableCell>
                    <TableCell>{room.occupiedCount}/{room.capacity || room.bedCount || '-'}</TableCell>
                    <TableCell>{room.bedCount}</TableCell>
                    <TableCell>
                      <span className={cn('inline-flex rounded-md px-2 py-1 text-xs font-medium ring-1', room.isFull ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200')}>
                        {room.isFull ? '已住满' : '未住满'}
                      </span>
                    </TableCell>
                    <TableCell>{display(room.remark)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <button type="button" className="text-sm font-medium text-blue-600 hover:text-blue-700" onClick={() => void openRoomDetail(room)}>
                          详细
                        </button>
                        <button type="button" className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700" onClick={() => void deleteRoom(room)}>
                          <Trash2 className="h-3.5 w-3.5" />
                          删除
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoomsOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={roomDetailOpen} onOpenChange={setRoomDetailOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>房号详情</DialogTitle>
            <DialogDescription>
              查看该房号当前已入住人员和入住时间。
            </DialogDescription>
          </DialogHeader>
          {roomDetail && (
            <div className="grid gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm sm:grid-cols-4">
              <div>
                <p className="text-slate-500">房号</p>
                <p className="mt-1 font-semibold text-slate-950">{roomDetail.roomNo}</p>
              </div>
              <div>
                <p className="text-slate-500">已住/可住</p>
                <p className="mt-1 font-semibold text-slate-950">{roomDetail.occupiedCount}/{roomDetail.capacity || roomDetail.bedCount || '-'}</p>
              </div>
              <div>
                <p className="text-slate-500">床位数</p>
                <p className="mt-1 font-semibold text-slate-950">{roomDetail.bedCount}</p>
              </div>
              <div>
                <p className="text-slate-500">状态</p>
                <p className="mt-1 font-semibold text-slate-950">{roomDetail.isFull ? '已住满' : '未住满'}</p>
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>床号</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead>手机号</TableHead>
                  <TableHead>部门/职位</TableHead>
                  <TableHead>入住时间</TableHead>
                  <TableHead>领用钥匙</TableHead>
                  <TableHead>经办人</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roomResidentsLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-sm text-slate-500">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        正在加载入住人员...
                      </span>
                    </TableCell>
                  </TableRow>
                )}
                {!roomResidentsLoading && roomResidents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-sm text-slate-500">
                      当前暂无入住人员
                    </TableCell>
                  </TableRow>
                )}
                {!roomResidentsLoading && roomResidents.map((resident) => (
                  <TableRow key={resident.id}>
                    <TableCell>{display(resident.bedNo)}</TableCell>
                    <TableCell className="font-medium">{resident.name}</TableCell>
                    <TableCell>{maskPhone(resident.phone)}</TableCell>
                    <TableCell>{[resident.department, resident.position].filter(Boolean).join(' / ') || '-'}</TableCell>
                    <TableCell>{formatDateTime(resident.checkedInAt)}</TableCell>
                    <TableCell>{display(resident.keyIssued)}</TableCell>
                    <TableCell>{display(resident.handlerName)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoomDetailOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={waterOpen} onOpenChange={setWaterOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>水表记录</DialogTitle>
            <DialogDescription>
              查看移动端提交的水费登记记录，记录按月份折叠展示，导出时只导出所选月份。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 lg:grid-cols-[180px_180px_auto_auto] lg:items-end">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">房号</label>
              <Select value={waterRoomFilter} onValueChange={setWaterRoomFilter}>
                <SelectTrigger><SelectValue placeholder="全部房号" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部房号</SelectItem>
                  {rooms.map((room) => (
                    <SelectItem key={room.id} value={room.roomNo}>{room.roomNo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">导出月份</label>
              <Input type="month" value={waterExportMonth} onChange={(event) => setWaterExportMonth(event.target.value)} />
            </div>
            <Button variant="outline" onClick={() => { setWaterRoomFilter('all'); setWaterExportMonth(currentMonth()); }}>
              重置
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => void loadWaterRecords()} disabled={waterLoading}>
              {waterLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              查询
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-sm text-slate-500">记录数</p>
              <p className="mt-1 text-xl font-semibold text-slate-950">{waterSummary.total}</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-sm text-slate-500">本次用水量合计</p>
              <p className="mt-1 text-xl font-semibold text-slate-950">{waterSummary.totalUsage}</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-sm text-slate-500">水费金额合计</p>
              <p className="mt-1 text-xl font-semibold text-slate-950">¥{waterSummary.totalFee}</p>
            </div>
          </div>

          <div className="space-y-3">
            {waterLoading && (
              <div className="flex h-24 items-center justify-center rounded-lg border border-slate-100 text-sm text-slate-500">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在加载水表记录...
                </span>
              </div>
            )}
            {!waterLoading && waterMonthGroups.length === 0 && (
              <div className="flex h-24 items-center justify-center rounded-lg border border-slate-100 text-sm text-slate-500">
                暂无水表记录
              </div>
            )}
            {!waterLoading && waterMonthGroups.length > 0 && (
              <Accordion
                key={waterMonthGroups.map((group) => group.month).join('|')}
                type="multiple"
                defaultValue={waterMonthGroups.slice(0, 1).map((group) => group.month)}
                className="space-y-3"
              >
                {waterMonthGroups.map((group) => (
                  <AccordionItem key={group.month} value={group.month} className="rounded-lg border border-slate-100 bg-white">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-left">
                        <span className="text-base font-semibold text-slate-950">{group.month}</span>
                        <span className="text-sm font-normal text-slate-500">{group.records.length} 条记录</span>
                        <span className="text-sm font-normal text-slate-500">用水量 {group.usage}</span>
                        <span className="text-sm font-normal text-slate-500">水费 ¥{group.fee}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-0 pb-0">
                      <div className="overflow-x-auto border-t border-slate-100">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50">
                              <TableHead>序号</TableHead>
                              <TableHead>房号</TableHead>
                              <TableHead>登记日期</TableHead>
                              <TableHead>上次读数</TableHead>
                              <TableHead>本次读数</TableHead>
                              <TableHead>本次用水量</TableHead>
                              <TableHead>单价</TableHead>
                              <TableHead>金额</TableHead>
                              <TableHead>登记人</TableHead>
                              <TableHead>备注</TableHead>
                              <TableHead>提交时间</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.records.map((record, index) => (
                              <TableRow key={record.id}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell className="font-medium">{record.roomNo}</TableCell>
                                <TableCell>{formatDate(record.readingDate)}</TableCell>
                                <TableCell>{display(record.previousReadingText)}</TableCell>
                                <TableCell>{record.currentReadingText}</TableCell>
                                <TableCell>{display(record.usageAmount)}</TableCell>
                                <TableCell>{display(record.unitPrice)}</TableCell>
                                <TableCell>{record.feeAmount === null ? '-' : `¥${record.feeAmount}`}</TableCell>
                                <TableCell>{display(record.recorderName)}</TableCell>
                                <TableCell>{display(record.remark)}</TableCell>
                                <TableCell>{formatDateTime(record.createdAt)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setWaterOpen(false)}>
              关闭
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={exportWaterRecords}>
              <Download className="h-4 w-4" />
              导出所选月份
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bedsOpen} onOpenChange={setBedsOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>床号管理</DialogTitle>
            <DialogDescription>
              先选择房号，再添加床号。已入住床位会显示当前入住人员。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">房号</label>
              <Select value={bedRoomId} onValueChange={setBedRoomId}>
                <SelectTrigger><SelectValue placeholder="请选择房号" /></SelectTrigger>
                <SelectContent>
                  {rooms.map((room) => (
                    <SelectItem key={room.id} value={String(room.id)}>{room.roomNo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">床号</label>
              <Input value={newBedNo} onChange={(event) => setNewBedNo(event.target.value)} placeholder="例如：1床" />
            </div>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => void addBed()} disabled={bedSaving}>
              {bedSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              添加床号
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>房号</TableHead>
                  <TableHead>床号</TableHead>
                  <TableHead>入住人</TableHead>
                  <TableHead className="w-24">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!bedRoomId && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-sm text-slate-500">
                      请选择房号
                    </TableCell>
                  </TableRow>
                )}
                {bedRoomId && managementBeds.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-sm text-slate-500">
                      当前房间暂无床号
                    </TableCell>
                  </TableRow>
                )}
                {managementBeds.map((bed) => (
                  <TableRow key={bed.id}>
                    <TableCell>{bed.roomNo}</TableCell>
                    <TableCell className="font-medium">{bed.bedNo}</TableCell>
                    <TableCell>{display(bed.occupiedByName)}</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className={cn(
                          'inline-flex items-center gap-1 text-sm font-medium',
                          bed.occupiedRecordId ? 'cursor-not-allowed text-slate-300' : 'text-red-600 hover:text-red-700',
                        )}
                        disabled={Boolean(bed.occupiedRecordId)}
                        onClick={() => void deleteBed(bed)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        删除
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBedsOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>行政审核</DialogTitle>
            <DialogDescription>
              审核通过后才能进入办理入住环节。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {reviewTarget ? `${reviewTarget.name} / ${display(reviewTarget.department)} / ${maskPhone(reviewTarget.phone)}` : '未选择申请记录'}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                审核人姓名<span className="text-red-500">*</span>
              </label>
              <Input value={reviewerName} onChange={(event) => setReviewerName(event.target.value)} placeholder="请手动输入审核人姓名" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                房号<span className="text-red-500">*</span>
              </label>
              <Select
                value={roomNo}
                onValueChange={(value) => {
                  setRoomNo(value);
                  setBedNo('');
                }}
              >
                <SelectTrigger><SelectValue placeholder="请选择房号" /></SelectTrigger>
                <SelectContent>
                  {rooms.map((room) => (
                    <SelectItem key={room.id} value={room.roomNo}>
                      {room.roomNo}（已住 {room.occupiedCount}/{room.capacity || room.bedCount || '-'}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                床号<span className="text-red-500">*</span>
              </label>
              <Select value={bedNo} onValueChange={setBedNo} disabled={!roomNo}>
                <SelectTrigger><SelectValue placeholder={roomNo ? '请选择床号' : '请先选择房号'} /></SelectTrigger>
                <SelectContent>
                  {selectedRoomBeds.map((bed) => (
                    <SelectItem key={bed.id} value={bed.bedNo} disabled={Boolean(bed.occupiedRecordId)}>
                      {bed.bedNo}{bed.occupiedByName ? `（已入住：${bed.occupiedByName}）` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                领用钥匙数量<span className="text-red-500">*</span>
              </label>
              <Input value={keyIssued} onChange={(event) => setKeyIssued(event.target.value)} placeholder="请填写几把钥匙，例如：2把" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">审核意见</label>
              <Textarea
                value={reviewOpinion}
                onChange={(event) => setReviewOpinion(event.target.value)}
                placeholder="请输入审核意见"
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

      <Dialog open={checkInOpen} onOpenChange={setCheckInOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>办理入住</DialogTitle>
            <DialogDescription>
              填写后会进入已入住页面，并可导出住宿舍申请表。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {checkInTarget ? `${checkInTarget.name} / ${display(checkInTarget.department)} / ${maskPhone(checkInTarget.phone)}` : '未选择申请记录'}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                房号<span className="text-red-500">*</span>
              </label>
              <Select
                value={roomNo}
                onValueChange={(value) => {
                  setRoomNo(value);
                  setBedNo('');
                }}
              >
                <SelectTrigger><SelectValue placeholder="请选择房号" /></SelectTrigger>
                <SelectContent>
                  {rooms.map((room) => (
                    <SelectItem key={room.id} value={room.roomNo}>
                      {room.roomNo}（已住 {room.occupiedCount}/{room.capacity || room.bedCount || '-'}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                床号<span className="text-red-500">*</span>
              </label>
              <Select value={bedNo} onValueChange={setBedNo} disabled={!roomNo}>
                <SelectTrigger><SelectValue placeholder={roomNo ? '请选择床号' : '请先选择房号'} /></SelectTrigger>
                <SelectContent>
                  {selectedRoomBeds.map((bed) => (
                    <SelectItem key={bed.id} value={bed.bedNo} disabled={Boolean(bed.occupiedRecordId)}>
                      {bed.bedNo}{bed.occupiedByName ? `（已入住：${bed.occupiedByName}）` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  领用钥匙数量<span className="text-red-500">*</span>
                </label>
                <Input value={keyIssued} onChange={(event) => setKeyIssued(event.target.value)} placeholder="请填写几把钥匙，例如：2把" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">办理入住日期</label>
                <Input type="date" value={checkedInAt} onChange={(event) => setCheckedInAt(event.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                行政经办人<span className="text-red-500">*</span>
              </label>
              <Input value={handlerName} onChange={(event) => setHandlerName(event.target.value)} placeholder="请填写行政经办人" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckInOpen(false)} disabled={checkingIn}>
              取消
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={submitCheckIn} disabled={checkingIn}>
              {checkingIn && <Loader2 className="h-4 w-4 animate-spin" />}
              完成入住
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={checkOutOpen} onOpenChange={setCheckOutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>办理退宿舍</DialogTitle>
            <DialogDescription>
              填写退宿信息后会进入已退宿页面，并写入住宿舍申请表下半部分。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {checkOutTarget
                ? `${checkOutTarget.name} / ${display(checkOutTarget.roomBed)} / ${maskPhone(checkOutTarget.phone)}`
                : '未选择住宿记录'}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  退宿申请日期<span className="text-red-500">*</span>
                </label>
                <Input type="date" value={checkoutApplyDate} onChange={(event) => setCheckoutApplyDate(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  搬出日期<span className="text-red-500">*</span>
                </label>
                <Input type="date" value={moveOutDate} onChange={(event) => setMoveOutDate(event.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                搬出原因<span className="text-red-500">*</span>
              </label>
              <Textarea
                value={checkoutReason}
                onChange={(event) => setCheckoutReason(event.target.value)}
                placeholder="请填写退宿或搬出原因"
                className="min-h-24"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  归还钥匙数量<span className="text-red-500">*</span>
                </label>
                <Input value={keyReturned} onChange={(event) => setKeyReturned(event.target.value)} placeholder="请填写几把钥匙，例如：2把" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  行政经办人<span className="text-red-500">*</span>
                </label>
                <Input value={checkoutHandlerName} onChange={(event) => setCheckoutHandlerName(event.target.value)} placeholder="请填写行政经办人" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckOutOpen(false)} disabled={checkingOut}>
              取消
            </Button>
            <Button className="bg-slate-900 hover:bg-slate-800" onClick={submitCheckOut} disabled={checkingOut}>
              {checkingOut && <Loader2 className="h-4 w-4 animate-spin" />}
              完成退宿
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
