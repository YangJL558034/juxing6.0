'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Droplets,
  Gauge,
  Home,
  Loader2,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { WaterMeterRoomOption } from '@/types/water-meter';

const today = () => new Date().toISOString().slice(0, 10);

function displayNumber(value?: number | null) {
  return value === null || value === undefined ? '-' : String(value);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function Field({
  label,
  required,
  icon,
  children,
}: {
  label: string;
  required?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
        <span className="text-blue-600">{icon}</span>
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function WaterMeterPage() {
  const [rooms, setRooms] = useState<WaterMeterRoomOption[]>([]);
  const [roomNo, setRoomNo] = useState('');
  const [readingDate, setReadingDate] = useState(today());
  const [currentReading, setCurrentReading] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [recorderName, setRecorderName] = useState('');
  const [remark, setRemark] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const selectedRoom = useMemo(() => rooms.find((room) => room.roomNo === roomNo) || null, [roomNo, rooms]);
  const currentReadingNumber = Number(currentReading);
  const unitPriceNumber = unitPrice.trim() ? Number(unitPrice) : null;
  const usageAmount = selectedRoom?.latestReading !== null && selectedRoom?.latestReading !== undefined && Number.isFinite(currentReadingNumber)
    ? round2(currentReadingNumber - selectedRoom.latestReading)
    : null;
  const feeAmount = usageAmount !== null && unitPriceNumber !== null && Number.isFinite(unitPriceNumber)
    ? round2(usageAmount * unitPriceNumber)
    : null;

  useEffect(() => {
    const loadRooms = async () => {
      setLoadingRooms(true);
      try {
        const response = await fetch('/api/water-meter/rooms', { cache: 'no-store' });
        const result = await response.json().catch(() => ({})) as {
          success?: boolean;
          rooms?: WaterMeterRoomOption[];
          error?: string;
        };

        if (!response.ok || !result.success) {
          throw new Error(result.error || '获取房号失败');
        }

        setRooms(result.rooms || []);
      } catch (error) {
        alert(error instanceof Error ? error.message : '获取房号失败');
      } finally {
        setLoadingRooms(false);
      }
    };

    void loadRooms();
  }, []);

  const resetForm = () => {
    setRoomNo('');
    setReadingDate(today());
    setCurrentReading('');
    setUnitPrice('');
    setRecorderName('');
    setRemark('');
  };

  const submit = async () => {
    if (!roomNo) {
      alert('请选择房号');
      return;
    }
    if (!readingDate) {
      alert('请选择登记日期');
      return;
    }
    if (!currentReading.trim() || !Number.isFinite(currentReadingNumber) || currentReadingNumber < 0) {
      alert('请填写正确的本次水表读数');
      return;
    }
    if (usageAmount !== null && usageAmount < 0) {
      alert(`本次读数不能小于上次读数 ${selectedRoom?.latestReading}`);
      return;
    }
    if (unitPrice.trim() && (!Number.isFinite(unitPriceNumber) || Number(unitPriceNumber) < 0)) {
      alert('请填写正确的水费单价');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/water-meter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomNo,
          readingDate,
          currentReading: currentReading.trim(),
          unitPrice: unitPrice.trim(),
          recorderName: recorderName.trim(),
          remark: remark.trim(),
        }),
      });
      const result = await response.json().catch(() => ({})) as { success?: boolean; error?: string };

      if (!response.ok || !result.success) {
        throw new Error(result.error || '提交水表登记失败');
      }

      setSubmitted(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : '提交水表登记失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <main className="min-h-dvh bg-slate-50 px-4 py-6 text-slate-950">
        <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-[430px] flex-col justify-center">
          <div className="rounded-lg border border-slate-100 bg-white px-5 py-10 text-center shadow-sm">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
              <CheckCircle2 className="h-11 w-11 text-blue-600" />
            </div>
            <h1 className="mt-6 text-xl font-semibold text-slate-950">水表登记成功</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              后台行政管理可以查看和导出本次水表记录。
            </p>
            <Button
              className="mt-8 w-full bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                resetForm();
                setSubmitted(false);
                window.location.reload();
              }}
            >
              继续添加水表
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
          <div className="flex items-center justify-center gap-2">
            <Droplets className="h-5 w-5 text-blue-600" />
            <h1 className="text-base font-semibold">水费登记</h1>
          </div>
        </header>

        <div className="p-4">
          <section className="rounded-lg border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <Gauge className="h-5 w-5 text-blue-600" />
              <h2 className="text-base font-semibold">添加水表</h2>
            </div>
            <div className="space-y-4 p-4">
              <Field label="房号" required icon={<Home className="h-4 w-4" />}>
                <Select value={roomNo} onValueChange={setRoomNo} disabled={loadingRooms || rooms.length === 0}>
                  <SelectTrigger className="h-11 text-base">
                    <SelectValue placeholder={loadingRooms ? '正在加载房号...' : '请选择房号'} />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms.map((room) => (
                      <SelectItem key={room.roomNo} value={room.roomNo}>
                        {room.roomNo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {selectedRoom && (
                <div className="grid grid-cols-2 gap-3 rounded-lg bg-blue-50 p-3 text-sm">
                  <div>
                    <p className="text-slate-500">上次读数</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">{selectedRoom.latestReadingText || displayNumber(selectedRoom.latestReading)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">上次日期</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">{selectedRoom.latestReadingDate || '-'}</p>
                  </div>
                </div>
              )}

              <Field label="登记日期" required icon={<CalendarDays className="h-4 w-4" />}>
                <Input type="date" value={readingDate} onChange={(event) => setReadingDate(event.target.value)} className="h-11 text-base" />
              </Field>

              <Field label="本次水表读数" required icon={<Gauge className="h-4 w-4" />}>
                <Input
                  value={currentReading}
                  onChange={(event) => setCurrentReading(event.target.value)}
                  placeholder="请输入当前水表读数"
                  inputMode="decimal"
                  className="h-11 text-base"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm">
                <div>
                  <p className="text-slate-500">本次用水量</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">{usageAmount === null || usageAmount < 0 ? '-' : usageAmount}</p>
                </div>
                <div>
                  <p className="text-slate-500">水费金额</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">{feeAmount === null || feeAmount < 0 ? '-' : `¥${feeAmount}`}</p>
                </div>
              </div>

              <Field label="水费单价" icon={<Droplets className="h-4 w-4" />}>
                <Input
                  value={unitPrice}
                  onChange={(event) => setUnitPrice(event.target.value)}
                  placeholder="可选，例如：4.2"
                  inputMode="decimal"
                  className="h-11 text-base"
                />
              </Field>

              <Field label="登记人" icon={<UserRound className="h-4 w-4" />}>
                <Input value={recorderName} onChange={(event) => setRecorderName(event.target.value)} placeholder="请输入登记人姓名，可选" className="h-11 text-base" />
              </Field>

              <Field label="备注" icon={<Droplets className="h-4 w-4" />}>
                <Textarea value={remark} onChange={(event) => setRemark(event.target.value)} placeholder="可选" className="min-h-24 text-base" />
              </Field>

              {!loadingRooms && rooms.length === 0 && (
                <div className="rounded-lg border border-orange-100 bg-orange-50 px-3 py-2 text-sm text-orange-700">
                  暂无房号，请先在后台行政管理里添加房号。
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-100 bg-white/95 px-4 py-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="mx-auto w-full max-w-[430px]">
          <Button className="h-12 w-full bg-blue-600 text-base hover:bg-blue-700" onClick={submit} disabled={submitting || loadingRooms || rooms.length === 0}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            添加水表
          </Button>
        </div>
      </div>
    </main>
  );
}
