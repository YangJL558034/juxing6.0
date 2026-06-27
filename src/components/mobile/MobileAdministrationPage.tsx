'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DoorOpen,
  Droplets,
  Home,
  Loader2,
  PackageCheck,
  Plus,
  RefreshCcw,
  Search,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import MobileItemClaims from '@/components/mobile/MobileItemClaims';
import MobileWaterMeterManager from '@/components/mobile/MobileWaterMeterManager';
import { cn } from '@/lib/utils';
import type { DormitoryRecord, DormitoryRoom, DormitoryRoomResident, DormitoryStatus } from '@/types/dormitory';

interface DormitoryCounts {
  total: number;
  pending: number;
  reviewed: number;
  checkedIn: number;
  checkedOut: number;
}

interface DormitoryListResponse {
  success: boolean;
  records?: DormitoryRecord[];
  counts?: DormitoryCounts;
  error?: string;
}

interface RoomsResponse {
  success: boolean;
  rooms?: DormitoryRoom[];
  error?: string;
}

interface RoomResidentsResponse {
  success: boolean;
  room?: {
    id: number;
    roomNo: string;
    capacity: number;
    remark: string | null;
  };
  residents?: DormitoryRoomResident[];
  error?: string;
}

const emptyCounts: DormitoryCounts = { total: 0, pending: 0, reviewed: 0, checkedIn: 0, checkedOut: 0 };

const tabs: Array<{ status: DormitoryStatus | 'all'; label: string; countKey: keyof DormitoryCounts }> = [
  { status: 'all', label: '全部', countKey: 'total' },
  { status: '待审核', label: '待审核', countKey: 'pending' },
  { status: '已审核', label: '已审核', countKey: 'reviewed' },
  { status: '已入住', label: '已入住', countKey: 'checkedIn' },
  { status: '已退宿', label: '已退宿', countKey: 'checkedOut' },
];

const quickLinks = [
  { label: '住宿申请', key: 'dormitory', icon: Plus },
  { label: '水费登记', key: 'water', icon: Droplets },
] as const;

type MobileAdministrationSection = 'dormitory' | 'items';

function display(value?: string | number | null) {
  if (value === undefined || value === null) return '-';
  const text = String(value).trim();
  return text || '-';
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return value.includes('T') ? value.split('T')[0] : value.slice(0, 10);
}

