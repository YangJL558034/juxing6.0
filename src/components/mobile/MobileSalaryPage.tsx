'use client';

import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import {
  Banknote,
  Building,
  CalendarDays,
  CheckCircle2,
  Clock,
  Eraser,
  Loader2,
  PenLine,
  RefreshCcw,
  Search,
  UserRound,
  Users,
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
import { cn } from '@/lib/utils';

interface Employee {
  id: number;
  name: string;
  phone: string;
  id_card?: string;
  department: string;
  position?: string;
  location?: string;
  status?: string;
  hire_date?: string;
  resign_date?: string;
  created_at: string;
}

interface MonthlyRecord {
  id: number;
  employee_id: number;
  employee_name: string;
  year: number;
  month: string;
  month_num: number;
  department: string;
  location?: string;
  normal_hours: number;
  weekday_overtime: number;
  weekend_overtime: number;
  base_salary: number;
  total_payable: number;
  deduction: number;
  actual_amount: number;
  signature?: string;
  sign_time?: string;
  signature_time?: string;
  details?: string;
  bank_account?: string;
  remark?: string;
  created_at: string;
}

type AppUser = {
  id: number;
  username: string;
  name: string;
  role: string;
  department?: string;
};

function normalizeLocation(value?: string | null): 'office' | 'workshop' {
  const text = String(value || '').trim().toLowerCase();
  return text === 'workshop' || text === '车间' ? 'workshop' : 'office';
}

function display(value?: string | number | null) {
  if (value === undefined || value === null) return '-';
  const text = String(value).trim();
  return text || '-';
}

function money(value?: number | string | null) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return '￥0';
  return `￥${numeric.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
}

function maskPhone(value?: string | null) {
  const phone = String(value || '').trim();
  if (phone.length < 7) return display(phone);
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

function isResignedEmployee(status?: string | null) {
  return String(status || '').includes('离职');
}

function currentYear() {
  return String(new Date().getFullYear());
}

function currentMonth() {
  return String(new Date().getMonth() + 1).padStart(2, '0');
}

export default function MobileSalaryPage({ canManage = false, user }: { canManage?: boolean; user?: AppUser }) {
  const [mode, setMode] = useState<'employees' | 'salary' | 'attendance'>('salary');
  const [location, setLocation] = useState<'office' | 'workshop'>('office');
  const [query, setQuery] = useState('');
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<MonthlyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<MonthlyRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedAttendanceRecord, setSelectedAttendanceRecord] = useState<MonthlyRecord | null>(null);
  const [attendanceDetailOpen, setAttendanceDetailOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeDetailOpen, setEmployeeDetailOpen] = useState(false);
  const [signTarget, setSignTarget] = useState<MonthlyRecord | null>(null);
  const [signSheetOpen, setSignSheetOpen] = useState(false);
  const [signing, setSigning] = useState(false);
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasSignatureRef = useRef(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const salaryRes = await fetch(`/api/work-hours-monthly?year=${year}&month=${Number(month)}`, { cache: 'no-store' });
      const salaryData = await salaryRes.json().catch(() => ({}));
      if (!salaryRes.ok || !salaryData.success) throw new Error(salaryData.error || '获取工资失败');
      setRecords(salaryData.data || []);
      if (canManage) {
        const employeeRes = await fetch('/api/employees', { cache: 'no-store' });
        const employeeData = await employeeRes.json().catch(() => ({}));
        if (!employeeRes.ok || !employeeData.success) throw new Error(employeeData.error || '获取员工失败');
        setEmployees(employeeData.data || []);
      } else {
        setEmployees([]);
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '获取工资工时失败');
      setEmployees([]);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [year, month, canManage]);

  useEffect(() => {
    if (!canManage && mode === 'employees') {
      setMode('salary');
    }
  }, [canManage, mode]);

  const filteredEmployees = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return employees.filter((employee) => {
      const matchesLocation = normalizeLocation(employee.location) === location;
      const matchesKeyword = !keyword || `${employee.name} ${employee.phone} ${employee.id_card} ${employee.department}`.toLowerCase().includes(keyword);
      return matchesLocation && matchesKeyword;
    });
  }, [employees, location, query]);

  const activeEmployees = useMemo(() => {
    return filteredEmployees.filter((employee) => !isResignedEmployee(employee.status));
  }, [filteredEmployees]);

  const resignedEmployees = useMemo(() => {
    return filteredEmployees.filter((employee) => isResignedEmployee(employee.status));
  }, [filteredEmployees]);

  const filteredRecords = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return records.filter((record) => {
      const matchesLocation = !canManage || normalizeLocation(record.location) === location;
      const matchesKeyword = !canManage || !keyword || `${record.employee_name} ${record.department} ${record.bank_account}`.toLowerCase().includes(keyword);
      return matchesLocation && matchesKeyword;
    });
  }, [canManage, location, query, records]);

  const salaryTotal = filteredRecords.reduce((sum, record) => sum + Number(record.actual_amount || 0), 0);
  const signedTotal = filteredRecords.filter((record) => Boolean(record.signature)).length;
  const greetingName = display(user?.name || user?.username || '员工');

  const parseAttendanceDetails = (record: MonthlyRecord): Record<string, unknown> => {
    if (!record.details) return {};
    try {
      const parsed = JSON.parse(record.details);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  };

  const getAttendanceTimes = (value: unknown) => {
    if (typeof value === 'string') {
      return value.split('\n').map((time) => time.trim()).filter(Boolean);
    }
    if (value && typeof value === 'object' && Array.isArray((value as { times?: unknown }).times)) {
      return (value as { times: unknown[] }).times.map((time) => String(time).trim()).filter(Boolean);
    }
    return [];
  };

  const getDayAttendanceTimes = (record: MonthlyRecord, day: number) => {
    const details = parseAttendanceDetails(record);
    return getAttendanceTimes(details[String(day)] ?? details[String(day).padStart(2, '0')]);
  };

  const attendanceRows = useMemo(() => {
    return filteredRecords.filter((record) => {
      const details = parseAttendanceDetails(record);
      return Object.values(details).some((value) => getAttendanceTimes(value).length > 0);
    });
  }, [filteredRecords]);

  const daysInSelectedMonth = useMemo(() => {
    const numericYear = Number(year);
    const numericMonth = Number(month);
    if (!Number.isInteger(numericYear) || !Number.isInteger(numericMonth) || numericMonth < 1 || numericMonth > 12) return 0;
    return new Date(numericYear, numericMonth, 0).getDate();
  }, [month, year]);

  const attendanceDayTotal = attendanceRows.reduce((sum, record) => {
    return sum + Array.from({ length: daysInSelectedMonth }, (_, index) => index + 1)
      .filter((day) => getDayAttendanceTimes(record, day).length > 0).length;
  }, 0);

  const attendanceTimeTotal = attendanceRows.reduce((sum, record) => {
    return sum + Array.from({ length: daysInSelectedMonth }, (_, index) => index + 1)
      .reduce((daySum, day) => daySum + getDayAttendanceTimes(record, day).length, 0);
  }, 0);

  const formatAttendanceTimes = (times: string[]) => {
    const pairs: string[] = [];
    for (let index = 0; index < times.length; index += 2) {
      pairs.push(times[index + 1] ? `${times[index]} - ${times[index + 1]}` : times[index]);
    }
    return pairs;
  };

  const listTitle = mode === 'employees'
    ? '员工列表'
    : mode === 'attendance'
      ? (canManage ? '打卡记录列表' : '我的打卡记录')
      : (canManage ? '工资列表' : '我的工资表');
  const listCount = mode === 'employees'
    ? filteredEmployees.length
    : mode === 'attendance'
      ? attendanceRows.length
      : filteredRecords.length;

  const resetSignatureCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#111827';
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = 4 * ratio;
    hasSignatureRef.current = false;
  };

  useEffect(() => {
    if (!signSheetOpen) return;
    const timer = window.setTimeout(resetSignatureCanvas, 60);
    return () => window.clearTimeout(timer);
  }, [signSheetOpen, signTarget?.id]);

  const canvasPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startSignature = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    canvas.setPointerCapture(event.pointerId);
    const point = canvasPoint(event);
    drawingRef.current = true;
    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  const drawSignature = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const context = signatureCanvasRef.current?.getContext('2d');
    if (!context) return;
    const point = canvasPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
    hasSignatureRef.current = true;
  };

  const endSignature = () => {
    drawingRef.current = false;
  };

  const openSignature = (record: MonthlyRecord) => {
    setSignTarget(record);
    setSignSheetOpen(true);
  };

  const submitSignature = async () => {
    const canvas = signatureCanvasRef.current;
    if (!signTarget || !canvas) return;
    if (!hasSignatureRef.current) {
      alert('请先手写签字');
      return;
    }

    setSigning(true);
    try {
      const response = await fetch('/api/work-hours-monthly/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: signTarget.id,
          signature: canvas.toDataURL('image/png'),
        }),
      });
      const result = await response.json().catch(() => ({})) as { success?: boolean; error?: string; record?: MonthlyRecord };
      if (!response.ok || !result.success) {
        throw new Error(result.error || '签字失败');
      }

      if (result.record) {
        setRecords((current) => current.map((record) => (record.id === result.record?.id ? result.record : record)));
        setSelectedRecord(result.record);
      } else {
        await loadData();
      }
      setSignSheetOpen(false);
      setSignTarget(null);
    } catch (signError) {
      alert(signError instanceof Error ? signError.message : '签字失败');
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="mobile-ios-glass rounded-[30px] p-5 text-slate-950">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-blue-600">工资工时</p>
            <h1 className="mt-1 text-2xl font-bold tracking-normal">你好，{greetingName}</h1>
            <p className="mt-2 text-sm text-slate-600">{canManage ? '办公室和车间分开核对，按月份查看工资和打卡。' : '按月份查看本人的工资表。'}</p>
          </div>
          <Button size="icon" variant="secondary" className="h-11 w-11 rounded-2xl border border-white/70 bg-white/[0.58] text-blue-700 shadow-sm backdrop-blur-xl hover:bg-white/75" onClick={() => void loadData()} disabled={loading}>
            <RefreshCcw className={cn('h-5 w-5', loading && 'animate-spin')} />
          </Button>
        </div>

        {mode === 'employees' ? (
          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="mobile-ios-tile rounded-2xl p-3">
              <div className="text-xl font-bold">{filteredEmployees.length}</div>
              <div className="mt-1 text-xs text-slate-500">员工总数</div>
            </div>
            <div className="mobile-ios-tile rounded-2xl p-3">
              <div className="text-xl font-bold text-emerald-700">{activeEmployees.length}</div>
              <div className="mt-1 text-xs text-slate-500">在职</div>
            </div>
            <div className="mobile-ios-tile rounded-2xl p-3">
              <div className="text-xl font-bold text-slate-700">{resignedEmployees.length}</div>
              <div className="mt-1 text-xs text-slate-500">已离职</div>
            </div>
          </div>
        ) : mode === 'attendance' ? (
          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="mobile-ios-tile rounded-2xl p-3">
              <div className="text-xl font-bold">{attendanceRows.length}</div>
              <div className="mt-1 text-xs text-slate-500">人员</div>
            </div>
            <div className="mobile-ios-tile rounded-2xl p-3">
              <div className="text-xl font-bold">{attendanceDayTotal}</div>
              <div className="mt-1 text-xs text-slate-500">打卡天</div>
            </div>
            <div className="mobile-ios-tile rounded-2xl p-3">
              <div className="text-xl font-bold">{attendanceTimeTotal}</div>
              <div className="mt-1 text-xs text-slate-500">打卡次</div>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="mobile-ios-tile rounded-2xl p-3">
              <div className="text-xl font-bold">{filteredRecords.length}</div>
              <div className="mt-1 text-xs text-slate-500">工资条</div>
            </div>
            <div className="mobile-ios-tile rounded-2xl p-3">
              <div className="text-xl font-bold">{signedTotal}</div>
              <div className="mt-1 text-xs text-slate-500">已签字</div>
            </div>
            <div className="mobile-ios-tile rounded-2xl p-3">
              <div className="truncate text-xl font-bold">{money(salaryTotal)}</div>
              <div className="mt-1 text-xs text-slate-500">实发合计</div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
        <div className={cn('grid gap-2', canManage ? 'grid-cols-3' : 'grid-cols-2')}>
          <button
            type="button"
            onClick={() => setMode('salary')}
            className={cn('rounded-2xl px-4 py-3 text-sm font-semibold', mode === 'salary' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600')}
          >
            {canManage ? '工资' : '工资表'}
          </button>
          <button
            type="button"
            onClick={() => setMode('attendance')}
            className={cn('rounded-2xl px-4 py-3 text-sm font-semibold', mode === 'attendance' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600')}
          >
            打卡记录
          </button>
          {canManage && (
            <button
              type="button"
              onClick={() => setMode('employees')}
              className={cn('rounded-2xl px-4 py-3 text-sm font-semibold', mode === 'employees' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600')}
            >
              员工
            </button>
          )}
        </div>

        {canManage && (
          <>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLocation('office')}
                className={cn('rounded-2xl px-4 py-3 text-sm font-semibold', location === 'office' ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600')}
              >
                办公室
              </button>
              <button
                type="button"
                onClick={() => setLocation('workshop')}
                className={cn('rounded-2xl px-4 py-3 text-sm font-semibold', location === 'workshop' ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600')}
              >
                车间
              </button>
            </div>
          </>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Input value={year} onChange={(event) => setYear(event.target.value)} placeholder="年份" className="h-12 rounded-2xl text-base" />
          <Input value={month} onChange={(event) => setMonth(event.target.value.padStart(2, '0'))} placeholder="月份" className="h-12 rounded-2xl text-base" />
        </div>

        {canManage && (
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名、手机、部门" className="h-12 rounded-2xl bg-slate-50 pl-9 text-base" />
          </div>
        )}
      </section>

      {error && <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-semibold text-slate-950">{listTitle}</h2>
          <span className="text-sm text-slate-500">{listCount} 条</span>
        </div>

        {loading && (
          <div className="rounded-[24px] border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-blue-600" />
            正在加载
          </div>
        )}

        {!loading && mode === 'employees' && (
          <>
            {[
              { title: '在职员工', items: activeEmployees, tone: 'text-emerald-700' },
              { title: '已离职员工', items: resignedEmployees, tone: 'text-slate-700' },
            ].map((group) => (
              <div key={group.title} className="space-y-2">
                <div className="flex items-center justify-between px-1 pt-1">
                  <h3 className="text-sm font-semibold text-slate-900">{group.title}</h3>
                  <span className={cn('text-sm font-semibold', group.tone)}>{group.items.length} 人</span>
                </div>
                {group.items.map((employee) => (
                  <article
                    key={employee.id}
                    className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm transition active:scale-[0.99]"
                    onClick={() => {
                      setSelectedEmployee(employee);
                      setEmployeeDetailOpen(true);
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                        <UserRound className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-lg font-semibold text-slate-950">{employee.name}</h3>
                        <p className="mt-1 truncate text-sm text-slate-500">{display(employee.department)} / {display(employee.position)}</p>
                      </div>
                      <span className={cn(
                        'rounded-full px-2.5 py-1 text-xs font-semibold ring-1',
                        isResignedEmployee(employee.status)
                          ? 'bg-slate-100 text-slate-700 ring-slate-200'
                          : 'bg-emerald-50 text-emerald-700 ring-emerald-200',
                      )}>
                        {display(employee.status || '在职')}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <div className="text-xs text-slate-400">手机号</div>
                        <div className="mt-1 font-medium text-slate-900">{maskPhone(employee.phone)}</div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <div className="text-xs text-slate-400">{isResignedEmployee(employee.status) ? '离职日期' : '入职日期'}</div>
                        <div className="mt-1 font-medium text-slate-900">{display(isResignedEmployee(employee.status) ? employee.resign_date : employee.hire_date)}</div>
                      </div>
                    </div>
                    <div className="mt-3 text-right text-xs font-medium text-blue-600">点击查看员工详细</div>
                  </article>
                ))}
              </div>
            ))}
          </>
        )}

        {!loading && mode === 'salary' && filteredRecords.map((record) => (
          <article key={record.id} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm" onClick={() => { setSelectedRecord(record); setDetailOpen(true); }}>
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <Banknote className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-lg font-semibold text-slate-950">{record.employee_name}</h3>
                  {record.signature ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">已签字</span>
                  ) : (
                    <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700 ring-1 ring-orange-200">未签字</span>
                  )}
                </div>
                <p className="mt-1 truncate text-sm text-slate-500">{record.year}年{record.month_num}月 / {display(record.department)}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs text-slate-400">应发</div>
                <div className="mt-1 font-semibold text-slate-900">{money(record.total_payable)}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs text-slate-400">扣款</div>
                <div className="mt-1 font-semibold text-slate-900">{money(record.deduction)}</div>
              </div>
              <div className="rounded-2xl bg-blue-50 p-3">
                <div className="text-xs text-blue-500">实发</div>
                <div className="mt-1 font-semibold text-blue-700">{money(record.actual_amount)}</div>
              </div>
            </div>
          </article>
        ))}

        {!loading && mode === 'attendance' && attendanceRows.map((record) => {
          const punchDays = Array.from({ length: daysInSelectedMonth }, (_, index) => index + 1)
            .filter((day) => getDayAttendanceTimes(record, day).length > 0);
          const punchTimes = punchDays.reduce((sum, day) => sum + getDayAttendanceTimes(record, day).length, 0);

          return (
            <article
              key={record.id}
              className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
              onClick={() => {
                setSelectedAttendanceRecord(record);
                setAttendanceDetailOpen(true);
              }}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <Clock className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-lg font-semibold text-slate-950">{record.employee_name}</h3>
                  <p className="mt-1 truncate text-sm text-slate-500">{record.year}年{record.month_num}月 / {display(record.department)}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-xs text-slate-400">打卡天</div>
                  <div className="mt-1 font-semibold text-slate-900">{punchDays.length}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-xs text-slate-400">打卡次</div>
                  <div className="mt-1 font-semibold text-slate-900">{punchTimes}</div>
                </div>
                <div className="rounded-2xl bg-blue-50 p-3">
                  <div className="text-xs text-blue-500">查看</div>
                  <div className="mt-1 font-semibold text-blue-700">明细</div>
                </div>
              </div>
            </article>
          );
        })}

        {!loading && ((mode === 'salary' && filteredRecords.length === 0) || (mode === 'employees' && filteredEmployees.length === 0) || (mode === 'attendance' && attendanceRows.length === 0)) && (
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">暂无数据</div>
        )}
      </section>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="bottom" className="max-h-[86dvh] rounded-t-[26px] p-0">
          <SheetHeader className="border-b border-slate-100 px-4 py-4 text-left">
            <SheetTitle>{selectedRecord?.employee_name || '工资明细'}</SheetTitle>
            <SheetDescription>{selectedRecord ? `${selectedRecord.year}年${selectedRecord.month_num}月工资` : ''}</SheetDescription>
          </SheetHeader>
          {selectedRecord && (
            <div className="space-y-3 overflow-y-auto p-4">
              {[
                ['位置', normalizeLocation(selectedRecord.location) === 'office' ? '办公室' : '车间'],
                ['部门', selectedRecord.department],
                ['底薪', money(selectedRecord.base_salary)],
                ['正常工时', `${selectedRecord.normal_hours || 0}`],
                ['平时加班', `${selectedRecord.weekday_overtime || 0}`],
                ['周末加班', `${selectedRecord.weekend_overtime || 0}`],
                ['应发工资', money(selectedRecord.total_payable)],
                ['扣款', money(selectedRecord.deduction)],
                ['实发工资', money(selectedRecord.actual_amount)],
                ['签字状态', selectedRecord.signature ? '已签字' : '未签字'],
                ['签字时间', selectedRecord.sign_time || selectedRecord.signature_time],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                  <span className="flex items-center gap-2 text-slate-500">
                    {label === '位置' ? <Building className="h-4 w-4" /> : label === '签字状态' ? <CheckCircle2 className="h-4 w-4" /> : label === '正常工时' ? <Clock className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
                    {label}
                  </span>
                  <span className="max-w-[55%] truncate font-medium text-slate-950">{display(value)}</span>
                </div>
              ))}

              {selectedRecord.signature ? (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <div className="mb-2 text-sm font-semibold text-emerald-800">员工签字</div>
                  <img src={selectedRecord.signature} alt="员工签字" className="h-20 max-w-full rounded-xl border border-emerald-100 bg-white object-contain" />
                </div>
              ) : (
                <Button className="h-12 w-full rounded-2xl bg-blue-600 text-base" onClick={() => openSignature(selectedRecord)}>
                  <PenLine className="mr-2 h-5 w-5" />
                  签字确认
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={attendanceDetailOpen} onOpenChange={setAttendanceDetailOpen}>
        <SheetContent side="bottom" className="max-h-[86dvh] rounded-t-[26px] p-0">
          <SheetHeader className="border-b border-slate-100 px-4 py-4 text-left">
            <SheetTitle>{selectedAttendanceRecord?.employee_name || '打卡记录'}</SheetTitle>
            <SheetDescription>{selectedAttendanceRecord ? `${selectedAttendanceRecord.year}年${selectedAttendanceRecord.month_num}月打卡记录` : ''}</SheetDescription>
          </SheetHeader>
          {selectedAttendanceRecord && (
            <div className="space-y-3 overflow-y-auto p-4">
              {Array.from({ length: daysInSelectedMonth }, (_, index) => index + 1)
                .map((day) => ({ day, times: getDayAttendanceTimes(selectedAttendanceRecord, day) }))
                .filter((item) => item.times.length > 0)
                .map((item) => (
                  <div key={item.day} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 font-semibold text-slate-950">
                        <CalendarDays className="h-4 w-4 text-blue-600" />
                        {selectedAttendanceRecord.year}-{String(selectedAttendanceRecord.month_num).padStart(2, '0')}-{String(item.day).padStart(2, '0')}
                      </div>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{item.times.length} 次</span>
                    </div>
                    <div className="space-y-2">
                      {formatAttendanceTimes(item.times).map((timeText, index) => (
                        <div key={`${item.day}-${index}`} className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
                          {timeText}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={signSheetOpen} onOpenChange={setSignSheetOpen}>
        <SheetContent side="bottom" className="max-h-[92dvh] rounded-t-[26px] p-0">
          <SheetHeader className="border-b border-slate-100 px-4 py-4 text-left">
            <SheetTitle>工资签字确认</SheetTitle>
            <SheetDescription>{signTarget ? `${signTarget.employee_name} / ${signTarget.year}年${signTarget.month_num}月` : '请在下方手写签字'}</SheetDescription>
          </SheetHeader>
          <div className="space-y-3 p-4">
            <canvas
              ref={signatureCanvasRef}
              className="h-56 w-full touch-none rounded-2xl border border-dashed border-slate-300 bg-white"
              onPointerDown={startSignature}
              onPointerMove={drawSignature}
              onPointerUp={endSignature}
              onPointerCancel={endSignature}
              onPointerLeave={endSignature}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="h-12 rounded-2xl" onClick={resetSignatureCanvas} disabled={signing}>
                <Eraser className="mr-2 h-4 w-4" />
                清除
              </Button>
              <Button type="button" className="h-12 rounded-2xl bg-blue-600" onClick={() => void submitSignature()} disabled={signing}>
                {signing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PenLine className="mr-2 h-4 w-4" />}
                确认签字
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={employeeDetailOpen} onOpenChange={setEmployeeDetailOpen}>
        <SheetContent side="bottom" className="max-h-[86dvh] rounded-t-[26px] p-0">
          <SheetHeader className="border-b border-slate-100 px-4 py-4 text-left">
            <SheetTitle>{selectedEmployee?.name || '员工详细'}</SheetTitle>
            <SheetDescription>{selectedEmployee ? `${display(selectedEmployee.department)} / ${display(selectedEmployee.position)}` : ''}</SheetDescription>
          </SheetHeader>
          {selectedEmployee && (
            <div className="space-y-3 overflow-y-auto p-4">
              {[
                ['姓名', selectedEmployee.name],
                ['状态', selectedEmployee.status || '在职'],
                ['位置', normalizeLocation(selectedEmployee.location) === 'office' ? '办公室' : '车间'],
                ['部门', selectedEmployee.department],
                ['岗位', selectedEmployee.position],
                ['手机号', selectedEmployee.phone],
                ['身份证号', selectedEmployee.id_card],
                ['入职日期', selectedEmployee.hire_date],
                ['离职日期', selectedEmployee.resign_date],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                  <span className="shrink-0 text-slate-500">{label}</span>
                  <span className="min-w-0 break-all text-right font-medium text-slate-950">{display(value)}</span>
                </div>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
