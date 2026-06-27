'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Clock, Search, Download, Calendar, Users, ExternalLink, Copy, Plus, Trash2, Phone, User, Building, Upload, FileSpreadsheet, Check, UserCog, Edit, Pencil, FileDown, ChevronDown, ChevronUp, PenTool, RefreshCw } from 'lucide-react';
import { WorkHoursImport } from './WorkHoursImport';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { chinaToday, formatChinaDateTime } from '@/lib/china-time';
import { formatAttendanceLeaveLabel, isDateInLeaveRange, isLeaveRangeOverlappingMonth } from '@/lib/leave-records';
import type { LeaveRequestRecord } from '@/types/leave-request';

interface SalaryRecord {
  id: number;
  month: string;
  baseSalary: number;
  overtimeHours: number;
  overtimePay: number;
  bonus: number;
  deduction: number;
  totalSalary: number;
  status: string;
}

interface WorkHourRecord {
  id: number;
  date: string;
  checkIn: string;
  checkOut: string;
  workHours: number;
  overtimeHours: number;
  status: string;
}

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
  total_days: number;
  department: string;
  location?: string;
  normal_hours: number;
  weekday_overtime: number;
  weekend_overtime: number;
  base_salary: number;
  normal_pay: number;
  weekday_overtime_pay: number;
  weekend_overtime_pay: number;
  total_payable: number;
  deduction: number;
  actual_amount: number;
  signature?: string;
  // 完整工资条字段
  is_full_attendance?: string;
  id_card?: string;
  bank_name?: string;
  performance_allowance?: number;
  other_subsidy_base?: number;
  required_hours?: number;
  full_attendance_hours?: number;
  holiday_overtime_hours?: number;
  night_shift_days?: number;
  absent_days?: number;
  personal_leave_hours?: number;
  sick_leave_hours?: number;
  late_early_minutes?: number;
  late_early_count?: number;
  sign_card_count?: number;
  evaluation_coefficient?: number;
  performance_pay?: number;
  sick_pay?: number;
  living_subsidy?: number;
  other_pay?: number;
  seniority_award?: number;
  full_attendance_award?: number;
  position_subsidy?: number;
  work_reward?: number;
  spring_festival_subsidy?: number;
  social_security_subsidy?: number;
  deduct_social_security?: number;
  deduct_loan?: number;
  deduct_urgent?: number;
  deduct_other?: number;
  deduct_utilities?: number;
  total_deduction?: number;
  sign_time?: string;
  signature_time?: string;
  details?: string;
  created_at: string;
  // 办公室工资条字段
  hire_date?: string;
  employee_code?: string;
  should_attend_days?: number;
  saturday_days?: number;
  actual_attend_days?: number;
  paid_leave_days?: number;
  holiday_overtime?: number;
  holiday_pay?: number;
  holiday_overtime_pay?: number;
  performance_bonus?: number;
  meal_subsidy?: number;
  housing_subsidy?: number;
  transport_subsidy?: number;
  other_subsidy?: number;
  fine?: number;
  other_deduction?: number;
  housing_fund?: number;
  social_insurance?: number;
  social_pension_adj?: number;
  pre_tax_salary?: number;
  income_tax?: number;
  bank_account?: string;
  remark?: string;
}

interface ImportedSalaryRecord {
  name: string;
  normalHours?: number;
  weekdayOvertime?: number;
  weekendOvertime?: number;
  baseSalary?: number;
  normalPay?: number;
  weekdayOvertimePay?: number;
  weekendOvertimePay?: number;
  totalPayable?: number;
  totalDeduction?: number;
  actualAmount?: number;
}

interface ImportedWorkHoursEmployee {
  name: string;
  normalWork: number;
  weekdayOvertime: number;
  weekendOvertime: number;
}

interface LeaveRequestListResponse {
  success?: boolean;
  records?: LeaveRequestRecord[];
  error?: string;
}

export type SalarySectionKey = 'employees' | 'salary' | 'workhours' | 'attendance';

interface SalaryPageProps {
  section?: SalarySectionKey;
}

function normalizeLocation(value?: string | null): 'office' | 'workshop' {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'workshop' || normalized === '车间' ? 'workshop' : 'office';
}

function matchesRecordLocation(record: MonthlyRecord, location: 'office' | 'workshop') {
  return normalizeLocation(record.location) === location;
}

function formatSalaryValue(value?: number | string | null) {
  const numericValue = Number(value ?? 0);
  if (!Number.isFinite(numericValue)) {
    return String(value ?? '');
  }

  return Number.isInteger(numericValue)
    ? String(numericValue)
    : String(Number(numericValue.toFixed(2)));
}

function formatSalaryMoney(value?: number | string | null) {
  return `¥${formatSalaryValue(value)}`;
}