function maskPhone(value?: string | null) {
  const phone = String(value || '').trim();
  if (phone.length < 7) return display(phone);
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

function statusTone(status?: string) {
  const text = String(status || '');
  if (text.includes('待')) return 'bg-orange-50 text-orange-700 ring-orange-200';
  if (text.includes('审核')) return 'bg-blue-50 text-blue-700 ring-blue-200';
  if (text.includes('入住')) return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  return 'bg-slate-100 text-slate-700 ring-slate-200';
}

export default function MobileAdministrationPage({ canManage = false }: { canManage?: boolean }) {
  const [activeStatus, setActiveStatus] = useState<DormitoryStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState<DormitoryRecord[]>([]);
  const [rooms, setRooms] = useState<DormitoryRoom[]>([]);
  const [counts, setCounts] = useState<DormitoryCounts>(emptyCounts);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<DormitoryRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [roomDetailOpen, setRoomDetailOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<DormitoryRoom | null>(null);
  const [roomResidents, setRoomResidents] = useState<DormitoryRoomResident[]>([]);
  const [roomDetailLoading, setRoomDetailLoading] = useState(false);
  const [roomDetailError, setRoomDetailError] = useState('');
  const [waterManagerOpen, setWaterManagerOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<MobileAdministrationSection>('dormitory');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('keyword', query.trim());
      if (activeStatus !== 'all') params.set('status', activeStatus);

      const [recordsRes, roomsRes] = await Promise.all([
        fetch(`/api/dormitory?${params.toString()}`, { cache: 'no-store' }),
        fetch('/api/dormitory/rooms', { cache: 'no-store' }),
      ]);
      const recordsData = await recordsRes.json().catch(() => ({})) as DormitoryListResponse;
      const roomsData = await roomsRes.json().catch(() => ({})) as RoomsResponse;
      if (!recordsRes.ok || !recordsData.success) throw new Error(recordsData.error || '获取住宿记录失败');
      if (!roomsRes.ok || !roomsData.success) throw new Error(roomsData.error || '获取房号失败');
      setRecords(recordsData.records || []);
      setCounts(recordsData.counts || emptyCounts);
      setRooms(roomsData.rooms || []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '获取行政数据失败');
      setRecords([]);
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStatus]);

  const roomStats = useMemo(() => {
    const totalBeds = rooms.reduce((sum, room) => sum + Number(room.bedCount || room.capacity || 0), 0);
    const occupied = rooms.reduce((sum, room) => sum + Number(room.occupiedCount || 0), 0);
    return { roomCount: rooms.length, totalBeds, occupied };
  }, [rooms]);

  const openRoomDetail = async (room: DormitoryRoom) => {
    setSelectedRoom(room);
    setRoomResidents([]);
    setRoomDetailError('');
    setRoomDetailOpen(true);
    setRoomDetailLoading(true);

    try {
      const response = await fetch(`/api/dormitory/rooms/${room.id}/residents`, { cache: 'no-store' });
      const result = await response.json().catch(() => ({})) as RoomResidentsResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '获取房间入住详情失败');
      }
      setRoomResidents(result.residents || []);
    } catch (fetchError) {
      setRoomDetailError(fetchError instanceof Error ? fetchError.message : '获取房间入住详情失败');
    } finally {
      setRoomDetailLoading(false);
    }
  };

  if (waterManagerOpen) {
    return <MobileWaterMeterManager onBack={() => setWaterManagerOpen(false)} />;
  }

  if (!canManage) {
    return <MobileItemClaims canManage={false} />;
  }

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-2 rounded-[24px] border border-slate-200 bg-white p-2 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveSection('dormitory')}
          className={cn(
            'flex h-12 items-center justify-center rounded-2xl text-sm font-semibold transition active:scale-[0.98]',
            activeSection === 'dormitory' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-slate-50 text-slate-700',
          )}
        >
          <Home className="mr-1 h-4 w-4" />
          住房申请
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('items')}
          className={cn(
            'flex h-12 items-center justify-center rounded-2xl text-sm font-semibold transition active:scale-[0.98]',
            activeSection === 'items' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-slate-50 text-slate-700',
          )}
        >
          <PackageCheck className="mr-1 h-4 w-4" />
          物品管理
        </button>
      </section>

      {activeSection === 'items' && <MobileItemClaims canManage />}

      {activeSection === 'dormitory' && (
      <>

      <section className="mobile-ios-glass rounded-[30px] p-5 text-slate-950">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-blue-600">行政管理</p>
            <h1 className="mt-1 text-2xl font-bold tracking-normal">住宿与房号</h1>
            <p className="mt-2 text-sm text-slate-600">住宿申请、入住状态、房间容量移动查看。</p>
          </div>
          <Button size="icon" variant="secondary" className="h-11 w-11 rounded-2xl border border-white/70 bg-white/[0.58] text-blue-700 shadow-sm backdrop-blur-xl hover:bg-white/75" onClick={() => void loadData()} disabled={loading}>
            <RefreshCcw className={cn('h-5 w-5', loading && 'animate-spin')} />
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="mobile-ios-tile rounded-2xl p-3">
            <div className="text-xl font-bold">{counts.pending}</div>
            <div className="mt-1 text-xs text-slate-500">待审核</div>
          </div>
          <div className="mobile-ios-tile rounded-2xl p-3">
            <div className="text-xl font-bold">{counts.checkedIn}</div>
            <div className="mt-1 text-xs text-slate-500">已入住</div>
          </div>
          <button type="button" onClick={() => setRoomsOpen(true)} className="mobile-ios-tile rounded-2xl p-3 text-left">
            <div className="text-xl font-bold">{roomStats.occupied}/{roomStats.totalBeds}</div>
            <div className="mt-1 text-xs text-slate-500">床位</div>
          </button>
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void loadData();
            }}
            placeholder="搜索姓名、手机、部门"
            className="h-12 rounded-2xl bg-slate-50 pl-9 text-base"
          />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  if (item.key === 'water') {
                    setWaterManagerOpen(true);
                    return;
                  }
                  setActiveStatus('待审核' as DormitoryStatus);
                }}
                className="flex h-12 items-center justify-center rounded-2xl border border-slate-200 text-sm font-semibold text-slate-700 transition active:scale-[0.98]"
              >
                <Icon className="mr-1 h-4 w-4" />
                {item.label}
              </button>
            );
          })}
          <Button variant="outline" className="h-12 rounded-2xl" onClick={() => setRoomsOpen(true)}>
            <Home className="mr-1 h-4 w-4" />
            房号
          </Button>
        </div>
      </section>

      <section className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.status}
            type="button"
            onClick={() => setActiveStatus(tab.status)}
            className={cn('shrink-0 rounded-full px-4 py-2 text-sm font-semibold', activeStatus === tab.status ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200')}
          >
            {tab.label} {counts[tab.countKey]}
          </button>
        ))}
      </section>

      {error && <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-semibold text-slate-950">住宿记录</h2>
          <span className="text-sm text-slate-500">{records.length} 条</span>
        </div>

        {loading && (
          <div className="rounded-[24px] border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-blue-600" />
            正在加载
          </div>
        )}

        {!loading && records.length === 0 && (
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">暂无住宿记录</div>
        )}

        {!loading && records.map((record) => (
          <article key={record.id} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm" onClick={() => { setSelectedRecord(record); setDetailOpen(true); }}>
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <UserRound className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-lg font-semibold text-slate-950">{record.name}</h3>
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ring-1', statusTone(record.status))}>{record.status}</span>
                </div>
                <p className="mt-1 truncate text-sm text-slate-500">{display(record.department)} / {display(record.position)}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs text-slate-400">手机号</div>
                <div className="mt-1 font-medium text-slate-900">{maskPhone(record.phone)}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs text-slate-400">房号床位</div>
                <div className="mt-1 font-medium text-slate-900">{record.roomBed || `${display(record.roomNo)} ${display(record.bedNo)}`}</div>
              </div>
            </div>
          </article>
        ))}
      </section>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="bottom" className="max-h-[86dvh] rounded-t-[26px] p-0">
          <SheetHeader className="border-b border-slate-100 px-4 py-4 text-left">
            <SheetTitle>{selectedRecord?.name || '住宿详情'}</SheetTitle>
            <SheetDescription>{selectedRecord ? `${display(selectedRecord.department)} / ${display(selectedRecord.status)}` : ''}</SheetDescription>
          </SheetHeader>
          {selectedRecord && (
            <div className="space-y-3 overflow-y-auto p-4">
              {[
                ['手机号', selectedRecord.phone],
                ['身份证', selectedRecord.idCard],
                ['预计入住', formatDate(selectedRecord.expectedCheckInDate)],
                ['入住原因', selectedRecord.reason],
                ['房号', selectedRecord.roomNo],
                ['床号', selectedRecord.bedNo],
                ['钥匙', selectedRecord.keyIssued],
                ['审核人', selectedRecord.reviewerName],
                ['入住办理人', selectedRecord.handlerName],
                ['入住时间', selectedRecord.checkedInAt],
                ['退宿时间', selectedRecord.checkedOutAt],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                  <span className="text-slate-500">{label}</span>
                  <span className="max-w-[58%] truncate font-medium text-slate-950">{display(value)}</span>
                </div>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={roomsOpen} onOpenChange={setRoomsOpen}>
        <SheetContent side="bottom" className="max-h-[86dvh] rounded-t-[26px] p-0">
          <SheetHeader className="border-b border-slate-100 px-4 py-4 text-left">
            <SheetTitle>房号管理</SheetTitle>
            <SheetDescription>查看房间类型、床位和入住人数。</SheetDescription>
          </SheetHeader>
          <div className="max-h-[calc(86dvh-6rem)] space-y-3 overflow-y-auto p-4">
            {rooms.map((room) => (
              <button
                key={room.id}
                type="button"
                className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition active:scale-[0.99]"
                onClick={() => void openRoomDetail(room)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DoorOpen className="h-5 w-5 text-blue-600" />
                    <span className="font-semibold text-slate-950">{room.roomNo}</span>
                  </div>
                  <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', room.isFull ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700')}>
                    {room.occupiedCount}/{room.bedCount || room.capacity}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-400">寝室类型</div>
                    <div className="mt-1 font-medium text-slate-900">{display(room.roomType)}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-400">备注</div>
                    <div className="mt-1 truncate font-medium text-slate-900">{display(room.remark)}</div>
                  </div>
                </div>
                <div className="mt-3 text-right text-xs font-medium text-blue-600">点击查看入住详情</div>
              </button>
            ))}
            {rooms.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                暂无房号
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={roomDetailOpen} onOpenChange={setRoomDetailOpen}>
        <SheetContent side="bottom" className="max-h-[86dvh] rounded-t-[26px] p-0">
          <SheetHeader className="border-b border-slate-100 px-4 py-4 text-left">
            <SheetTitle>{selectedRoom ? `${selectedRoom.roomNo} 房间详情` : '房间详情'}</SheetTitle>
            <SheetDescription>查看房间类型、床位和当前在住人员。</SheetDescription>
          </SheetHeader>
          {selectedRoom && (
            <div className="max-h-[calc(86dvh-6rem)] space-y-4 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-xs text-slate-400">寝室类型</div>
                  <div className="mt-1 font-medium text-slate-900">{display(selectedRoom.roomType)}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-xs text-slate-400">床位使用</div>
                  <div className="mt-1 font-medium text-slate-900">{selectedRoom.occupiedCount}/{selectedRoom.bedCount || selectedRoom.capacity}</div>
                </div>
                <div className="col-span-2 rounded-2xl bg-slate-50 p-3">
                  <div className="text-xs text-slate-400">备注</div>
                  <div className="mt-1 font-medium text-slate-900">{display(selectedRoom.remark)}</div>
                </div>
              </div>

              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold text-slate-950">当前在住人员</h3>
                <span className="text-sm font-semibold text-emerald-700">{roomResidents.length} 人</span>
              </div>

              {roomDetailLoading && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-blue-600" />
                  正在加载入住详情
                </div>
              )}

              {roomDetailError && (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{roomDetailError}</div>
              )}

              {!roomDetailLoading && !roomDetailError && roomResidents.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                  当前暂无人员入住
                </div>
              )}

              {!roomDetailLoading && roomResidents.map((resident) => (
                <article key={resident.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                      <UserRound className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="truncate text-base font-semibold text-slate-950">{resident.name}</h4>
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{display(resident.bedNo)}</span>
                      </div>
                      <p className="mt-1 truncate text-sm text-slate-500">{display(resident.department)} / {display(resident.position)}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <div className="text-xs text-slate-400">手机号</div>
                      <div className="mt-1 font-medium text-slate-900">{maskPhone(resident.phone)}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <div className="text-xs text-slate-400">入住时间</div>
                      <div className="mt-1 font-medium text-slate-900">{display(resident.checkedInAt)}</div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>
      </>
      )}
    </div>
  );
}
