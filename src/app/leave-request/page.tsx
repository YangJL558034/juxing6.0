'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, CheckCircle2, ClipboardList, Eraser, Loader2, Maximize2, Minimize2, PenLine, Send, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { isCompleteIdCard, isCompleteMainlandMobile, normalizeIdCard, normalizeMobile } from '@/lib/identity-validation';
import type { LeaveDuration, LeaveRequestFormData } from '@/types/leave-request';

function chinaTodayInput() {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const getPart = (type: string) => parts.find(part => part.type === type)?.value || '';
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
}

const initialForm: LeaveRequestFormData = {
  employeeId: null,
  employeeName: '',
  idCard: '',
  phone: '',
  department: '',
  position: '',
  leaveDate: chinaTodayInput(),
  leaveStartDate: chinaTodayInput(),
  leaveEndDate: chinaTodayInput(),
  duration: 'full',
  halfDayPeriod: '上午',
  leaveType: '事假',
  reason: '',
  applicantSignatureDataUrl: '',
};

interface CurrentLeaveEmployeeResponse {
  success?: boolean;
  user?: {
    name?: string;
    department?: string;
  };
  employee?: {
    id: number;
    name: string;
    idCard: string;
    phone: string;
    department: string;
    position: string;
    status: string;
  } | null;
}

function RequiredMark() {
  return <span className="ml-0.5 text-red-500">*</span>;
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-100 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-3">
        <span className="text-blue-600">{icon}</span>
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      </div>
      <div className="space-y-4 p-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
  placeholder,
  inputMode,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  maxLength?: number;
}) {
  return (
    <div className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-2">
      <label className="text-sm font-medium leading-5 text-slate-800">
        {label}
        {required && <RequiredMark />}
      </label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        className="h-11 min-w-0 rounded-md border-slate-200 text-base"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-2">
      <label className="text-sm font-medium leading-5 text-slate-800">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 min-w-0 rounded-md border border-slate-200 bg-white px-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      >
        {children}
      </select>
    </div>
  );
}