export default function SalaryPage({ section = 'salary' }: SalaryPageProps) {
  const [activeTab, setActiveTab] = useState<SalarySectionKey>(section);
  const [searchMonth, setSearchMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [searchYear, setSearchYear] = useState(new Date().getFullYear().toString());
  // 每个标签页独立的位置状态
  const [employeeLocation, setEmployeeLocation] = useState<'office' | 'workshop'>('office');
  const [salaryLocation, setSalaryLocation] = useState<'office' | 'workshop'>('office');
  const [workhoursLocation, setWorkhoursLocation] = useState<'office' | 'workshop'>('office');
  const [attendanceLocation, setAttendanceLocation] = useState<'office' | 'workshop'>('office');
  const [showEmployeeQueryDialog, setShowEmployeeQueryDialog] = useState(false);
  const [showCreateEmployeeDialog, setShowCreateEmployeeDialog] = useState(false);
  const [showEmployeeImportDialog, setShowEmployeeImportDialog] = useState(false);
  const [employeeImporting, setEmployeeImporting] = useState(false);
  const [employeeImportLocation, setEmployeeImportLocation] = useState<'office' | 'workshop'>('workshop');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [newEmployee, setNewEmployee] = useState({ name: '', phone: '', id_card: '', department: '', location: 'workshop' as 'office' | 'workshop', hire_date: '' });
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showEditEmployeeDialog, setShowEditEmployeeDialog] = useState(false);
  const [editFormData, setEditFormData] = useState({ name: '', phone: '', id_card: '', department: '', location: 'workshop' as string, status: '在职', hire_date: '' });
  const [monthlyRecords, setMonthlyRecords] = useState<MonthlyRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestRecord[]>([]);
  const [editingSalaryRecord, setEditingSalaryRecord] = useState<MonthlyRecord | null>(null);
  const [showAddSalaryDialog, setShowAddSalaryDialog] = useState(false);
  const [newSalaryData, setNewSalaryData] = useState({
    employee_id: '',
    employee_name: '',
    location: '',
    base_salary: 0,
    normal_full_days: 0,
    actual_normal_days: 0,
    weekday_overtime_days: 0,
    weekend_overtime_days: 0,
    weekday_overtime_pay: 0,
    weekend_overtime_pay: 0,
    living_subsidy: 0,
    seniority_award: 0,
    full_attendance_award: 0,
    position_subsidy: 0,
    social_security_subsidy: 0,
    total_payable: 0,
    deduct_social_security: 0,
    deduct_utilities: 0,
    total_deduction: 0,
    actual_amount: 0,
  });
  const [showEditSalaryDialog, setShowEditSalaryDialog] = useState(false);

  useEffect(() => {
    setActiveTab(section);
  }, [section]);
  
  // 签字图片查看状态
  const [viewingSignature, setViewingSignature] = useState<{ signature: string; employeeName: string; signTime?: string } | null>(null);
  
  // 工时记录相关状态
  const [workhoursEmployeeId, setWorkhoursEmployeeId] = useState<string>('all');
  
  // 计算工时的函数
  const calculateWorkHours = (times: string[], isWeekend: boolean = false) => {
    if (!times || times.length === 0) return { normalHours: 0, overtimeHours: 0, firstTime: '', lastTime: '' };
    
    // 解析时间字符串为分钟数
    const parseTime = (timeStr: string) => {
      const parts = timeStr.match(/(\d{1,2}):(\d{2})/);
      if (!parts) return null;
      return parseInt(parts[1]) * 60 + parseInt(parts[2]);
    };
    
    // 过滤并解析有效时间
    const validTimes = times
      .map(t => t.replace(/[（(].*?[）)]/g, '').trim()) // 移除备注
      .filter(t => /^\d{1,2}:\d{2}$/.test(t))
      .map(t => parseTime(t))
      .filter(t => t !== null) as number[];
    
    if (validTimes.length === 0) return { normalHours: 0, overtimeHours: 0, firstTime: '', lastTime: '' };
    
    validTimes.sort((a, b) => a - b);
    const firstTime = validTimes[0];
    const lastTime = validTimes[validTimes.length - 1];
    
    // 时间点定义（分钟数）
    const WORK_START = 8 * 60;        // 8:00
    const LUNCH_START = 12 * 60;      // 12:00
    const LUNCH_END = 13.5 * 60;      // 13:30
    const WORK_END = 17.5 * 60;       // 17:30
    const DINNER_END = 18 * 60;       // 18:00
    
    // 周末全部算加班
    if (isWeekend) {
      // 周末：所有打卡时间都算加班
      const overtimeMinutes = lastTime - firstTime;
      const overtimeHours = Math.round(overtimeMinutes / 60 * 10) / 10;
      const firstTimeStr = `${Math.floor(firstTime / 60).toString().padStart(2, '0')}:${(firstTime % 60).toString().padStart(2, '0')}`;
      const lastTimeStr = `${Math.floor(lastTime / 60).toString().padStart(2, '0')}:${(lastTime % 60).toString().padStart(2, '0')}`;
      return { normalHours: 0, overtimeHours, firstTime: firstTimeStr, lastTime: lastTimeStr };
    }
    
    // 计算正班工时（8:00-12:00 + 13:30-17:30）
    let normalMinutes = 0;
    const normalStart = Math.max(firstTime, WORK_START);
    const normalEnd = Math.min(lastTime, WORK_END);
    
    if (normalEnd > normalStart) {
      // 上午工时
      const morningStart = normalStart;
      const morningEnd = Math.min(normalEnd, LUNCH_START);
      if (morningEnd > morningStart) {
        normalMinutes += morningEnd - morningStart;
      }
      // 下午工时
      const afternoonStart = Math.max(normalStart, LUNCH_END);
      const afternoonEnd = normalEnd;
      if (afternoonEnd > afternoonStart) {
        normalMinutes += afternoonEnd - afternoonStart;
      }
    }
    
    // 计算加班工时（18:00以后）
    let overtimeMinutes = 0;
    if (lastTime > DINNER_END) {
      overtimeMinutes = lastTime - DINNER_END;
    }
    
    // 转换为小时（保留1位小数）
    const normalHours = Math.round(normalMinutes / 60 * 10) / 10;
    const overtimeHours = Math.round(overtimeMinutes / 60 * 10) / 10;
    
    // 格式化时间显示
    const formatTime = (minutes: number) => {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };
    
    return {
      normalHours,
      overtimeHours,
      firstTime: formatTime(firstTime),
      lastTime: formatTime(lastTime)
    };
  };

  const parseAttendanceDetails = (record: MonthlyRecord): Record<string, unknown> => {
    if (!record.details) return {};
    try {
      const parsed = JSON.parse(record.details);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  const getAttendanceTimes = (value: unknown) => {
    if (typeof value === 'string') {
      return value.split('\n').filter(t => t.trim());
    }
    if (value && typeof value === 'object' && Array.isArray((value as { times?: unknown }).times)) {
      return ((value as { times: unknown[] }).times)
        .map(t => String(t))
        .filter(t => t.trim());
    }
    return [];
  };

  const hasAttendancePunchDetails = (record: MonthlyRecord) => {
    const details = parseAttendanceDetails(record);
    return Object.values(details).some(value =>
      getAttendanceTimes(value).some(time => /\d{1,2}:\d{2}/.test(time))
    );
  };

  const calculateAttendanceRecordSummary = (record: MonthlyRecord) => {
    const details = parseAttendanceDetails(record);
    let normalHours = 0;
    let overtimeHours = 0;

    Object.entries(details).forEach(([day, value]) => {
      const dayNumber = parseInt(day, 10);
      if (!dayNumber) return;
      const date = new Date(record.year, record.month_num - 1, dayNumber);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const calculated = calculateWorkHours(getAttendanceTimes(value), isWeekend);
      normalHours += calculated.normalHours;
      overtimeHours += calculated.overtimeHours;
    });

    return { normalHours, overtimeHours };
  };

  const findEmployeeForLeave = (leave: LeaveRequestRecord) => {
    if (leave.employeeId) {
      const byId = employees.find(employee => employee.id === leave.employeeId);
      if (byId) return byId;
    }
    if (leave.idCard) {
      const byIdCard = employees.find(employee => employee.id_card && employee.id_card === leave.idCard);
      if (byIdCard) return byIdCard;
    }
    return employees.find(employee =>
      employee.name === leave.employeeName
      && (!leave.department || employee.department === leave.department)
    ) || null;
  };

  const leaveMatchesRecord = (leave: LeaveRequestRecord, record: MonthlyRecord) => {
    if (leave.employeeId && leave.employeeId === record.employee_id) return true;
    if (leave.idCard && record.id_card && leave.idCard === record.id_card) return true;
    return leave.employeeName === record.employee_name
      && (!leave.department || !record.department || leave.department === record.department);
  };

  const getLeaveRequestsForRecordDate = (record: MonthlyRecord, date: string) => leaveRequests.filter(leave =>
    leave.status === '已审核'
    && isDateInLeaveRange(leave, date)
    && leaveMatchesRecord(leave, record)
  );

  const hasLeaveForRecordInMonth = (record: MonthlyRecord, year: number, month: number) => leaveRequests.some(leave => {
    if (leave.status !== '已审核' || !isLeaveRangeOverlappingMonth(leave, year, month)) {
      return false;
    }
    return leaveMatchesRecord(leave, record);
  });

  const createLeaveOnlyAttendanceRow = (leave: LeaveRequestRecord, year: number, month: number): MonthlyRecord => {
    const employee = findEmployeeForLeave(leave);
    const location = normalizeLocation(employee?.location || (leave.department.includes('车间') ? 'workshop' : 'office'));
    return {
      id: -leave.id,
      employee_id: leave.employeeId || employee?.id || -leave.id,
      employee_name: leave.employeeName,
      year,
      month: String(month).padStart(2, '0'),
      month_num: month,
      total_days: new Date(year, month, 0).getDate(),
      department: leave.department || employee?.department || '',
      location,
      normal_hours: 0,
      weekday_overtime: 0,
      weekend_overtime: 0,
      base_salary: 0,
      normal_pay: 0,
      weekday_overtime_pay: 0,
      weekend_overtime_pay: 0,
      total_payable: 0,
      deduction: 0,
      actual_amount: 0,
      id_card: leave.idCard || employee?.id_card || '',
      created_at: leave.createdAt,
      details: '{}',
    };
  };

  const getAttendanceRows = (year: number, month: number, location: 'office' | 'workshop') => {
    const baseRows = monthlyRecords.filter(record => {
      if (record.year !== year || record.month_num !== month) return false;
      if (!matchesRecordLocation(record, location)) return false;
      return hasAttendancePunchDetails(record) || hasLeaveForRecordInMonth(record, year, month);
    });

    const matchedLeaveIds = new Set<number>();
    baseRows.forEach(record => {
      leaveRequests.forEach(leave => {
        if (leave.status === '已审核' && isLeaveRangeOverlappingMonth(leave, year, month) && leaveMatchesRecord(leave, record)) {
          matchedLeaveIds.add(leave.id);
        }
      });
    });

    const seenLeaveOnlyEmployees = new Set<string>();
    const leaveOnlyRows = leaveRequests
      .filter(leave => leave.status === '已审核' && isLeaveRangeOverlappingMonth(leave, year, month) && !matchedLeaveIds.has(leave.id))
      .map(leave => ({ leave, employee: findEmployeeForLeave(leave) }))
      .filter(({ leave, employee }) => {
        const leaveLocation = normalizeLocation(employee?.location || (leave.department.includes('车间') ? 'workshop' : 'office'));
        if (leaveLocation !== location) return false;
        const key = leave.employeeId
          ? `id:${leave.employeeId}`
          : leave.idCard
            ? `card:${leave.idCard}`
            : `name:${leave.employeeName}:${leave.department}`;
        if (seenLeaveOnlyEmployees.has(key)) return false;
        seenLeaveOnlyEmployees.add(key);
        return true;
      })
      .map(({ leave }) => createLeaveOnlyAttendanceRow(leave, year, month));

    return [...baseRows, ...leaveOnlyRows];
  };
  
  // 计算员工工时明细
  const calculateEmployeeWorkHours = (employeeId: number, year: number, month: number) => {
    const record = monthlyRecords.find(r => 
      r.employee_id === employeeId && 
      r.year === year && 
      r.month_num === month
    );
    
    if (!record || !record.details) return [];
    
    const details = JSON.parse(record.details);
    const daysInMonth = new Date(year, month, 0).getDate();
    const result: {
      date: string;
      dayOfWeek: string;
      times: string[];
      normalHours: number;
      overtimeHours: number;
      firstTime: string;
      lastTime: string;
    }[] = [];
    
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = day.toString();
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const date = new Date(dateStr);
      const dayOfWeek = dayNames[date.getDay()];
      
      const times = details[dayStr] ? details[dayStr].split('\n').filter((t: string) => t.trim()) : [];
      const { normalHours, overtimeHours, firstTime, lastTime } = calculateWorkHours(times);
      
      result.push({
        date: dateStr,
        dayOfWeek,
        times,
        normalHours,
        overtimeHours,
        firstTime,
        lastTime
      });
    }
    
    return result;
  };
  // 打卡记录编辑状态
  const [editingAttendance, setEditingAttendance] = useState<{
    employeeId: number;
    employeeName: string;
    date: string;
    day: number;
    existingTimes: string[];
  } | null>(null);
  const [showAttendanceEditDialog, setShowAttendanceEditDialog] = useState(false);
  const [newAttendanceTime, setNewAttendanceTime] = useState('');
  const [newAttendanceNote, setNewAttendanceNote] = useState('');
  
  // 工时明细状态
  const [selectedEmployeeForWorkhours, setSelectedEmployeeForWorkhours] = useState<number | null>(null);
  const [workhoursDetailYear, setWorkhoursDetailYear] = useState(new Date().getFullYear().toString());
  const [workhoursDetailMonth, setWorkhoursDetailMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  
  // 计算员工月度工时明细
  const calculateEmployeeWorkhoursDetail = (employeeId: number, year: number, month: number) => {
    const records = monthlyRecords.filter(r => 
      r.employee_id === employeeId && 
      r.year === year && 
      r.month_num === month
    );
    
    if (records.length === 0) return [];
    
    const details: {
      date: string;
      day: number;
      weekday: string;
      firstTime: string;
      lastTime: string;
      normalHours: number;
      overtimeHours: number;
      totalHours: number;
    }[] = [];
    
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const daysInMonth = new Date(year, month, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dateObj = new Date(year, month - 1, day);
      const weekday = weekdays[dateObj.getDay()];
      
      // 从所有记录的 details 中获取该天的打卡时间
      let dayTimes: string[] = [];
      records.forEach(record => {
        if (record.details) {
          try {
            const details = JSON.parse(record.details);
            const times = details[String(day)];
            if (times) {
              dayTimes = times.split('\n').filter((t: string) => t.trim());
            }
          } catch (e) {}
        }
      });
      
      const { normalHours, overtimeHours, firstTime, lastTime } = calculateWorkHours(dayTimes);
      
      if (dayTimes.length > 0) {
        details.push({
          date,
          day,
          weekday,
          firstTime,
          lastTime,
          normalHours,
          overtimeHours,
          totalHours: normalHours + overtimeHours
        });
      }
    }
    
    return details;
  };
  
  // 获取员工查询页面地址
  const employeeQueryUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/employee-query` 
    : '/employee-query';
    
  const handleCopyUrl = () => {
    navigator.clipboard.writeText(employeeQueryUrl);
    alert('链接已复制到剪贴板');
  };
  
  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees');
      const data = await response.json();
      if (data.success) {
        setEmployees(data.data || []);
      }
    } catch (error) {
      console.error('获取员工列表失败:', error);
    }
  };
  
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchMonthlyRecords = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/work-hours-monthly');
      const data = await response.json();
      if (data.success) {
        setMonthlyRecords(data.data || []);
      }
    } catch (error) {
      console.error('获取月度工时记录失败:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      const response = await fetch('/api/leave-requests?approved=1', { cache: 'no-store' });
      const data = await response.json().catch(() => ({})) as LeaveRequestListResponse;
      if (response.ok && data.success) {
        setLeaveRequests(data.records || []);
      }
    } catch (error) {
      console.error('获取请假申请失败:', error);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchMonthlyRecords();
    fetchLeaveRequests();
  }, []);

  // 自动刷新 - 每10秒更新一次工资工时数据
  const { refreshNow } = useAutoRefresh({
    enabled: true,
    interval: 10000,
    onRefresh: () => {
      fetchEmployees();
      fetchMonthlyRecords();
      fetchLeaveRequests();
    },
  });

  // 打开打卡记录编辑对话框
  const openAttendanceEdit = (employeeId: number, employeeName: string, year: number, month: number, day: number, existingTimes: string[]) => {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setEditingAttendance({
      employeeId,
      employeeName,
      date,
      day,
      existingTimes
    });
    setNewAttendanceTime('');
    setNewAttendanceNote('');
    setShowAttendanceEditDialog(true);
  };
  
  // 提交打卡记录修改
  const submitAttendanceEdit = async () => {
    if (!editingAttendance || !newAttendanceTime) {
      alert('请输入打卡时间');
      return;
    }
    
    // 检查是否有备注（修改或添加新打卡都需要备注）
    if (!newAttendanceNote.trim()) {
      alert('请填写备注（如：漏卡补卡、请假等）');
      return;
    }
    
    try {
      const response = await fetch('/api/attendance-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: editingAttendance.employeeId,
          employeeName: editingAttendance.employeeName,
          date: editingAttendance.date,
          time: newAttendanceTime,
          note: newAttendanceNote,
          action: 'modify'
        })
      });
      
      const data = await response.json();
      if (data.success) {
        alert('打卡记录已更新');
        setShowAttendanceEditDialog(false);
        fetchMonthlyRecords();
      } else {
        alert(data.error || '更新失败');
      }
    } catch (error) {
      console.error('更新打卡记录失败:', error);
      alert('更新失败');
    }
  };
  
  // 删除打卡记录
  const deleteAttendanceTime = async (time: string) => {
    if (!editingAttendance) return;
    
    const timePart = time.split('（')[0].trim();
    
    if (!confirm(`确定要删除打卡时间 ${timePart} 吗？`)) return;
    
    try {
      const response = await fetch(`/api/attendance-records?employeeId=${editingAttendance.employeeId}&date=${editingAttendance.date}&time=${encodeURIComponent(timePart)}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      if (data.success) {
        alert('打卡记录已删除');
        setShowAttendanceEditDialog(false);
        fetchMonthlyRecords();
      } else {
        alert(data.error || '删除失败');
      }
    } catch (error) {
      console.error('删除打卡记录失败:', error);
      alert('删除失败');
    }
  };
  
  // 创建员工
  const handleCreateEmployee = async () => {
    if (!newEmployee.name || !newEmployee.id_card || !newEmployee.department) {
      alert('请填写姓名、身份证和部门');
      return;
    }
    
    try {
      const response = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEmployee)
      });
      const data = await response.json();
      if (data.success) {
        alert('员工创建成功');
        setShowCreateEmployeeDialog(false);
        setNewEmployee({ name: '', phone: '', id_card: '', department: '', location: 'workshop', hire_date: '' });
        fetchEmployees();
      } else {
        alert(data.error || '创建失败');
      }
    } catch (error) {
      alert('创建失败');
    }
  };
  
  // 删除员工
  const handleDeleteEmployee = async (id: number) => {
    if (!confirm('确定要删除该员工吗？')) return;
    
    try {
      const response = await fetch(`/api/employees/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        fetchEmployees();
      } else {
        alert(data.error || '删除失败');
      }
    } catch (error) {
      alert('删除失败');
    }
  };
  
  // 导出员工列表
  const handleExportEmployees = () => {
    const filteredEmployees = employees.filter(emp => {
      const empLocation = normalizeLocation(emp.location);
      return empLocation === employeeLocation;
    });
    
    const headers = ['姓名', '手机号', '身份证号', '部门', '位置', '状态'];
    const rows = filteredEmployees.map(emp => [
      emp.name,
      emp.phone || '',
      emp.id_card || '',
      emp.department || '',
      emp.location || '',
      emp.status || '在职'
    ]);
    
    const csvContent = '\uFEFF' + [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `员工列表_${employeeLocation === 'office' ? '办公室' : '车间'}_${chinaToday()}.csv`;
    link.click();
  };

  // 导出工资明细
  const handleExportSalary = () => {
    const filteredRecords = monthlyRecords
      .filter(r => searchMonth === 'all' || r.month_num === parseInt(searchMonth))
      .filter(r => r.year === parseInt(searchYear))
      .filter(r => {
        const recordLocation = r.location === '办公室' || r.location === 'office' ? 'office' : 'workshop';
        return recordLocation === salaryLocation;
      });
    
    const headers = salaryLocation === 'workshop'
      ? [
          '月份', '姓名', '是否全勤', '底薪', '绩效津贴', '其他补贴', '应出勤小时', '正班满勤小时',
          '正班小时', '平时加班小时', '周末加班小时', '法定节假加班小时', '夜班（天）', '旷工', '事假（H）', '病假（H）',
          '迟到早退(分)', '迟到早退(次)', '签卡次数', '考核评价系数',
          '实际正班出勤工资', '绩效津贴工资', '平时加班工资', '周末加班工资', '法定节假加班工资', '病假工资',
          '生活补贴', '应付其他补贴', '工龄奖', '全勤奖', '岗位补贴', '工作奖励', '春节按时返岗补贴', '社保补贴',
          '应付工资合计', '扣社保', '借款', '急辞扣款', '其他扣款', '本月水电费', '应扣款合计', '实发金额',
        ]
      : ['月份', '姓名', '底薪', '正班小时', '平时加班', '周末加班', '实际正班工资', '平时加班工资', '周末加班工资', '生活补贴', '工龄奖', '全勤奖', '岗位补贴', '社保补贴', '应付合计', '扣社保', '水电费', '应扣合计', '实发金额'];
    const rows = filteredRecords.map(r => (
      salaryLocation === 'workshop'
        ? [
            `${r.year}年${r.month_num}月`,
            r.employee_name,
            r.is_full_attendance || '',
            r.base_salary || 0,
            r.performance_allowance || 0,
            r.other_subsidy_base || 0,
            r.required_hours || 0,
            r.full_attendance_hours || 0,
            r.normal_hours || 0,
            r.weekday_overtime || 0,
            r.weekend_overtime || 0,
            r.holiday_overtime_hours || 0,
            r.night_shift_days || 0,
            r.absent_days || 0,
            r.personal_leave_hours || 0,
            r.sick_leave_hours || 0,
            r.late_early_minutes || 0,
            r.late_early_count || 0,
            r.sign_card_count || 0,
            r.evaluation_coefficient || 0,
            r.normal_pay || 0,
            r.performance_pay || 0,
            r.weekday_overtime_pay || 0,
            r.weekend_overtime_pay || 0,
            r.holiday_overtime_pay || 0,
            r.sick_pay || 0,
            r.living_subsidy || 0,
            r.other_pay || 0,
            r.seniority_award || 0,
            r.full_attendance_award || 0,
            r.position_subsidy || 0,
            r.work_reward || 0,
            r.spring_festival_subsidy || 0,
            r.social_security_subsidy || 0,
            r.total_payable || 0,
            r.deduct_social_security || 0,
            r.deduct_loan || 0,
            r.deduct_urgent || 0,
            r.deduct_other || 0,
            r.deduct_utilities || 0,
            r.total_deduction || 0,
            r.actual_amount || 0,
          ]
        : [
            `${r.year}年${r.month_num}月`,
            r.employee_name,
            r.base_salary || 0,
            r.normal_hours || 0,
            r.weekday_overtime || 0,
            r.weekend_overtime || 0,
            r.normal_pay || 0,
            r.weekday_overtime_pay || 0,
            r.weekend_overtime_pay || 0,
            r.living_subsidy || 0,
            r.seniority_award || 0,
            r.full_attendance_award || 0,
            r.position_subsidy || 0,
            r.social_security_subsidy || 0,
            r.total_payable || 0,
            r.deduct_social_security || 0,
            r.deduct_utilities || 0,
            r.total_deduction || 0,
            r.actual_amount || 0,
          ]
    ));
    
    const csvContent = '\uFEFF' + [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `工资明细_${salaryLocation === 'office' ? '办公室' : '车间'}_${searchYear}年${searchMonth}月.csv`;
    link.click();
  };

  // 导出工时记录
  const handleExportWorkhours = () => {
    const filteredRecords = monthlyRecords
      .filter(r => searchMonth === 'all' || r.month_num === parseInt(searchMonth))
      .filter(r => r.year === parseInt(searchYear))
      .filter(r => {
        const recordLocation = r.location === '办公室' || r.location === 'office' ? 'office' : 'workshop';
        return recordLocation === workhoursLocation;
      });
    
    const headers = ['月份', '姓名', '总工时', '加班工时', '周末加班', '签字状态'];
    const rows = filteredRecords.map(r => [
      `${r.year}年${r.month_num}月`,
      r.employee_name,
      (r.normal_hours || 0) + (r.weekday_overtime || 0),
      r.weekday_overtime || 0,
      r.weekend_overtime || 0,
      r.signature ? '已签字' : '未签字'
    ]);
    
    const csvContent = '\uFEFF' + [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `工时记录_${workhoursLocation === 'office' ? '办公室' : '车间'}_${searchYear}年${searchMonth}月.csv`;
    link.click();
  };

  // 打开编辑员工弹窗
  const openEditEmployeeDialog = (employee: Employee) => {
    setEditingEmployee(employee);
    setEditFormData({
      name: employee.name || '',
      phone: employee.phone || '',
      id_card: employee.id_card || '',
      department: employee.department || '',
      location: employee.location || 'workshop',
      status: employee.status || '在职',
      hire_date: employee.hire_date || ''
    });
    setShowEditEmployeeDialog(true);
  };
  
  // 更新员工
  const handleUpdateEmployee = async () => {
    if (!editingEmployee) return;
    if (!editFormData.name || !editFormData.id_card || !editFormData.department) {
      alert('请填写姓名、身份证和部门');
      return;
    }
    
    try {
      const response = await fetch(`/api/employees/${editingEmployee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData)
      });
      const data = await response.json();
      if (data.success) {
        alert('员工更新成功');
        setShowEditEmployeeDialog(false);
        setEditingEmployee(null);
        fetchEmployees();
      } else {
        alert(data.error || '更新失败');
      }
    } catch (error) {
      alert('更新失败');
    }
  };
  
  // 导入工资数据
  const handleImportSalary = async (data: { month: string; year: string; records: ImportedSalaryRecord[]; location: string }) => {
    try {
      // 批量导入工资记录
      for (const record of data.records) {
        // 先查找或创建员工
        let employeeId = employees.find(e => e.name === record.name)?.id;
        
        if (!employeeId) {
          // 创建新员工
          const empResponse = await fetch('/api/employees', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: record.name,
              phone: '',
              department: '未分配',
              location: data.location
            })
          });
          const empData = await empResponse.json();
          if (empData.success) {
            employeeId = empData.data.id;
            fetchEmployees();
          }
        }
        
        if (employeeId) {
          // 创建月度工时记录
          await fetch('/api/work-hours-monthly', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employee_id: employeeId,
              employee_name: record.name,
              year: parseInt(data.year),
              month: parseInt(data.month),
              normal_hours: record.normalHours || 0,
              weekday_overtime: record.weekdayOvertime || 0,
              weekend_overtime: record.weekendOvertime || 0,
              base_salary: record.baseSalary || 0,
              normal_pay: record.normalPay || 0,
              weekday_overtime_pay: record.weekdayOvertimePay || 0,
              weekend_overtime_pay: record.weekendOvertimePay || 0,
              total_payable: record.totalPayable || 0,
              deduction: record.totalDeduction || 0,
              actual_amount: record.actualAmount || 0,
              location: data.location
            })
          });
        }
      }
      
      fetchMonthlyRecords();
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  };

  // 添加工资记录
  const handleAddSalary = async () => {
    if (!newSalaryData.employee_name) {
      alert('请输入员工姓名');
      return;
    }
    
    try {
      // 查找员工
      const emp = employees.find(e => e.name === newSalaryData.employee_name);
      let employeeId = emp?.id;
      
      // 如果员工不存在，创建新员工
      if (!employeeId) {
        const empRes = await fetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newSalaryData.employee_name,
            location: salaryLocation
          })
        });
        const empData = await empRes.json();
        if (empData.success) {
          employeeId = empData.data.id;
          fetchEmployees();
        }
      }
      
      if (employeeId) {
        // 创建月度工时记录
        await fetch('/api/work-hours-monthly', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_id: employeeId,
            employee_name: newSalaryData.employee_name,
            year: parseInt(searchYear),
            month: parseInt(searchMonth),
            base_salary: newSalaryData.base_salary,
            normal_full_days: newSalaryData.normal_full_days,
            actual_normal_days: newSalaryData.actual_normal_days,
            weekday_overtime_days: newSalaryData.weekday_overtime_days,
            weekend_overtime_days: newSalaryData.weekend_overtime_days,
            weekday_overtime_pay: newSalaryData.weekday_overtime_pay,
            weekend_overtime_pay: newSalaryData.weekend_overtime_pay,
            living_subsidy: newSalaryData.living_subsidy,
            seniority_award: newSalaryData.seniority_award,
            full_attendance_award: newSalaryData.full_attendance_award,
            position_subsidy: newSalaryData.position_subsidy,
            social_security_subsidy: newSalaryData.social_security_subsidy,
            total_payable: newSalaryData.total_payable,
            deduct_social_security: newSalaryData.deduct_social_security,
            deduct_utilities: newSalaryData.deduct_utilities,
            total_deduction: newSalaryData.total_deduction,
            actual_amount: newSalaryData.actual_amount,
            location: salaryLocation
          })
        });
        
        setShowAddSalaryDialog(false);
        setNewSalaryData({
          employee_id: '',
          employee_name: '',
          location: '',
          base_salary: 0,
          normal_full_days: 0,
          actual_normal_days: 0,
          weekday_overtime_days: 0,
          weekend_overtime_days: 0,
          weekday_overtime_pay: 0,
          weekend_overtime_pay: 0,
          living_subsidy: 0,
          seniority_award: 0,
          full_attendance_award: 0,
          position_subsidy: 0,
          social_security_subsidy: 0,
          total_payable: 0,
          deduct_social_security: 0,
          deduct_utilities: 0,
          total_deduction: 0,
          actual_amount: 0,
        });
        fetchMonthlyRecords();
        alert('工资添加成功');
      }
    } catch (error) {
      alert('添加工资失败');
    }
  };

  // 导入完成回调：切换到导入的年月
  const handleImportComplete = (data: { year: number; month: number; location: string; count: number }) => {
    console.log('导入完成:', data);
    // 更新年月选择器
    setSearchYear(data.year.toString());
    setSearchMonth(String(data.month).padStart(2, '0'));
    // 根据导入位置切换标签页的位置筛选
    if (data.location === '车间' || data.location === 'workshop') {
      setSalaryLocation('workshop');
      setWorkhoursLocation('workshop');
      setAttendanceLocation('workshop');
    } else {
      setSalaryLocation('office');
      setWorkhoursLocation('office');
      setAttendanceLocation('office');
    }
    // 刷新数据
    fetchMonthlyRecords();
    // 显示成功提示
    alert(`导入成功！已导入 ${data.count} 条记录到 ${data.year}年${data.month}月（${data.location}）`);
  };
  
  // 导入工时数据
  const handleImportWorkHours = async (data: { month: string; year: string; employees: ImportedWorkHoursEmployee[] }) => {
    try {
      // 批量导入工时记录
      for (const emp of data.employees) {
        // 先查找或创建员工
        let employeeId = employees.find(e => e.name === emp.name)?.id;
        
        if (!employeeId) {
          // 创建新员工
          const empResponse = await fetch('/api/employees', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: emp.name,
              phone: '',
              department: '未分配'
            })
          });
          const empData = await empResponse.json();
          if (empData.success) {
            employeeId = empData.data.id;
            fetchEmployees();
          }
        }
        
        if (employeeId) {
          // 创建月度工时记录
          const baseSalary = 2200; // 默认底薪
          const normalPay = emp.normalWork * (baseSalary / 176); // 按时薪计算
          const weekdayOvertimePay = emp.weekdayOvertime * (baseSalary / 176) * 1.5; // 平时加班1.5倍
          const weekendOvertimePay = emp.weekendOvertime * (baseSalary / 176) * 2; // 周末加班2倍
          
          await fetch('/api/work-hours-monthly', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employee_id: employeeId,
              employee_name: emp.name,
              year: parseInt(data.year),
              month: parseInt(data.month),
              normal_hours: emp.normalWork,
              weekday_overtime: emp.weekdayOvertime,
              weekend_overtime: emp.weekendOvertime,
              base_salary: baseSalary,
              normal_pay: Math.round(normalPay),
              weekday_overtime_pay: Math.round(weekdayOvertimePay),
              weekend_overtime_pay: Math.round(weekendOvertimePay),
              total_payable: Math.round(normalPay + weekdayOvertimePay + weekendOvertimePay),
              deduction: 0,
              actual_amount: Math.round(normalPay + weekdayOvertimePay + weekendOvertimePay)
            })
          });
        }
      }
      
      fetchMonthlyRecords();
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  };

  // 模拟工资数据
  const salaryRecords: SalaryRecord[] = [
    { id: 1, month: '2026-04', baseSalary: 8000, overtimeHours: 20, overtimePay: 2000, bonus: 500, deduction: 200, totalSalary: 10300, status: '已发放' },
    { id: 2, month: '2026-03', baseSalary: 8000, overtimeHours: 15, overtimePay: 1500, bonus: 300, deduction: 100, totalSalary: 9700, status: '已发放' },
    { id: 3, month: '2026-02', baseSalary: 8000, overtimeHours: 10, overtimePay: 1000, bonus: 200, deduction: 0, totalSalary: 9200, status: '已发放' },
    { id: 4, month: '2026-01', baseSalary: 8000, overtimeHours: 25, overtimePay: 2500, bonus: 800, deduction: 150, totalSalary: 11150, status: '已发放' },
  ];

  // 模拟工时数据
  const workHourRecords: WorkHourRecord[] = [
    { id: 1, date: '2026-05-18', checkIn: '09:00', checkOut: '18:30', workHours: 8, overtimeHours: 1.5, status: '正常' },
    { id: 2, date: '2026-05-17', checkIn: '09:15', checkOut: '19:00', workHours: 8, overtimeHours: 2, status: '正常' },
    { id: 3, date: '2026-05-16', checkIn: '08:55', checkOut: '18:00', workHours: 8, overtimeHours: 0, status: '正常' },
    { id: 4, date: '2026-05-15', checkIn: '09:00', checkOut: '20:00', workHours: 8, overtimeHours: 3, status: '加班' },
    { id: 5, date: '2026-05-14', checkIn: '09:30', checkOut: '18:00', workHours: 7.5, overtimeHours: 0, status: '迟到' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">工资工时查询</h1>
          <p className="text-muted-foreground">管理车间员工、查询工资明细和工时记录</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {activeTab === 'employees' ? (
            <>
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => setShowEmployeeImportDialog(true)}
              >
                <Upload className="h-4 w-4" />
                员工一键导入
              </Button>
              <Button
                className="flex items-center gap-2"
                onClick={() => setShowCreateEmployeeDialog(true)}
              >
                <Plus className="h-4 w-4" />
                创建员工
              </Button>
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => setShowEmployeeQueryDialog(true)}
              >
                <Users className="h-4 w-4" />
                员工自助查询
              </Button>
            </>
          ) : (
            <WorkHoursImport
              onImportSalary={handleImportSalary}
              onImportWorkHours={handleImportWorkHours}
              onImportComplete={handleImportComplete}
            />
          )}
          <Button variant="outline" size="sm" onClick={refreshNow} disabled={isRefreshing} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SalarySectionKey)}>
        <TabsContent value="employees" className="mt-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div> 
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  员工列表
                </CardTitle>
                <CardDescription>管理员工信息，员工可通过姓名和手机号自助查询工时和工资</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                    size="sm"
                    variant={employeeLocation === 'office' ? 'default' : 'outline'}
                    onClick={() => setEmployeeLocation('office')}
                  >
                    办公室
                  </Button>
                  <Button
                    size="sm"
                    variant={employeeLocation === 'workshop' ? 'default' : 'outline'}
                    onClick={() => setEmployeeLocation('workshop')}
                  >
                    车间
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportEmployees}
                    disabled={employees.length === 0}
                  >
                    <FileDown className="h-4 w-4 mr-1" />
                    导出
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {employees.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>暂无员工数据</p>
                  <p className="text-sm mt-2">点击上方“创建员工”按钮添加员工</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 在职员工 */}
                  <div className="border rounded-lg">
                    <div className="bg-green-50 px-4 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="font-medium text-green-700">在职员工</span>
                        <span className="text-sm text-green-600">
                          ({employees.filter(emp => {
                            const empLocation = normalizeLocation(emp.location);
                            return empLocation === employeeLocation && (emp.status === '在职' || !emp.status);
                          }).length}人)
                        </span>
                      </div>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>姓名</TableHead>
                          <TableHead>手机号</TableHead>
                          <TableHead>身份证号</TableHead>
                          <TableHead>部门</TableHead>
                          <TableHead>入职日期</TableHead>
                          <TableHead>位置</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employees.filter(emp => {
                          const empLocation = normalizeLocation(emp.location);
                          return empLocation === employeeLocation && (emp.status === '在职' || !emp.status);
                        }).map((emp) => (
                          <TableRow key={emp.id}>
                            <TableCell className="font-medium">{emp.name}</TableCell>
                            <TableCell>{emp.phone || '-'}</TableCell>
                            <TableCell>{emp.id_card || '-'}</TableCell>
                            <TableCell>{emp.department || '-'}</TableCell>
                            <TableCell>{emp.hire_date || '-'}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded text-xs ${normalizeLocation(emp.location) === 'office' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                {normalizeLocation(emp.location) === 'office' ? '办公室' : '车间'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => {
                                    setEditingEmployee(emp);
                                    setEditFormData({
                                      name: emp.name,
                                      phone: emp.phone || '',
                                      id_card: emp.id_card || '',
                                      department: emp.department || '',
                                      location: normalizeLocation(emp.location),
                                      status: emp.status || '在职',
                                      hire_date: emp.hire_date || ''
                                    });
                                    setShowEditEmployeeDialog(true);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="text-red-500 hover:text-red-700"
                                  onClick={() => handleDeleteEmployee(emp.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {employees.filter(emp => {
                          const empLocation = normalizeLocation(emp.location);
                          return empLocation === employeeLocation && (emp.status === '在职' || !emp.status);
                        }).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-4">
                              暂无在职员工
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* 离职员工 */}
                  <div className="border rounded-lg">
                    <div className="bg-red-50 px-4 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span className="font-medium text-red-700">离职员工</span>
                        <span className="text-sm text-red-600">
                          ({employees.filter(emp => {
                            const empLocation = normalizeLocation(emp.location);
                            return empLocation === employeeLocation && emp.status === '离职';
                          }).length}人)
                        </span>
                      </div>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>姓名</TableHead>
                          <TableHead>手机号</TableHead>
                          <TableHead>身份证号</TableHead>
                          <TableHead>部门</TableHead>
                          <TableHead>离职日期</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employees.filter(emp => {
                          const empLocation = normalizeLocation(emp.location);
                          return empLocation === employeeLocation && emp.status === '离职';
                        }).map((emp) => (
                          <TableRow key={emp.id} className="opacity-75">
                            <TableCell className="font-medium">{emp.name}</TableCell>
                            <TableCell>{emp.phone || '-'}</TableCell>
                            <TableCell>{emp.id_card || '-'}</TableCell>
                            <TableCell>{emp.department || '-'}</TableCell>
                            <TableCell>
                              <span className="text-sm text-red-600">{emp.resign_date || '-'}</span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => {
                                    setEditingEmployee(emp);
                                    setEditFormData({
                                      name: emp.name,
                                      phone: emp.phone || '',
                                      id_card: emp.id_card || '',
                                      department: emp.department || '',
                                      location: normalizeLocation(emp.location),
                                      status: emp.status || '在职',
                                      hire_date: emp.hire_date || ''
                                    });
                                    setShowEditEmployeeDialog(true);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="text-red-500 hover:text-red-700"
                                  onClick={() => handleDeleteEmployee(emp.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {employees.filter(emp => {
                          const empLocation = normalizeLocation(emp.location);
                          return empLocation === employeeLocation && emp.status === '离职';
                        }).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                              暂无离职员工
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="salary" className="mt-6">
        <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                工资明细查询
              </CardTitle>
              <CardDescription>查看历史工资发放记录</CardDescription>
            </CardHeader>
            <CardContent>
              {/* 位置切换 */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex gap-2">
                  <Button 
                    variant={salaryLocation === 'office' ? 'default' : 'outline'}
                    onClick={() => setSalaryLocation('office')}
                  >
                    办公室
                  </Button>
                  <Button 
                    variant={salaryLocation === 'workshop' ? 'default' : 'outline'}
                    onClick={() => setSalaryLocation('workshop')}
                  >
                    车间
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportSalary}
                  disabled={monthlyRecords.length === 0}
                >
                  <FileDown className="h-4 w-4 mr-1" />
                  导出
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddSalaryDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  添加工资
                </Button>
              </div>
              {/* 搜索筛选 */}
              <div className="flex gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <Label>年份</Label>
                  <Select value={searchYear} onValueChange={setSearchYear}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="选择年份" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 21 }, (_, i) => new Date().getFullYear() - 10 + i).map(y => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label>月份</Label>
                  <Select value={searchMonth} onValueChange={setSearchMonth}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="全部" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部</SelectItem>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1).padStart(2, '0')}>
                          {i + 1}月
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 完整工资条表格 */}
              <div className="overflow-x-auto">
                {salaryLocation === 'office' ? (
                  // 办公室工资条模板
                  <Table className="min-w-[2800px]">
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead rowSpan={2} className="align-middle">序号</TableHead>
                        <TableHead rowSpan={2} className="align-middle">姓名</TableHead>
                        <TableHead rowSpan={2} className="align-middle">入职日期</TableHead>
                        <TableHead rowSpan={2} className="align-middle">代码</TableHead>
                        <TableHead rowSpan={2} className="align-middle">部门</TableHead>
                        <TableHead rowSpan={2} className="align-middle text-right">基本工资</TableHead>
                        <TableHead colSpan={7} className="text-center border-x">考勤记录（天D；时H）</TableHead>
                        <TableHead colSpan={5} className="text-center border-x">基本工资+补贴项目</TableHead>
                        <TableHead rowSpan={2} className="align-middle text-right">绩效奖金</TableHead>
                        <TableHead rowSpan={2} className="align-middle text-right">用餐补贴</TableHead>
                        <TableHead rowSpan={2} className="align-middle text-right">住房补贴</TableHead>
                        <TableHead rowSpan={2} className="align-middle text-right">交通补贴</TableHead>
                        <TableHead rowSpan={2} className="align-middle text-right">补贴</TableHead>
                        <TableHead rowSpan={2} className="align-middle text-right">扣款</TableHead>
                        <TableHead rowSpan={2} className="align-middle text-right">其他扣款</TableHead>
                        <TableHead rowSpan={2} className="align-middle text-right">水电费</TableHead>
                        <TableHead rowSpan={2} className="align-middle text-right">应领工资</TableHead>
                        <TableHead colSpan={3} className="text-center border-x">应扣项目</TableHead>
                        <TableHead rowSpan={2} className="align-middle text-right">社保补贴</TableHead>
                        <TableHead rowSpan={2} className="align-middle text-right">税前工资</TableHead>
                        <TableHead rowSpan={2} className="align-middle text-right">个人所得税</TableHead>
                        <TableHead rowSpan={2} className="align-middle text-right">实发工资</TableHead>
                        <TableHead rowSpan={2} className="align-middle">签名</TableHead>
                        <TableHead rowSpan={2} className="align-middle">银行卡号</TableHead>
                        <TableHead rowSpan={2} className="align-middle">备注</TableHead>
                        <TableHead rowSpan={2} className="align-middle">操作</TableHead>
                      </TableRow>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-right border-l">正班应出勤D</TableHead>
                        <TableHead className="text-right">周六天数D</TableHead>
                        <TableHead className="text-right">正班实际出勤D</TableHead>
                        <TableHead className="text-right">已休带薪假D</TableHead>
                        <TableHead className="text-right">平时加班H</TableHead>
                        <TableHead className="text-right">周末加班D</TableHead>
                        <TableHead className="text-right border-r">法定日加班D</TableHead>
                        <TableHead className="text-right border-l">实际出勤工资</TableHead>
                        <TableHead className="text-right">法定日休假工资</TableHead>
                        <TableHead className="text-right">平时加班工资</TableHead>
                        <TableHead className="text-right">周末加班工资</TableHead>
                        <TableHead className="text-right border-r">法定日加班工资</TableHead>
                        <TableHead className="text-right border-l">公积金</TableHead>
                        <TableHead className="text-right">社会保险</TableHead>
                        <TableHead className="text-right border-r">社保养老调</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyRecords
                        .filter(r => searchMonth === 'all' || r.month_num === parseInt(searchMonth))
                        .filter(r => r.year === parseInt(searchYear))
                        .filter(r => {
                          const recordLocation = r.location === '办公室' || r.location === 'office' ? 'office' : 'workshop';
                          return recordLocation === 'office';
                        })
                        .map((record, idx) => (
                        <TableRow key={record.id}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell className="font-medium">{record.employee_name}</TableCell>
                          <TableCell>{record.hire_date || '-'}</TableCell>
                          <TableCell>{record.employee_code || '-'}</TableCell>
                          <TableCell>{record.department || '行政部'}</TableCell>
                          <TableCell className="text-right">¥{record.base_salary}</TableCell>
                          {/* 考勤记录 */}
                          <TableCell className="text-right">{record.should_attend_days || 22}</TableCell>
                          <TableCell className="text-right">{record.saturday_days || 4}</TableCell>
                          <TableCell className="text-right">{record.actual_attend_days || 22}</TableCell>
                          <TableCell className="text-right">{record.paid_leave_days || 0}</TableCell>
                          <TableCell className="text-right">{record.weekday_overtime?.toFixed(1) || 0}</TableCell>
                          <TableCell className="text-right">{record.weekend_overtime?.toFixed(0) || 0}</TableCell>
                          <TableCell className="text-right">{record.holiday_overtime || 0}</TableCell>
                          {/* 基本工资+补贴项目 */}
                          <TableCell className="text-right">¥{record.normal_pay || 0}</TableCell>
                          <TableCell className="text-right">¥{record.holiday_pay || 0}</TableCell>
                          <TableCell className="text-right">¥{record.weekday_overtime_pay || 0}</TableCell>
                          <TableCell className="text-right">¥{record.weekend_overtime_pay || 0}</TableCell>
                          <TableCell className="text-right">¥{record.holiday_overtime_pay || 0}</TableCell>
                          {/* 绩效奖金等 */}
                          <TableCell className="text-right">¥{record.performance_bonus || 0}</TableCell>
                          <TableCell className="text-right">¥{record.meal_subsidy || 0}</TableCell>
                          <TableCell className="text-right">¥{record.housing_subsidy || 0}</TableCell>
                          <TableCell className="text-right">¥{record.transport_subsidy || 0}</TableCell>
                          <TableCell className="text-right">¥{record.other_subsidy || 0}</TableCell>
                          <TableCell className="text-right text-red-600">¥{record.fine || 0}</TableCell>
                          <TableCell className="text-right text-red-600">¥{record.other_deduction || 0}</TableCell>
                          <TableCell className="text-right">¥{record.deduct_utilities || 0}</TableCell>
                          <TableCell className="text-right font-medium">¥{record.total_payable}</TableCell>
                          {/* 应扣项目 */}
                          <TableCell className="text-right">¥{record.housing_fund || 0}</TableCell>
                          <TableCell className="text-right">¥{record.social_insurance || 0}</TableCell>
                          <TableCell className="text-right">¥{record.social_pension_adj || 0}</TableCell>
                          {/* 社保补贴等 */}
                          <TableCell className="text-right">¥{record.social_security_subsidy || 0}</TableCell>
                          <TableCell className="text-right">¥{record.pre_tax_salary || record.total_payable}</TableCell>
                          <TableCell className="text-right">¥{record.income_tax || 0}</TableCell>
                          <TableCell className="text-right font-bold text-green-600">¥{record.actual_amount}</TableCell>
                          <TableCell>
                            {record.signature ? (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 hover:bg-green-200"
                                onClick={() => setViewingSignature({ 
                                  signature: record.signature!, 
                                  employeeName: record.employee_name,
                                  signTime: record.signature_time
                                })}
                              >
                                <PenTool className="h-3 w-3 mr-1" />
                                已签字
                              </Button>
                            ) : (
                              <span className="px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">
                                未签字
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">{record.bank_account || '-'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{record.remark || '-'}</TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setEditingSalaryRecord(record);
                                setShowEditSalaryDialog(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  // 车间工资条模板
                  <Table className="min-w-[4200px]">
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead rowSpan={2} className="align-middle">序号</TableHead>
                        <TableHead rowSpan={2} className="align-middle">姓名</TableHead>
                        <TableHead rowSpan={2} className="align-middle">是否全勤</TableHead>
                        <TableHead colSpan={3} className="text-center border-x">基础数据</TableHead>
                        <TableHead rowSpan={2} className="align-middle text-right">应出勤小时</TableHead>
                        <TableHead rowSpan={2} className="align-middle text-right">正班满勤小时</TableHead>
                        <TableHead colSpan={12} className="text-center border-x">月度出勤记录</TableHead>
                        <TableHead colSpan={14} className="text-center border-x">应付工资</TableHead>
                        <TableHead rowSpan={2} className="align-middle text-right">应付工资合计</TableHead>
                        <TableHead colSpan={5} className="text-center border-x">应扣款项</TableHead>
                        <TableHead rowSpan={2} className="align-middle text-right">应扣款合计</TableHead>
                        <TableHead rowSpan={2} className="align-middle text-right">实发金额</TableHead>
                        <TableHead rowSpan={2} className="align-middle">签名确认</TableHead>
                        <TableHead rowSpan={2} className="align-middle">操作</TableHead>
                      </TableRow>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-right border-l">底薪</TableHead>
                        <TableHead className="text-right">绩效津贴</TableHead>
                        <TableHead className="text-right border-r">其他补贴</TableHead>
                        <TableHead className="text-right border-l">正班小时</TableHead>
                        <TableHead className="text-right">平时加班小时</TableHead>
                        <TableHead className="text-right">周末加班小时</TableHead>
                        <TableHead className="text-right">法定节假加班小时</TableHead>
                        <TableHead className="text-right">夜班（天）</TableHead>
                        <TableHead className="text-right">旷工</TableHead>
                        <TableHead className="text-right">事假（H）</TableHead>
                        <TableHead className="text-right">病假（H）</TableHead>
                        <TableHead className="text-right">迟到早退(分)</TableHead>
                        <TableHead className="text-right">迟到早退(次)</TableHead>
                        <TableHead className="text-right">签卡次数</TableHead>
                        <TableHead className="text-right border-r">考核评价系数</TableHead>
                        <TableHead className="text-right border-l">实际正班出勤工资</TableHead>
                        <TableHead className="text-right">绩效津贴工资</TableHead>
                        <TableHead className="text-right">平时加班工资</TableHead>
                        <TableHead className="text-right">周末加班工资</TableHead>
                        <TableHead className="text-right">法定节假加班工资</TableHead>
                        <TableHead className="text-right">病假工资</TableHead>
                        <TableHead className="text-right">生活补贴</TableHead>
                        <TableHead className="text-right">其他补贴</TableHead>
                        <TableHead className="text-right">工龄奖</TableHead>
                        <TableHead className="text-right">全勤奖</TableHead>
                        <TableHead className="text-right">岗位补贴</TableHead>
                        <TableHead className="text-right">工作奖励</TableHead>
                        <TableHead className="text-right">春节按时返岗补贴</TableHead>
                        <TableHead className="text-right border-r">社保补贴</TableHead>
                        <TableHead className="text-right border-l">扣社保</TableHead>
                        <TableHead className="text-right">借款</TableHead>
                        <TableHead className="text-right">急辞扣款</TableHead>
                        <TableHead className="text-right">其他</TableHead>
                        <TableHead className="text-right border-r">本月水电费</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyRecords
                        .filter(r => searchMonth === 'all' || r.month_num === parseInt(searchMonth))
                        .filter(r => r.year === parseInt(searchYear))
                        .filter(r => {
                          const recordLocation = r.location === '办公室' || r.location === 'office' ? 'office' : 'workshop';
                          return recordLocation === 'workshop';
                        })
                        .map((record, idx) => (
                        <TableRow key={record.id}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell className="font-medium">{record.employee_name}</TableCell>
                          <TableCell>{record.is_full_attendance || '-'}</TableCell>
                          <TableCell className="text-right">{formatSalaryMoney(record.base_salary)}</TableCell>
                          <TableCell className="text-right">{formatSalaryValue(record.performance_allowance)}</TableCell>
                          <TableCell className="text-right">{formatSalaryValue(record.other_subsidy_base)}</TableCell>
                          <TableCell className="text-right">{formatSalaryValue(record.required_hours || 176)}</TableCell>
                          <TableCell className="text-right">{formatSalaryValue(record.full_attendance_hours || 176)}</TableCell>
                          {/* 月度出勤记录 */}
                          <TableCell className="text-right">{formatSalaryValue(record.normal_hours)}</TableCell>
                          <TableCell className="text-right">{formatSalaryValue(record.weekday_overtime)}</TableCell>
                          <TableCell className="text-right">{formatSalaryValue(record.weekend_overtime)}</TableCell>
                          <TableCell className="text-right">{formatSalaryValue(record.holiday_overtime_hours)}</TableCell>
                          <TableCell className="text-right">{formatSalaryValue(record.night_shift_days)}</TableCell>
                          <TableCell className="text-right">{formatSalaryValue(record.absent_days)}</TableCell>
                          <TableCell className="text-right">{formatSalaryValue(record.personal_leave_hours)}</TableCell>
                          <TableCell className="text-right">{formatSalaryValue(record.sick_leave_hours)}</TableCell>
                          <TableCell className="text-right">{formatSalaryValue(record.late_early_minutes)}</TableCell>
                          <TableCell className="text-right">{formatSalaryValue(record.late_early_count)}</TableCell>
                          <TableCell className="text-right">{formatSalaryValue(record.sign_card_count)}</TableCell>
                          <TableCell className="text-right">{formatSalaryValue(record.evaluation_coefficient || 1)}</TableCell>
                          {/* 应付工资 */}
                          <TableCell className="text-right">{formatSalaryMoney(record.normal_pay)}</TableCell>
                          <TableCell className="text-right">{formatSalaryMoney(record.performance_pay)}</TableCell>
                          <TableCell className="text-right">{formatSalaryMoney(record.weekday_overtime_pay)}</TableCell>
                          <TableCell className="text-right">{formatSalaryMoney(record.weekend_overtime_pay)}</TableCell>
                          <TableCell className="text-right">{formatSalaryMoney(record.holiday_overtime_pay)}</TableCell>
                          <TableCell className="text-right">{formatSalaryMoney(record.sick_pay)}</TableCell>
                          <TableCell className="text-right">{formatSalaryValue(record.living_subsidy)}</TableCell>
                          <TableCell className="text-right">{formatSalaryValue(record.other_pay)}</TableCell>
                          <TableCell className="text-right">{formatSalaryValue(record.seniority_award)}</TableCell>
                          <TableCell className="text-right">{formatSalaryValue(record.full_attendance_award)}</TableCell>
                          <TableCell className="text-right">{formatSalaryValue(record.position_subsidy)}</TableCell>
                          <TableCell className="text-right">{formatSalaryValue(record.work_reward)}</TableCell>
                          <TableCell className="text-right">{formatSalaryValue(record.spring_festival_subsidy)}</TableCell>
                          <TableCell className="text-right">{formatSalaryValue(record.social_security_subsidy)}</TableCell>
                          <TableCell className="text-right font-medium">{formatSalaryMoney(record.total_payable)}</TableCell>
                          {/* 应扣款项 */}
                          <TableCell className="text-right">{formatSalaryValue(record.deduct_social_security)}</TableCell>
                          <TableCell className="text-right">{formatSalaryValue(record.deduct_loan)}</TableCell>
                          <TableCell className="text-right">{formatSalaryValue(record.deduct_urgent)}</TableCell>
                          <TableCell className="text-right">{formatSalaryValue(record.deduct_other)}</TableCell>
                          <TableCell className="text-right">{formatSalaryValue(record.deduct_utilities)}</TableCell>
                          <TableCell className="text-right text-red-600">{formatSalaryMoney(record.total_deduction)}</TableCell>
                          <TableCell className="text-right font-bold text-green-600">{formatSalaryMoney(record.actual_amount)}</TableCell>
                          <TableCell>
                            {record.signature ? (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 hover:bg-green-200"
                                onClick={() => setViewingSignature({ 
                                  signature: record.signature!, 
                                  employeeName: record.employee_name,
                                  signTime: record.signature_time
                                })}
                              >
                                <PenTool className="h-3 w-3 mr-1" />
                                已签字
                              </Button>
                            ) : (
                              <span className="px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">
                                未签字
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setEditingSalaryRecord(record);
                                setShowEditSalaryDialog(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              {/* 统计汇总 */}
              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-3">月度汇总 ({searchYear}年{parseInt(searchMonth)}月 - {salaryLocation === 'office' ? '办公室' : '车间'})</h4>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      ¥{(monthlyRecords.length > 0 
                        ? monthlyRecords.filter(r => r.year === parseInt(searchYear) && r.month_num === parseInt(searchMonth) && matchesRecordLocation(r, salaryLocation)).reduce((sum, r) => sum + r.actual_amount, 0)
                        : 0).toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">累计发放</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-orange-600">
                      {monthlyRecords.length > 0 
                        ? monthlyRecords.filter(r => r.year === parseInt(searchYear) && r.month_num === parseInt(searchMonth) && matchesRecordLocation(r, salaryLocation)).reduce((sum, r) => sum + r.weekday_overtime, 0)
                        : 0}小时
                    </div>
                    <div className="text-sm text-muted-foreground">平时加班</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {monthlyRecords.length > 0 
                        ? monthlyRecords.filter(r => r.year === parseInt(searchYear) && r.month_num === parseInt(searchMonth) && matchesRecordLocation(r, salaryLocation)).reduce((sum, r) => sum + r.weekend_overtime, 0)
                        : 0}小时
                    </div>
                    <div className="text-sm text-muted-foreground">周末加班</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-600">
                      {monthlyRecords.filter(r => r.year === parseInt(searchYear) && r.month_num === parseInt(searchMonth) && r.signature && matchesRecordLocation(r, salaryLocation)).length}人
                    </div>
                    <div className="text-sm text-muted-foreground">已签字</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workhours" className="mt-6">
        <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                工时记录查询
              </CardTitle>
              <CardDescription>根据打卡记录计算每日工时明细</CardDescription>
            </CardHeader>
            <CardContent>
              {/* 位置切换和筛选 */}
              <div className="flex items-center gap-4 mb-4 flex-wrap">
                <div className="flex gap-2">
                  <Button 
                    variant={workhoursLocation === 'office' ? 'default' : 'outline'}
                    onClick={() => setWorkhoursLocation('office')}
                  >
                    办公室
                  </Button>
                  <Button 
                    variant={workhoursLocation === 'workshop' ? 'default' : 'outline'}
                    onClick={() => setWorkhoursLocation('workshop')}
                  >
                    车间
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Label>年份</Label>
                  <Select value={searchYear} onValueChange={setSearchYear}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 21 }, (_, i) => new Date().getFullYear() - 10 + i).map(y => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label>月份</Label>
                  <Select value={searchMonth} onValueChange={setSearchMonth}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1).padStart(2, '0')}>
                          {i + 1}月
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 工时计算说明 */}
              <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                <strong>工时计算规则：</strong>
                正班 8:00-12:00 + 13:30-17:30 = 8小时 | 
                午休 12:00-13:30 不计工时 | 
                晚饭 17:30-18:00 不计工时 | 
                加班 18:00后开始计算
              </div>

              {/* 工时明细表格 - 使用 Accordion 展开/收缩 */}
              {(() => {
                // 筛选员工 - 始终显示所有员工
                const targetEmployees = employees.filter(e => {
                  const empLocation = e.location === '办公室' || e.location === 'office' ? 'office' : 'workshop';
                  return empLocation === workhoursLocation && (!e.status || e.status === '在职');
                });

                if (targetEmployees.length === 0) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>该位置暂无在职员工</p>
                    </div>
                  );
                }

                // 计算每个员工当月的工时明细
                const year = parseInt(searchYear);
                const month = parseInt(searchMonth);
                const daysInMonth = new Date(year, month, 0).getDate();

                return (
                  <Accordion type="multiple" className="w-full">
                    {targetEmployees.map(emp => {
                      // 获取该员工当月的打卡记录
                      const empMonthlyRecord = monthlyRecords.find(r => 
                        r.employee_id === emp.id && 
                        r.year === year && 
                        r.month_num === month &&
                        (r.location === (workhoursLocation === 'office' ? '办公室' : '车间') || 
                         r.location === workhoursLocation)
                      );

                      const details = empMonthlyRecord?.details ? JSON.parse(empMonthlyRecord.details) : {};
                      const dailyWorkHours: Array<{
                        day: number;
                        date: string;
                        weekday: string;
                        times: string[];
                        firstTime: string | null;
                        lastTime: string | null;
                        normalHours: number;
                        overtimeHours: number;
                        totalHours: number;
                      }> = [];

                      const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

                      for (let day = 1; day <= daysInMonth; day++) {
                        const dayStr = String(day);
                        const dayTimes = details[dayStr] || '';
                        const times = dayTimes ? dayTimes.split('\n').filter((t: string) => t.trim()) : [];
                        
                        const date = new Date(year, month - 1, day);
                        const weekday = weekdays[date.getDay()];
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                        // 计算工时
                        let normalHours = 0;
                        let overtimeHours = 0;

                        if (times.length > 0) {
                          const result = calculateWorkHours(times, isWeekend);
                          normalHours = result.normalHours;
                          overtimeHours = result.overtimeHours;
                        }

                        dailyWorkHours.push({
                          day,
                          date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
                          weekday,
                          times,
                          firstTime: times.length > 0 ? times[0] : null,
                          lastTime: times.length > 0 ? times[times.length - 1] : null,
                          normalHours,
                          overtimeHours,
                          totalHours: normalHours + overtimeHours
                        });
                      }

                      // 汇总
                      const totalNormal = dailyWorkHours.reduce((sum, d) => sum + d.normalHours, 0);
                      const totalOvertime = dailyWorkHours.reduce((sum, d) => sum + d.overtimeHours, 0);
                      const hasRecords = dailyWorkHours.some(d => d.times.length > 0);

                      return (
                        <AccordionItem key={emp.id} value={`emp-${emp.id}`} className="border rounded-lg mb-2">
                          <AccordionTrigger className="px-4 py-3 hover:no-underline">
                            <div className="flex justify-between items-center w-full pr-4">
                              <div className="flex items-center gap-3">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{emp.name}</span>
                              </div>
                              <div className="flex items-center gap-4 text-sm">
                                <span className="text-blue-600">正班: {totalNormal.toFixed(1)}h</span>
                                <span className="text-orange-600">加班: {totalOvertime.toFixed(1)}h</span>
                                <span className="font-bold text-green-600">合计: {(totalNormal + totalOvertime).toFixed(1)}h</span>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4">
                            {hasRecords ? (
                              <div className="overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="w-16">日期</TableHead>
                                      <TableHead className="w-12">星期</TableHead>
                                      <TableHead>打卡记录</TableHead>
                                      <TableHead className="w-24">上班</TableHead>
                                      <TableHead className="w-24">下班</TableHead>
                                      <TableHead className="w-20 text-right">正班</TableHead>
                                      <TableHead className="w-20 text-right">加班</TableHead>
                                      <TableHead className="w-20 text-right">合计</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {dailyWorkHours.filter(d => d.times.length > 0).map(d => (
                                      <TableRow key={d.day} className={d.weekday === '六' || d.weekday === '日' ? 'bg-yellow-50' : ''}>
                                        <TableCell>{d.day}日</TableCell>
                                        <TableCell className={d.weekday === '六' || d.weekday === '日' ? 'text-orange-600' : ''}>{d.weekday}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                          {d.times.map((t, i) => (
                                            <span key={i} className={`inline-block mr-1 ${t.includes('漏') || t.includes('补') || t.includes('请假') ? 'text-red-500' : ''}`}>
                                              {t}
                                            </span>
                                          ))}
                                        </TableCell>
                                        <TableCell>{d.firstTime || '-'}</TableCell>
                                        <TableCell>{d.lastTime || '-'}</TableCell>
                                        <TableCell className="text-right text-blue-600">{d.normalHours.toFixed(1)}h</TableCell>
                                        <TableCell className="text-right text-orange-600">{d.overtimeHours.toFixed(1)}h</TableCell>
                                        <TableCell className="text-right font-bold">{d.totalHours.toFixed(1)}h</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            ) : (
                              <div className="py-4 text-center text-muted-foreground text-sm">该月份无打卡记录</div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="mt-6">
        <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                打卡记录查询
              </CardTitle>
              <CardDescription>查看员工每日打卡详情</CardDescription>
            </CardHeader>
            <CardContent>
              {/* 位置切换 */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex gap-2">
                  <Button 
                    variant={attendanceLocation === 'office' ? 'default' : 'outline'}
                    onClick={() => setAttendanceLocation('office')}
                  >
                    办公室
                  </Button>
                  <Button 
                    variant={attendanceLocation === 'workshop' ? 'default' : 'outline'}
                    onClick={() => setAttendanceLocation('workshop')}
                  >
                    车间
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    // 打开添加打卡对话框（不选择特定日期）
                    setEditingAttendance(null);
                    setNewAttendanceTime('');
                    setNewAttendanceNote('');
                    setShowAttendanceEditDialog(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  添加打卡
                </Button>
              </div>
              {/* 搜索筛选 */}
              <div className="flex gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <Label>年份</Label>
                  <Select value={searchYear} onValueChange={setSearchYear}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="选择年份" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 21 }, (_, i) => new Date().getFullYear() - 10 + i).map(y => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label>月份</Label>
                  <Select value={searchMonth} onValueChange={setSearchMonth}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="选择月份" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1).padStart(2, '0')}>
                          {i + 1}月
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 打卡记录日历视图 */}
              {(() => {
                const year = parseInt(searchYear);
                const month = parseInt(searchMonth);
                const daysInMonth = new Date(year, month, 0).getDate();
                const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
                
                // 筛选当月记录和位置（兼容中英文位置值），并合并已审核请假
                const monthRecords = getAttendanceRows(year, month, attendanceLocation);
                
                if (monthRecords.length === 0) {
                  // 找出有数据的月份
                  const availableMonths = [...new Set(monthlyRecords.map(r => `${r.year}年${r.month_num}月`))];
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>暂无打卡记录</p>
                      {availableMonths.length > 0 && (
                        <p className="text-sm mt-2">
                          当前选择：{year}年{month}月，有数据的月份：{availableMonths.join('、')}
                        </p>
                      )}
                      <p className="text-sm mt-2">点击“导入工资/工时”按钮导入打卡数据</p>
                    </div>
                  );
                }
                
                return (
                  <div className="overflow-x-auto">
                    <table className="border-collapse border border-gray-300 text-xs min-w-max">
                      <thead>
                        <tr className="bg-blue-500 text-white">
                          <th className="border border-gray-300 p-2 min-w-20 bg-blue-600">姓名</th>
                          <th className="border border-gray-300 p-2 min-w-16 bg-blue-600">日期</th>
                          {Array.from({ length: daysInMonth }, (_, i) => {
                            const day = i + 1;
                            const date = new Date(year, month - 1, day);
                            const weekDay = weekDays[date.getDay()];
                            return (
                              <th key={day} className="border border-gray-300 p-1 text-center min-w-16">
                                <div>{day}</div>
                                <div className="text-xs font-normal opacity-80">周{weekDay}</div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {monthRecords.map((record) => {
                          const details = parseAttendanceDetails(record);
                          return (
                            <tr key={record.id}>
                              <td className="border border-gray-300 p-2 bg-yellow-100 font-medium text-center">
                                {record.employee_name}
                              </td>
                              <td className="border border-gray-300 p-2 bg-gray-50 text-center text-gray-400">
                                {record.department || '-'}
                              </td>
                              {Array.from({ length: daysInMonth }, (_, i) => {
                                const day = i + 1;
                                const dayRecord = details[day];
                                const dateText = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                const dayLeaves = getLeaveRequestsForRecordDate(record, dateText);
                                let content = '';
                                let times: string[] = [];
                                if (typeof dayRecord === 'string') {
                                  // 格式：直接是时间字符串，可能包含换行分隔的多个时间
                                  times = dayRecord.split('\n').filter(t => t.trim());
                                  // 将时间配对显示为时间段
                                  const pairs: string[] = [];
                                  for (let k = 0; k < times.length; k += 2) {
                                    if (times[k + 1]) {
                                      pairs.push(`${times[k]} ${times[k + 1]}`);
                                    } else {
                                      pairs.push(times[k]);
                                    }
                                  }
                                  content = pairs.join('\n');
                                } else if (dayRecord && typeof dayRecord === 'object' && Array.isArray((dayRecord as { times?: unknown }).times)) {
                                  times = (dayRecord as { times: unknown[] }).times.map(time => String(time)).filter(time => time.trim());
                                  content = times.join(' ');
                                }
                                const leaveText = [...new Set(dayLeaves.map(leave => formatAttendanceLeaveLabel(leave.duration)))].join('\n');
                                const displayContent = [content, leaveText].filter(Boolean).join('\n');
                                // 检查是否有带备注的时间
                                const hasNote = times.some(t => t.includes('（'));
                                const hasLeave = dayLeaves.length > 0;
                                return (
                                  <td 
                                    key={day} 
                                    className={`border border-gray-300 p-1 text-center whitespace-pre-line text-xs cursor-pointer hover:bg-blue-50 transition-colors ${hasNote ? 'text-blue-600' : ''} ${hasLeave ? 'bg-rose-50 font-medium text-rose-600' : ''}`}
                                    onClick={() => openAttendanceEdit(record.employee_id, record.employee_name, year, month, day, times)}
                                    title={hasLeave ? '已审核请假记录' : '点击编辑打卡记录'}
                                  >
                                    {displayContent}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              {/* 统计 */}
              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-3">打卡统计 ({searchYear}年{searchMonth}月 - {attendanceLocation === 'office' ? '办公室' : '车间'})</h4>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {getAttendanceRows(parseInt(searchYear), parseInt(searchMonth), attendanceLocation).length}
                    </div>
                    <div className="text-sm text-muted-foreground">员工数</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-orange-600">
                      {getAttendanceRows(parseInt(searchYear), parseInt(searchMonth), attendanceLocation)
                        .reduce((sum, r) => sum + calculateAttendanceRecordSummary(r).normalHours, 0).toFixed(1)}小时
                    </div>
                    <div className="text-sm text-muted-foreground">正班工时</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {getAttendanceRows(parseInt(searchYear), parseInt(searchMonth), attendanceLocation)
                        .reduce((sum, r) => sum + calculateAttendanceRecordSummary(r).overtimeHours, 0).toFixed(1)}小时
                    </div>
                    <div className="text-sm text-muted-foreground">加班工时</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-600">
                      {getAttendanceRows(parseInt(searchYear), parseInt(searchMonth), attendanceLocation)
                        .filter(r => r.signature).length}人
                    </div>
                    <div className="text-sm text-muted-foreground">已签字</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 工资记录编辑弹窗 */}
      <Dialog open={showEditSalaryDialog} onOpenChange={setShowEditSalaryDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑工资记录</DialogTitle>
            <DialogDescription>修改 {editingSalaryRecord?.employee_name} 的工资信息</DialogDescription>
          </DialogHeader>
          {editingSalaryRecord && (
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>底薪</Label>
                <Input 
                  type="number"
                  value={editingSalaryRecord.base_salary || 0}
                  onChange={(e) => setEditingSalaryRecord({...editingSalaryRecord, base_salary: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <Label>正班小时</Label>
                <Input 
                  type="number"
                  value={editingSalaryRecord.normal_hours || 0}
                  onChange={(e) => setEditingSalaryRecord({...editingSalaryRecord, normal_hours: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <Label>平时加班</Label>
                <Input 
                  type="number"
                  value={editingSalaryRecord.weekday_overtime || 0}
                  onChange={(e) => setEditingSalaryRecord({...editingSalaryRecord, weekday_overtime: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <Label>周末加班</Label>
                <Input 
                  type="number"
                  value={editingSalaryRecord.weekend_overtime || 0}
                  onChange={(e) => setEditingSalaryRecord({...editingSalaryRecord, weekend_overtime: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <Label>实际正班工资</Label>
                <Input 
                  type="number"
                  value={editingSalaryRecord.normal_pay || 0}
                  onChange={(e) => setEditingSalaryRecord({...editingSalaryRecord, normal_pay: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <Label>平时加班工资</Label>
                <Input 
                  type="number"
                  value={editingSalaryRecord.weekday_overtime_pay || 0}
                  onChange={(e) => setEditingSalaryRecord({...editingSalaryRecord, weekday_overtime_pay: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <Label>周末加班工资</Label>
                <Input 
                  type="number"
                  value={editingSalaryRecord.weekend_overtime_pay || 0}
                  onChange={(e) => setEditingSalaryRecord({...editingSalaryRecord, weekend_overtime_pay: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <Label>生活补贴</Label>
                <Input 
                  type="number"
                  value={editingSalaryRecord.living_subsidy || 0}
                  onChange={(e) => setEditingSalaryRecord({...editingSalaryRecord, living_subsidy: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <Label>工龄奖</Label>
                <Input 
                  type="number"
                  value={editingSalaryRecord.seniority_award || 0}
                  onChange={(e) => setEditingSalaryRecord({...editingSalaryRecord, seniority_award: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <Label>全勤奖</Label>
                <Input 
                  type="number"
                  value={editingSalaryRecord.full_attendance_award || 0}
                  onChange={(e) => setEditingSalaryRecord({...editingSalaryRecord, full_attendance_award: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <Label>岗位补贴</Label>
                <Input 
                  type="number"
                  value={editingSalaryRecord.position_subsidy || 0}
                  onChange={(e) => setEditingSalaryRecord({...editingSalaryRecord, position_subsidy: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <Label>社保补贴</Label>
                <Input 
                  type="number"
                  value={editingSalaryRecord.social_security_subsidy || 0}
                  onChange={(e) => setEditingSalaryRecord({...editingSalaryRecord, social_security_subsidy: parseFloat(e.target.value) || 0})}
                />
              </div>
              {/* 应扣款项 - 根据格式显示不同字段 */}
              {editingSalaryRecord.location === '办公室' || editingSalaryRecord.location === 'office' ? (
                <>
                  <div className="space-y-2">
                    <Label>公积金</Label>
                    <Input 
                      type="number"
                      value={editingSalaryRecord.housing_fund || 0}
                      onChange={(e) => setEditingSalaryRecord({...editingSalaryRecord, housing_fund: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>社会保险</Label>
                    <Input 
                      type="number"
                      value={editingSalaryRecord.social_insurance || 0}
                      onChange={(e) => setEditingSalaryRecord({...editingSalaryRecord, social_insurance: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>社保养老调</Label>
                    <Input 
                      type="number"
                      value={editingSalaryRecord.social_pension_adj || 0}
                      onChange={(e) => setEditingSalaryRecord({...editingSalaryRecord, social_pension_adj: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>扣社保</Label>
                    <Input 
                      type="number"
                      value={editingSalaryRecord.deduct_social_security || 0}
                      onChange={(e) => setEditingSalaryRecord({...editingSalaryRecord, deduct_social_security: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>水电费</Label>
                    <Input 
                      type="number"
                      value={editingSalaryRecord.deduct_utilities || 0}
                      onChange={(e) => setEditingSalaryRecord({...editingSalaryRecord, deduct_utilities: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label>应付合计</Label>
                <Input 
                  type="number"
                  value={editingSalaryRecord.total_payable || 0}
                  onChange={(e) => setEditingSalaryRecord({...editingSalaryRecord, total_payable: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <Label>实发金额</Label>
                <Input 
                  type="number"
                  value={editingSalaryRecord.actual_amount || 0}
                  onChange={(e) => setEditingSalaryRecord({...editingSalaryRecord, actual_amount: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>银行卡号</Label>
                <Input 
                  type="text"
                  placeholder="请输入银行卡号"
                  value={editingSalaryRecord.bank_account || ''}
                  onChange={(e) => setEditingSalaryRecord({...editingSalaryRecord, bank_account: e.target.value})}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>备注</Label>
                <textarea
                  className="w-full min-h-[80px] px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入备注信息"
                  value={editingSalaryRecord.remark || ''}
                  onChange={(e) => setEditingSalaryRecord({...editingSalaryRecord, remark: e.target.value})}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditSalaryDialog(false)}>取消</Button>
            <Button onClick={async () => {
              if (!editingSalaryRecord) return;
              try {
                const response = await fetch(`/api/work-hours-monthly/${editingSalaryRecord.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(editingSalaryRecord)
                });
                const data = await response.json();
                if (data.success) {
                  alert('工资记录更新成功');
                  setShowEditSalaryDialog(false);
                  fetchMonthlyRecords();
                } else {
                  alert('更新失败: ' + data.error);
                }
              } catch (e) {
                alert('更新失败');
              }
            }}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 员工自助查询对话框 */}
      <Dialog open={showEmployeeQueryDialog} onOpenChange={setShowEmployeeQueryDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              员工自助查询
            </DialogTitle>
            <DialogDescription>
              车间员工可通过此链接查询个人工时和工资，无需登录
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800 mb-2 font-medium">查询地址</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm bg-white px-3 py-2 rounded border text-blue-600 break-all">
                  {employeeQueryUrl}
                </code>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={handleCopyUrl}
              >
                <Copy className="h-4 w-4 mr-2" />
                复制链接
              </Button>
              <Button 
                className="flex-1"
                onClick={() => window.open(employeeQueryUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                打开页面
              </Button>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>• 员工输入姓名和手机号即可查询</p>
              <p>• 可查询个人工时记录和工资明细</p>
              <p>• 页面支持创建新员工档案</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* 创建员工对话框 */}
      <Dialog open={showCreateEmployeeDialog} onOpenChange={setShowCreateEmployeeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              创建员工
            </DialogTitle>
            <DialogDescription>
              创建员工档案，员工可通过姓名和身份证查询工时和工资
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">姓名 *</Label>
              <Input
                id="name"
                placeholder="请输入员工姓名"
                value={newEmployee.name}
                onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">手机号</Label>
              <Input
                id="phone"
                placeholder="请输入手机号"
                value={newEmployee.phone}
                onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="id_card">身份证号 *</Label>
              <Input
                id="id_card"
                placeholder="请输入身份证号"
                value={newEmployee.id_card}
                onChange={(e) => setNewEmployee({ ...newEmployee, id_card: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">部门 *</Label>
              <Input
                id="department"
                placeholder="请输入部门，如：生产部"
                value={newEmployee.department}
                onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hire-date">入职日期</Label>
              <Input
                id="hire-date"
                type="date"
                value={newEmployee.hire_date}
                onChange={(e) => setNewEmployee({ ...newEmployee, hire_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>位置 *</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={newEmployee.location === 'workshop' ? 'default' : 'outline'}
                  className={newEmployee.location === 'workshop' ? 'bg-orange-500 hover:bg-orange-600' : ''}
                  onClick={() => setNewEmployee({ ...newEmployee, location: 'workshop' })}
                >
                  车间
                </Button>
                <Button
                  type="button"
                  variant={newEmployee.location === 'office' ? 'default' : 'outline'}
                  className={newEmployee.location === 'office' ? 'bg-blue-500 hover:bg-blue-600' : ''}
                  onClick={() => setNewEmployee({ ...newEmployee, location: 'office' })}
                >
                  办公室
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateEmployeeDialog(false)}>
              取消
            </Button>
            <Button onClick={handleCreateEmployee}>
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 编辑员工对话框 */}
      <Dialog open={showEditEmployeeDialog} onOpenChange={setShowEditEmployeeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-blue-600" />
              编辑员工
            </DialogTitle>
            <DialogDescription>
              修改员工信息，分配办公室或车间
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">姓名 *</Label>
              <Input 
                id="edit-name" 
                value={editFormData.name}
                onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                placeholder="请输入员工姓名" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">手机号</Label>
              <Input 
                id="edit-phone" 
                value={editFormData.phone}
                onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                placeholder="请输入手机号" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-idcard">身份证号 *</Label>
              <Input 
                id="edit-idcard" 
                value={editFormData.id_card}
                onChange={(e) => setEditFormData({...editFormData, id_card: e.target.value})}
                placeholder="请输入身份证号" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-dept">部门 *</Label>
              <Select value={editFormData.department} onValueChange={(v) => setEditFormData({...editFormData, department: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="选择部门" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="行政部">行政部</SelectItem>
                  <SelectItem value="财务部">财务部</SelectItem>
                  <SelectItem value="生产部">生产部</SelectItem>
                  <SelectItem value="品质部">品质部</SelectItem>
                  <SelectItem value="销售部">销售部</SelectItem>
                  <SelectItem value="技术部">技术部</SelectItem>
                  <SelectItem value="电商部">电商部</SelectItem>
                  <SelectItem value="外贸部">外贸部</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>位置 *</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={editFormData.location === 'office' || editFormData.location === '办公室' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEditFormData({...editFormData, location: 'office'})}
                  className="flex-1"
                >
                  办公室
                </Button>
                <Button
                  type="button"
                  variant={editFormData.location === 'workshop' || editFormData.location === '车间' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEditFormData({...editFormData, location: 'workshop'})}
                  className="flex-1"
                >
                  车间
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-hire-date">入职日期</Label>
              <Input 
                id="edit-hire-date" 
                type="date"
                value={editFormData.hire_date}
                onChange={(e) => setEditFormData({...editFormData, hire_date: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>状态</Label>
              <Select value={editFormData.status} onValueChange={(v) => setEditFormData({...editFormData, status: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="在职">在职</SelectItem>
                  <SelectItem value="离职">离职</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditEmployeeDialog(false)}>
              取消
            </Button>
            <Button onClick={handleUpdateEmployee}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 员工一键导入对话框 */}
      <Dialog open={showEmployeeImportDialog} onOpenChange={setShowEmployeeImportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-600" />
              员工一键导入
            </DialogTitle>
            <DialogDescription>
              导入员工档案，支持姓名、身份证、在职状态等信息
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>选择位置</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={employeeImportLocation === 'office' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEmployeeImportLocation('office')}
                  className="flex-1"
                >
                  办公室
                </Button>
                <Button
                  type="button"
                  variant={employeeImportLocation === 'workshop' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEmployeeImportLocation('workshop')}
                  className="flex-1"
                >
                  车间
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>选择Excel文件</Label>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  
                  setEmployeeImporting(true);
                  try {
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('location', employeeImportLocation === 'office' ? '办公室' : '车间');
                    
                    const response = await fetch('/api/employee-import', {
                      method: 'POST',
                      body: formData
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                      alert(result.message);
                      setShowEmployeeImportDialog(false);
                      fetchEmployees(); // 刷新员工列表
                      fetchMonthlyRecords(); // 刷新月度记录
                    } else {
                      alert(result.error || '导入失败');
                    }
                  } catch (err) {
                    console.error('导入失败:', err);
                    alert('导入失败，请检查文件格式');
                  } finally {
                    setEmployeeImporting(false);
                  }
                }}
                disabled={employeeImporting}
              />
              <p className="text-xs text-muted-foreground">
                支持格式：xlsx、xls。将自动识别姓名、身份证、部门、在职状态
              </p>
            </div>
            {employeeImporting && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                正在导入...
              </div>
            )}
            <div className="p-3 bg-muted/50 rounded-lg text-sm">
              <p className="font-medium mb-2">导入说明：</p>
              <ul className="space-y-1 text-muted-foreground list-disc list-inside">
                <li>自动识别表头位置</li>
                <li>提取姓名、身份证号、手机号</li>
                <li>识别在职/离职状态</li>
                <li>已存在的员工自动更新</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmployeeImportDialog(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 打卡记录编辑对话框 */}
      <Dialog open={showAttendanceEditDialog} onOpenChange={setShowAttendanceEditDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑打卡记录</DialogTitle>
            <DialogDescription>
              {editingAttendance 
                ? `${editingAttendance.employeeName} - ${editingAttendance.date}` 
                : '添加新打卡记录'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* 如果没有选择特定员工和日期，显示选择器 */}
            {!editingAttendance && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>员工</Label>
                    <Select onValueChange={(val) => {
                      const emp = employees.find(e => e.id === parseInt(val));
                      if (emp) {
                        setEditingAttendance(prev => ({
                          employeeId: emp.id,
                          employeeName: emp.name,
                          date: `${searchYear}-${searchMonth}-01`,
                          day: 1,
                          existingTimes: []
                        }));
                      }
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择员工" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees
                          .filter(e => {
                            const empLoc = normalizeLocation(e.location);
                            const isActive = !e.status || e.status === '在职';
                            return empLoc === attendanceLocation && isActive;
                          })
                          .map(e => (
                            <SelectItem key={e.id} value={String(e.id)}>
                              {e.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>日期</Label>
                    <Input 
                      type="date" 
                      value={`${searchYear}-${searchMonth}-01`}
                      onChange={(e) => {
                        const date = e.target.value;
                        if (editingAttendance && date) {
                          setEditingAttendance(prev => prev ? { ...prev, date, day: parseInt(date.split('-')[2]) } : null);
                        }
                      }}
                    />
                  </div>
                </div>
              </>
            )}
            
            {/* 显示现有的打卡时间 */}
            {editingAttendance && editingAttendance.existingTimes.length > 0 && (
              <div>
                <Label>现有打卡记录</Label>
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto border rounded p-2">
                  {editingAttendance.existingTimes.map((time, idx) => {
                    const hasNote = time.includes('（');
                    return (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className={hasNote ? 'text-blue-600' : ''}>{time}</span>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 text-red-500 hover:text-red-700"
                          onClick={() => deleteAttendanceTime(time)}
                        >
                          删除
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* 添加新打卡时间 */}
            <div>
              <Label>新打卡时间 *</Label>
              <Input 
                type="time"
                value={newAttendanceTime}
                onChange={(e) => setNewAttendanceTime(e.target.value)}
                placeholder="如: 08:30"
              />
            </div>
            
            <div>
              <Label>备注 * (必填)</Label>
              <Input 
                value={newAttendanceNote}
                onChange={(e) => setNewAttendanceNote(e.target.value)}
                placeholder="如: 漏卡补卡、请假、外出办事"
              />
              <p className="text-xs text-muted-foreground mt-1">
                修改打卡记录必须填写备注说明原因
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAttendanceEditDialog(false)}>
              取消
            </Button>
            <Button onClick={submitAttendanceEdit} disabled={!newAttendanceTime || !newAttendanceNote.trim()}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 添加工资对话框 */}
      <Dialog open={showAddSalaryDialog} onOpenChange={setShowAddSalaryDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>添加工资记录 - {salaryLocation === 'office' ? '办公室（月薪）' : '车间（底薪+加班费）'}</DialogTitle>
            <DialogDescription>
              为 {searchYear}年{parseInt(searchMonth)}月 添加工资记录
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* 员工选择 */}
            <div className="space-y-2">
              <Label>选择员工 *</Label>
              <Select 
                value={newSalaryData.employee_id} 
                onValueChange={(value) => {
                  const emp = employees.find(e => String(e.id) === value);
                  setNewSalaryData({
                    ...newSalaryData, 
                    employee_id: value,
                    employee_name: emp?.name || ''
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择员工" />
                </SelectTrigger>
                <SelectContent>
                  {employees
                    .filter(e => {
                      const empLoc = normalizeLocation(e.location);
                      const isActive = !e.status || e.status === '在职';
                      return isActive && empLoc === salaryLocation;
                    })
                    .map(e => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {e.name} - {e.department || '未分配部门'}
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>

            {/* 办公室模板 - 月薪 */}
            {salaryLocation === 'office' && (
              <>
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3 text-blue-600">月薪工资</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>月薪金额 *</Label>
                      <Input 
                        type="number"
                        value={newSalaryData.base_salary} 
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          setNewSalaryData({...newSalaryData, base_salary: val, total_payable: val, actual_amount: val - newSalaryData.total_deduction});
                        }}
                        placeholder="输入月薪"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>正班出勤天数</Label>
                      <Input 
                        type="number"
                        value={newSalaryData.actual_normal_days} 
                        onChange={e => setNewSalaryData({...newSalaryData, actual_normal_days: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">补贴项</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">生活补贴</Label>
                      <Input 
                        type="number"
                        value={newSalaryData.living_subsidy} 
                        onChange={e => setNewSalaryData({...newSalaryData, living_subsidy: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">工龄奖</Label>
                      <Input 
                        type="number"
                        value={newSalaryData.seniority_award} 
                        onChange={e => setNewSalaryData({...newSalaryData, seniority_award: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">全勤奖</Label>
                      <Input 
                        type="number"
                        value={newSalaryData.full_attendance_award} 
                        onChange={e => setNewSalaryData({...newSalaryData, full_attendance_award: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">岗位补贴</Label>
                      <Input 
                        type="number"
                        value={newSalaryData.position_subsidy} 
                        onChange={e => setNewSalaryData({...newSalaryData, position_subsidy: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* 车间模板 - 底薪+加班费 */}
            {salaryLocation === 'workshop' && (
              <>
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3 text-orange-600">底薪</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>基础底薪 *</Label>
                      <Input 
                        type="number"
                        value={newSalaryData.base_salary} 
                        onChange={e => setNewSalaryData({...newSalaryData, base_salary: parseFloat(e.target.value) || 0})}
                        placeholder="输入底薪"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>实际正班天数</Label>
                      <Input 
                        type="number"
                        value={newSalaryData.actual_normal_days} 
                        onChange={e => setNewSalaryData({...newSalaryData, actual_normal_days: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">加班记录</h4>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">平时加班(小时)</Label>
                      <Input 
                        type="number"
                        value={newSalaryData.weekday_overtime_days} 
                        onChange={e => setNewSalaryData({...newSalaryData, weekday_overtime_days: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">周末加班(小时)</Label>
                      <Input 
                        type="number"
                        value={newSalaryData.weekend_overtime_days} 
                        onChange={e => setNewSalaryData({...newSalaryData, weekend_overtime_days: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">平时加班费</Label>
                      <Input 
                        type="number"
                        value={newSalaryData.weekday_overtime_pay} 
                        onChange={e => setNewSalaryData({...newSalaryData, weekday_overtime_pay: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">周末加班费</Label>
                      <Input 
                        type="number"
                        value={newSalaryData.weekend_overtime_pay} 
                        onChange={e => setNewSalaryData({...newSalaryData, weekend_overtime_pay: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">补贴项</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">生活补贴</Label>
                      <Input 
                        type="number"
                        value={newSalaryData.living_subsidy} 
                        onChange={e => setNewSalaryData({...newSalaryData, living_subsidy: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">工龄奖</Label>
                      <Input 
                        type="number"
                        value={newSalaryData.seniority_award} 
                        onChange={e => setNewSalaryData({...newSalaryData, seniority_award: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">全勤奖</Label>
                      <Input 
                        type="number"
                        value={newSalaryData.full_attendance_award} 
                        onChange={e => setNewSalaryData({...newSalaryData, full_attendance_award: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">岗位补贴</Label>
                      <Input 
                        type="number"
                        value={newSalaryData.position_subsidy} 
                        onChange={e => setNewSalaryData({...newSalaryData, position_subsidy: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">社保补贴</Label>
                      <Input 
                        type="number"
                        value={newSalaryData.social_security_subsidy} 
                        onChange={e => setNewSalaryData({...newSalaryData, social_security_subsidy: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* 应扣款项 - 根据格式显示不同字段 */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 text-red-600">应扣款项</h4>
              {normalizeLocation(newSalaryData.location) === 'office' ? (
                // 办公室格式：公积金、社会保险、社保养老调
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">公积金</Label>
                    <Input 
                      type="number"
                      value={newSalaryData.deduct_social_security || 0} 
                      onChange={e => setNewSalaryData({...newSalaryData, deduct_social_security: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">社会保险</Label>
                    <Input 
                      type="number"
                      value={newSalaryData.deduct_utilities || 0} 
                      onChange={e => setNewSalaryData({...newSalaryData, deduct_utilities: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>
              ) : (
                // 车间格式：扣社保、水电费
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">扣社保</Label>
                    <Input 
                      type="number"
                      value={newSalaryData.deduct_social_security || 0} 
                      onChange={e => setNewSalaryData({...newSalaryData, deduct_social_security: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">水电费</Label>
                    <Input 
                      type="number"
                      value={newSalaryData.deduct_utilities || 0} 
                      onChange={e => setNewSalaryData({...newSalaryData, deduct_utilities: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 应付合计和实发金额 */}
            <div className="border-t pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-medium text-blue-600">应付合计</Label>
                  <Input 
                    type="number"
                    value={newSalaryData.total_payable} 
                    onChange={e => setNewSalaryData({...newSalaryData, total_payable: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-medium text-green-600">实发金额</Label>
                  <Input 
                    type="number"
                    value={newSalaryData.actual_amount} 
                    onChange={e => setNewSalaryData({...newSalaryData, actual_amount: parseFloat(e.target.value) || 0})}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSalaryDialog(false)}>取消</Button>
            <Button onClick={handleAddSalary}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 签字图片查看弹窗 */}
      <Dialog open={!!viewingSignature} onOpenChange={() => setViewingSignature(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5" />
              员工签字
            </DialogTitle>
            <DialogDescription>
              {viewingSignature?.employeeName} 的签名
              {viewingSignature?.signTime && (
                <span className="ml-2 text-muted-foreground">
                  签字时间：{formatChinaDateTime(viewingSignature.signTime)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center p-4 bg-white rounded-lg border">
            {viewingSignature?.signature && (
              <img 
                src={viewingSignature.signature} 
                alt="员工签字" 
                className="max-w-full max-h-48 object-contain"
              />
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setViewingSignature(null)}>
              关闭
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