function SignaturePad({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasDrawnRef = useRef(false);
  const [expanded, setExpanded] = useState(false);

  const openExpanded = () => {
    window.alert('请把手机横过来签字，签完点“收起”。');
    setExpanded(true);
  };

  const setupCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.lineWidth = 2.4;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#0f172a';
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, rect.width, rect.height);
    if (value) {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(rect.width / image.width, rect.height / image.height);
        const drawWidth = image.width * scale;
        const drawHeight = image.height * scale;
        context.drawImage(image, (rect.width - drawWidth) / 2, (rect.height - drawHeight) / 2, drawWidth, drawHeight);
      };
      image.src = value;
      hasDrawnRef.current = true;
    }
  };

  useEffect(() => {
    setupCanvas();
    const onResize = () => setupCanvas();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setupCanvas(), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const begin = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    canvas.setPointerCapture(event.pointerId);
    const current = point(event);
    drawingRef.current = true;
    hasDrawnRef.current = true;
    context.beginPath();
    context.moveTo(current.x, current.y);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    const current = point(event);
    context.lineTo(current.x, current.y);
    context.stroke();
  };

  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas && hasDrawnRef.current) {
      onChange(canvas.toDataURL('image/png'));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const rect = canvas.getBoundingClientRect();
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, rect.width, rect.height);
    hasDrawnRef.current = false;
    onChange('');
  };

  return (
    <div className={expanded ? 'fixed inset-0 z-50 flex flex-col bg-white p-4' : 'space-y-2'}>
      <div className={expanded ? 'flex min-h-0 flex-1 flex-col' : 'space-y-2'}>
        {expanded && (
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-950">横屏签字</h3>
              <p className="text-xs text-slate-500">请横屏签字，签完点收起。</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(false)}>
              <Minimize2 className="h-4 w-4" />
              收起
            </Button>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className={`${expanded ? 'h-[52dvh] min-h-[240px]' : 'h-36'} w-full touch-none rounded-md border border-slate-200 bg-white`}
          onPointerDown={begin}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-slate-500">请在上方手写签名</p>
          <div className="flex gap-2">
            {!expanded && (
              <Button type="button" variant="outline" size="sm" onClick={openExpanded}>
                <Maximize2 className="h-4 w-4" />
                放大签字
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={clear}>
              <Eraser className="h-4 w-4" />
              清除
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LeaveRequestPage() {
  const [data, setData] = useState<LeaveRequestFormData>(initialForm);
  const [personalPrefill, setPersonalPrefill] = useState<Partial<LeaveRequestFormData>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = useMemo(() => (
    data.employeeName.trim()
    && isCompleteIdCard(data.idCard)
    && (!data.phone || isCompleteMainlandMobile(data.phone))
    && data.leaveStartDate
    && data.leaveEndDate
    && data.leaveEndDate >= data.leaveStartDate
    && (data.duration !== 'half' || data.halfDayPeriod.trim())
    && data.applicantSignatureDataUrl
  ), [data]);

  const update = <K extends keyof LeaveRequestFormData>(field: K, value: LeaveRequestFormData[K]) => {
    setData(current => ({ ...current, [field]: value }));
  };

  useEffect(() => {
    let active = true;

    const loadCurrentEmployee = async () => {
      try {
        const response = await fetch('/api/leave-requests/current-employee', {
          cache: 'no-store',
          credentials: 'include',
        });
        if (!response.ok) return;

        const result = await response.json().catch(() => ({})) as CurrentLeaveEmployeeResponse;
        if (!active || !result.success) return;

        const prefill: Partial<LeaveRequestFormData> = {
          employeeId: result.employee?.id ?? null,
          employeeName: result.employee?.name || result.user?.name || '',
          idCard: normalizeIdCard(result.employee?.idCard || ''),
          phone: normalizeMobile(result.employee?.phone || ''),
          department: result.employee?.department || result.user?.department || '',
          position: result.employee?.position || '',
        };

        setPersonalPrefill(prefill);
        setData(current => ({
          ...current,
          employeeId: current.employeeId ?? prefill.employeeId ?? null,
          employeeName: current.employeeName || prefill.employeeName || '',
          idCard: current.idCard || prefill.idCard || '',
          phone: current.phone || prefill.phone || '',
          department: current.department || prefill.department || '',
          position: current.position || prefill.position || '',
        }));
      } catch {
        // 未登录或无员工档案时保留手动填写流程。
      }
    };

    void loadCurrentEmployee();
    return () => {
      active = false;
    };
  }, []);

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      const result = await response.json().catch(() => ({})) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error || '提交失败');
      }
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
        <div className="mx-auto max-w-md rounded-lg border border-slate-100 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="mt-5 text-xl font-semibold">请假申请提交成功</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">后台已收到申请，审核通过后会同步到工资工时的打卡记录。</p>
          <Button
            className="mt-6 w-full bg-blue-600 hover:bg-blue-700"
            onClick={() => {
              const today = chinaTodayInput();
              setData({
                ...initialForm,
                ...personalPrefill,
                leaveDate: today,
                leaveStartDate: today,
                leaveEndDate: today,
                reason: '',
                applicantSignatureDataUrl: '',
              });
              setSubmitted(false);
            }}
          >
            继续填写
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-md">
          <p className="text-xs text-slate-500">移动端入口</p>
          <h1 className="text-lg font-semibold">员工请假申请</h1>
        </div>
      </div>

      <div className="mx-auto max-w-md space-y-4 px-4 py-4">
        {error && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <Section title="个人信息" icon={<UserRound className="h-4 w-4" />}>
          <Field label="姓名" required value={data.employeeName} onChange={(value) => update('employeeName', value)} placeholder="请输入姓名" />
          <Field label="身份证" required value={data.idCard} onChange={(value) => update('idCard', normalizeIdCard(value))} placeholder="请输入身份证号" inputMode="text" maxLength={18} />
          <Field label="手机号" value={data.phone} onChange={(value) => update('phone', normalizeMobile(value))} placeholder="请输入手机号" inputMode="tel" maxLength={11} />
          <Field label="部门" value={data.department} onChange={(value) => update('department', value)} placeholder="请输入部门" />
          <Field label="岗位" value={data.position} onChange={(value) => update('position', value)} placeholder="请输入岗位" />
        </Section>

        <Section title="请假信息" icon={<CalendarDays className="h-4 w-4" />}>
          <Field
            label="开始日期"
            required
            value={data.leaveStartDate}
            onChange={(value) => {
              update('leaveStartDate', value);
              update('leaveDate', value);
              if (!data.leaveEndDate || data.leaveEndDate < value) update('leaveEndDate', value);
            }}
            type="date"
          />
          <Field label="结束日期" required value={data.leaveEndDate} onChange={(value) => update('leaveEndDate', value)} type="date" />
          <SelectField
            label="时长"
            value={data.duration}
            onChange={(value) => {
              const duration = value as LeaveDuration;
              update('duration', duration);
              if (duration === 'full') update('halfDayPeriod', '');
              if (duration === 'half' && !data.halfDayPeriod) update('halfDayPeriod', '上午');
            }}
          >
            <option value="full">全天</option>
            <option value="half">半天</option>
          </SelectField>
          {data.duration === 'half' && (
            <SelectField label="时段" value={data.halfDayPeriod || '上午'} onChange={(value) => update('halfDayPeriod', value)}>
              <option value="上午">上午</option>
              <option value="下午">下午</option>
            </SelectField>
          )}
          <SelectField label="类型" value={data.leaveType} onChange={(value) => update('leaveType', value)}>
            <option value="事假">事假</option>
            <option value="病假">病假</option>
            <option value="年假">年假</option>
            <option value="调休">调休</option>
            <option value="其他">其他</option>
          </SelectField>
        </Section>

        <Section title="请假原因" icon={<ClipboardList className="h-4 w-4" />}>
          <Textarea
            value={data.reason}
            onChange={(event) => update('reason', event.target.value)}
            placeholder="请填写请假原因"
            className="min-h-32 rounded-md border-slate-200 text-base"
          />
        </Section>

        <Section title="员工签字" icon={<PenLine className="h-4 w-4" />}>
          <SignaturePad
            value={data.applicantSignatureDataUrl}
            onChange={(value) => update('applicantSignatureDataUrl', value)}
          />
        </Section>

        <div className="pb-6">
          {data.idCard && !isCompleteIdCard(data.idCard) && (
            <p className="mb-2 text-sm text-red-600">身份证必须填写完整，请输入18位身份证号。</p>
          )}
          {data.phone && !isCompleteMainlandMobile(data.phone) && (
            <p className="mb-2 text-sm text-red-600">手机号格式不正确，请输入11位手机号。</p>
          )}
          {data.leaveStartDate && data.leaveEndDate && data.leaveEndDate < data.leaveStartDate && (
            <p className="mb-2 text-sm text-red-600">结束日期不能早于开始日期。</p>
          )}
          {!data.applicantSignatureDataUrl && (
            <p className="mb-2 text-sm text-red-600">请完成员工手写签名。</p>
          )}
          <Button
            className="mobile-submit-button h-12 w-full bg-blue-600 text-base hover:bg-blue-700"
            disabled={!canSubmit || submitting}
            onClick={submit}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            提交请假申请
          </Button>
        </div>
      </div>
    </main>
  );
}
