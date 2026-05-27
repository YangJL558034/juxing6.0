'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { 
  Search, 
  Clock, 
  Timer, 
  Wallet,
  User,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Edit2,
  Plus,
  Trash2,
  Maximize2,
  Minimize2,
  X
} from 'lucide-react';
import { logOperation, LogModules, LogActions } from '@/lib/log';

interface Employee {
  id: number;
  name: string;
  id_card: string;
  phone: string;
  department: string;
  position: string;
  base_salary: number;
  status: string;
  location: string;
}

interface AttendanceRecord {
  id: number;
  employee_id: number;
  employee_name: string;
  date: string;
  time: string;
  location: string;
  created_at: string;
}

interface SalaryRecord {
  id: number;
  employee_id: number;
  employee_name: string;
  month: string;
  year: number;
  month_num: number;
  base_salary: number;
  normal_hours: number;
  weekday_overtime: number;
  weekend_overtime: number;
  normal_pay: number;
  weekday_overtime_pay: number;
  weekend_overtime_pay: number;
  living_subsidy: number;
  seniority_award: number;
  full_attendance_award: number;
  position_subsidy: number;
  social_security_subsidy: number;
  total_payable: number;
  deduct_social_security: number;
  deduct_utilities: number;
  total_deduction: number;
  actual_amount: number;
  signature?: string;
  signature_time?: string;
  location: string;
  bank_account?: string;
  remark?: string;
  department?: string;
  employee_code?: string;
  // 办公室格式扣除项
  housing_fund?: number;
  social_insurance?: number;
  social_pension_adj?: number;
  // 办公室格式考勤字段
  should_attend_days?: number;
  saturday_days?: number;
  actual_attend_days?: number;
  paid_leave_days?: number;
  holiday_overtime?: number;
  holiday_pay?: number;
  holiday_overtime_pay?: number;
  // 办公室格式收入字段
  performance_bonus?: number;
  meal_subsidy?: number;
  housing_subsidy?: number;
  transport_subsidy?: number;
  other_subsidy?: number;
  fine?: number;
  other_deduction?: number;
  deduct_loan?: number;
  deduct_urgent?: number;
  deduct_other?: number;
  pre_tax_salary?: number;
  income_tax?: number;
}

// 获取星期几
const getWeekday = (year: number, month: number, day: number): string => {
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return weekdays[new Date(year, month - 1, day).getDay()];
};

// 判断是否周末
const isWeekend = (year: number, month: number, day: number): boolean => {
  const dayOfWeek = new Date(year, month - 1, day).getDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
};

// 获取月份天数
const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month, 0).getDate();
};

// 工时计算函数 - 处理多个打卡时间
const calculateWorkHours = (times: string[], isWeekendDay: boolean) => {
  if (!times || times.length === 0) return { normalHours: 0, overtimeHours: 0, totalHours: 0, firstTime: '', lastTime: '' };
  
  // 解析时间字符串为分钟数
  const parseTime = (timeStr: string): number | null => {
    const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return parseInt(match[1]) * 60 + parseInt(match[2]);
  };
  
  // 过滤并解析有效时间
  const validTimes = times
    .map(t => t.replace(/\(.*\)/, '').trim()) // 移除备注
    .filter(t => /^\d{1,2}:\d{2}$/.test(t))
    .map(t => parseTime(t))
    .filter(t => t !== null) as number[];
  
  if (validTimes.length === 0) return { normalHours: 0, overtimeHours: 0, totalHours: 0, firstTime: '', lastTime: '' };
  
  validTimes.sort((a, b) => a - b);
  const firstTime = validTimes[0];
  const lastTime = validTimes[validTimes.length - 1];
  
  // 格式化时间
  const formatTime = (minutes: number): string => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };
  
  // 时间点定义（分钟数）
  const WORK_START = 8 * 60;        // 8:00
  const LUNCH_START = 12 * 60;      // 12:00
  const LUNCH_END = 13.5 * 60;      // 13:30
  const WORK_END = 17.5 * 60;       // 17:30
  const DINNER_END = 18 * 60;       // 18:00
  
  // 计算正班工时（8:00-12:00 + 13:30-17:30）
  // 周末也按正常班计算
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
  
  return {
    normalHours: Math.max(0, normalMinutes / 60),
    overtimeHours: Math.max(0, overtimeMinutes / 60),
    totalHours: Math.max(0, (normalMinutes + overtimeMinutes) / 60),
    firstTime: formatTime(firstTime),
    lastTime: formatTime(lastTime)
  };
};

// 格式化工时显示
const formatWorkHours = (hours: number): string => {
  if (!hours || hours === 0) return '0';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}小时`;
  if (h === 0) return `${m}分钟`;
  return `${h}小时${m}分`;
};

export default function EmployeeQueryPage() {
  const [name, setName] = useState('');
  const [idCard, setIdCard] = useState('');
  const [searched, setSearched] = useState(false);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // 筛选状态
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth() + 1).padStart(2, '0'));
  
  // 签字相关
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [signRecordId, setSignRecordId] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleSearch = async () => {
    if (!name.trim() || !idCard.trim()) {
      alert('请输入姓名和身份证号');
      return;
    }
    
    setLoading(true);
    setNotFound(false);
    
    try {
      const response = await fetch(`/api/employees/query?name=${encodeURIComponent(name.trim())}&idCard=${encodeURIComponent(idCard.trim())}`);
      const data = await response.json();
      
      if (data.success && data.employee) {
        setEmployee(data.employee);
        setSalaryRecords(data.salaryRecords || []);
        setSearched(true);
        
        // 记录查询日志
        logOperation({
          module: LogModules.EMPLOYEE_QUERY,
          action: LogActions.VIEW,
          details: {
            queryName: name.trim(),
            queryIdCard: idCard.trim().replace(/(\d{6})\d{8}(\d{4})/, '$1********$2'), // 脱敏身份证
            employeeId: data.employee.id,
            employeeName: data.employee.name,
          },
          userId: data.employee.id,
          userName: data.employee.name,
        });
        
        // 自动选择最新有数据的月份
        const records = data.salaryRecords || [];
        if (records.length > 0) {
          const latestRecord = records.reduce((a: any, b: any) => 
            (b.year * 12 + b.month_num) > (a.year * 12 + a.month_num) ? b : a
          );
          setSelectedYear(String(latestRecord.year));
          setSelectedMonth(String(latestRecord.month_num).padStart(2, '0'));
        }
        
        // API 已返回解析好的打卡记录
        console.log('API返回打卡记录:', data.attendanceRecords?.length || 0, '条');
        setAttendanceRecords(data.attendanceRecords || []);
      } else {
        setEmployee(null);
        setAttendanceRecords([]);
        setSalaryRecords([]);
        setNotFound(true);
        setSearched(true);
      }
    } catch (error) {
      console.error('查询失败:', error);
      alert('查询失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 获取打卡数据按月份分组
  const attendanceByMonth = useMemo(() => {
    const grouped: Record<string, AttendanceRecord[]> = {};
    attendanceRecords.forEach(record => {
      const monthKey = record.date.substring(0, 7); // YYYY-MM
      if (!grouped[monthKey]) grouped[monthKey] = [];
      grouped[monthKey].push(record);
    });
    return grouped;
  }, [attendanceRecords]);

  // 获取某月某天的打卡记录
  const getDayAttendance = (monthKey: string, day: number): AttendanceRecord[] => {
    const dateStr = `${monthKey}-${String(day).padStart(2, '0')}`;
    return attendanceRecords
      .filter(r => r.date === dateStr)
      .sort((a, b) => a.time.localeCompare(b.time));
  };

  // 获取月份最大打卡次数
  const getMaxAttendanceCount = (monthKey: string): number => {
    const days = getDaysInMonth(parseInt(monthKey.split('-')[0]), parseInt(monthKey.split('-')[1]));
    let maxCount = 0;
    for (let d = 1; d <= days; d++) {
      const count = getDayAttendance(monthKey, d).length;
      if (count > maxCount) maxCount = count;
    }
    return Math.max(maxCount, 1);
  };

  // 计算工时数据
  const workHoursData = useMemo(() => {
    const year = parseInt(selectedYear);
    const month = parseInt(selectedMonth);
    const days = getDaysInMonth(year, month);
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    
    const data = [];
    for (let d = 1; d <= days; d++) {
      const dateStr = `${monthKey}-${String(d).padStart(2, '0')}`;
      const dayRecords = attendanceRecords
        .filter(r => r.date === dateStr)
        .sort((a, b) => a.time.localeCompare(b.time));
      
      // 获取所有打卡时间
      const allTimes = dayRecords.map(r => r.time);
      const weekend = isWeekend(year, month, d);
      
      const { normalHours, overtimeHours, totalHours, firstTime, lastTime } = calculateWorkHours(allTimes, weekend);
      
      if (allTimes.length > 0) {
        data.push({
          date: dateStr,
          weekday: getWeekday(year, month, d),
          allTimes, // 所有打卡时间
          checkInTime: firstTime,
          checkOutTime: lastTime,
          normalHours,
          overtimeHours,
          totalHours,
          isWeekend: weekend
        });
      }
    }
    return data;
  }, [selectedYear, selectedMonth, attendanceRecords]);

  // 筛选工资数据
  const filteredSalaryRecords = useMemo(() => {
    const year = parseInt(selectedYear);
    const month = parseInt(selectedMonth);
    return salaryRecords.filter(r => r.year === year && r.month_num === month);
  }, [selectedYear, selectedMonth, salaryRecords]);

  // 全屏切换函数
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // 监听全屏状态变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // 签字函数
  const openSignDialog = (recordId: number) => {
    setSignRecordId(recordId);
    setSignDialogOpen(true);
    setIsFullscreen(false);
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const rect = canvas.getBoundingClientRect();
          const dpr = window.devicePixelRatio || 1;
          canvas.width = rect.width * dpr;
          canvas.height = rect.height * dpr;
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
        }
      }
    }, 150);
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const submitSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let hasSignature = false;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) {
        hasSignature = true;
        break;
      }
    }
    
    if (!hasSignature) {
      alert('请先签名');
      return;
    }
    
    const signature = canvas.toDataURL('image/png');
    
    try {
      const response = await fetch('/api/salary/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: signRecordId,
          signature,
        })
      });
      
      const result = await response.json();
      if (result.success) {
        logOperation({
          module: LogModules.EMPLOYEE_QUERY,
          action: LogActions.SIGN,
          details: {
            recordId: signRecordId,
            employeeName: employee?.name,
            month: `${selectedYear}-${selectedMonth}`,
            type: 'salary',
          },
          userId: employee?.id,
          userName: employee?.name,
        });
        
        alert('签字成功！');
        setSignDialogOpen(false);
        handleSearch();
      } else {
        alert(result.error || '签字失败');
      }
    } catch (error) {
      console.error('签字失败:', error);
      alert('签字失败，请稍后重试');
    }
  };

  // 年月选项
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 21 }, (_, i) => String(currentYear - 10 + i));
  const monthOptions = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* 顶部导航栏 - 毛玻璃效果 */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <h1 className="text-lg sm:text-xl font-bold text-center text-slate-800">员工自助查询</h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-3 sm:p-4">
        {/* 搜索卡片 */}
        <Card className="shadow-lg border-0">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1 block">姓名</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="请输入姓名"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10 text-sm sm:text-base"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1 block">身份证号</label>
                  <Input
                    placeholder="请输入身份证号"
                    value={idCard}
                    onChange={(e) => setIdCard(e.target.value)}
                    className="text-sm sm:text-base"
                  />
                </div>
              </div>
              <Button 
                onClick={handleSearch} 
                className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto sm:px-8"
                disabled={loading || !name.trim() || !idCard.trim() || idCard.trim().length < 15}
              >
                <Search className="h-4 w-4 mr-2" />
                {loading ? '查询中...' : '查询'}
              </Button>
              {!idCard.trim() || idCard.trim().length < 15 ? (
                <p className="text-xs text-amber-600 mt-1">请输入完整的身份证号后查询</p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* 未找到提示 */}
        {notFound && (
          <Card className="mt-4 border-red-200 bg-red-50">
            <CardContent className="p-4 text-center">
              <p className="text-red-600">未找到员工信息，请确认姓名和身份证号是否正确</p>
            </CardContent>
          </Card>
        )}

        {/* 查询结果 */}
        {searched && employee && (
          <>
            {/* 员工信息 */}
            <Card className="mt-4 border-0 shadow">
              <CardContent className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-slate-500">姓名</p>
                    <p className="font-semibold text-slate-800">{employee.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">身份证号</p>
                    <p className="font-semibold text-slate-800">{employee.id_card || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">部门</p>
                    <p className="font-semibold text-slate-800">{employee.department || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">位置</p>
                    <p className="font-semibold text-slate-800">{employee.location || '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 三大手风琴模块 */}
            <Accordion type="single" collapsible className="mt-4 space-y-2">
              {/* 打卡记录 */}
              <AccordionItem value="attendance" className="border-0 bg-white rounded-lg shadow px-3 sm:px-4">
                <AccordionTrigger className="hover:no-underline py-3 sm:py-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg">
                      <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                    </div>
                    <span className="font-semibold text-slate-800 text-sm sm:text-base">打卡记录</span>
                    <span className="text-xs sm:text-sm text-slate-500">({attendanceRecords.length}条)</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {Object.keys(attendanceByMonth).length === 0 ? (
                    <p className="text-center text-slate-500 py-8">暂无打卡记录</p>
                  ) : (
                    <Accordion type="single" collapsible className="space-y-2">
                      {Object.keys(attendanceByMonth).sort().reverse().map(monthKey => {
                        const [y, m] = monthKey.split('-').map(Number);
                        const days = getDaysInMonth(y, m);
                        const maxCount = getMaxAttendanceCount(monthKey);
                        
                        return (
                          <AccordionItem key={monthKey} value={monthKey} className="border border-slate-200 rounded-lg px-2">
                            <AccordionTrigger className="hover:no-underline py-2">
                              <span className="font-medium">{y}年{m}月</span>
                              <span className="text-sm text-slate-500 ml-2">
                                ({attendanceByMonth[monthKey].length}条打卡)
                              </span>
                            </AccordionTrigger>
                            <AccordionContent>
                              {/* 滑动提示 */}
                              <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mb-2">
                                <ChevronLeft className="h-3 w-3" />
                                <span>左右滑动查看</span>
                                <ChevronRight className="h-3 w-3" />
                              </div>
                              {/* 打卡网格 */}
                              <div className="overflow-x-auto border border-blue-200 rounded-lg">
                                <table className="min-w-max text-xs">
                                  <thead>
                                    <tr className="bg-slate-50">
                                      <th className="sticky left-0 z-10 bg-slate-50 p-2 border border-blue-200 min-w-[40px]">#</th>
                                      {Array.from({ length: days }, (_, i) => i + 1).map(day => (
                                        <th key={day} className={`p-2 border border-blue-200 min-w-[60px] ${isWeekend(y, m, day) ? 'bg-yellow-50' : ''}`}>
                                          <div>{day}</div>
                                          <div className="text-slate-400">{getWeekday(y, m, day)}</div>
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {Array.from({ length: maxCount }, (_, i) => i + 1).map(row => (
                                      <tr key={row}>
                                        <td className="sticky left-0 z-10 bg-white p-2 border border-blue-200 text-center font-medium">
                                          第{row}次
                                        </td>
                                        {Array.from({ length: days }, (_, i) => i + 1).map(day => {
                                          const records = getDayAttendance(monthKey, day);
                                          const record = records[row - 1];
                                          const time = record?.time;
                                          const fullDate = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                          // 检查是否有备注（括号内容）
                                          const hasNote = time && time.includes('（');
                                          const displayTime = time ? time.substring(0, 5) : '';
                                          
                                          return (
                                            <td 
                                              key={day} 
                                              className={`p-1.5 border border-blue-200 text-center ${isWeekend(y, m, day) ? 'bg-yellow-50' : ''}`}
                                            >
                                              {time ? (
                                                <div className="flex flex-col items-center">
                                                  <span className={hasNote ? 'text-blue-600 font-medium' : ''}>{displayTime}</span>
                                                  {hasNote && (
                                                    <span className="text-[10px] text-blue-500 truncate max-w-[50px]">
                                                      {time.match(/（(.+?)）/)?.[1]?.substring(0, 4)}
                                                    </span>
                                                  )}
                                                </div>
                                              ) : (
                                                <span className="text-slate-300">-</span>
                                              )}
                                            </td>
                                          );
                                        })}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* 工时 */}
              <AccordionItem value="workhours" className="border-0 bg-white rounded-lg shadow px-3 sm:px-4">
                <AccordionTrigger className="hover:no-underline py-3 sm:py-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
                      <Timer className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                    </div>
                    <span className="font-semibold text-slate-800 text-sm sm:text-base">工时</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {/* 筛选栏 */}
                  <div className="flex flex-wrap gap-2 items-center mb-3 sm:mb-4">
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                      <SelectTrigger className="w-20 sm:w-24 h-8 sm:h-10 text-xs sm:text-sm">
                        <SelectValue placeholder="年" />
                      </SelectTrigger>
                      <SelectContent>
                        {yearOptions.map(y => (
                          <SelectItem key={y} value={y} className="text-xs sm:text-sm">{y}年</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                      <SelectTrigger className="w-20 sm:w-24 h-8 sm:h-10 text-xs sm:text-sm">
                        <SelectValue placeholder="月" />
                      </SelectTrigger>
                      <SelectContent>
                        {monthOptions.map(m => (
                          <SelectItem key={m} value={m} className="text-xs sm:text-sm">{parseInt(m)}月</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" className="h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3">
                      查询
                    </Button>
                  </div>
                  
                  {/* 工时表格 */}
                  {workHoursData.length === 0 ? (
                    <p className="text-center text-slate-500 py-6 sm:py-8 text-sm">暂无工时记录</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-slate-400 mb-1 sm:mb-2">
                        <ChevronLeft className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        <span>左右滑动查看</span>
                        <ChevronRight className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                      </div>
                      <div className="overflow-x-auto border rounded-lg -mx-3 sm:mx-0">
                        <table className="min-w-full text-[11px] sm:text-sm">
                          <thead>
                            <tr className="bg-slate-50">
                              <th className="p-1.5 sm:p-2 border text-left whitespace-nowrap">日期</th>
                              <th className="p-1.5 sm:p-2 border text-left">星期</th>
                              <th className="p-1.5 sm:p-2 border text-left whitespace-nowrap">打卡记录</th>
                              <th className="p-1.5 sm:p-2 border text-left">上班</th>
                              <th className="p-1.5 sm:p-2 border text-left">下班</th>
                              <th className="p-1.5 sm:p-2 border text-left">正班</th>
                              <th className="p-1.5 sm:p-2 border text-left">加班</th>
                              <th className="p-1.5 sm:p-2 border text-left">合计</th>
                            </tr>
                          </thead>
                          <tbody>
                            {workHoursData.map((row, i) => (
                              <tr key={i} className={row.isWeekend ? 'bg-yellow-50' : ''}>
                                <td className="p-1.5 sm:p-2 border whitespace-nowrap">{row.date}</td>
                                <td className="p-1.5 sm:p-2 border">{row.weekday}</td>
                                <td className="p-1.5 sm:p-2 border text-xs text-slate-600">
                                  <div className="flex flex-wrap gap-1">
                                    {row.allTimes.map((t: string, idx: number) => (
                                      <span key={idx} className={`px-1 rounded ${idx === 0 || idx === row.allTimes.length - 1 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100'}`}>
                                        {t}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="p-1.5 sm:p-2 border">{row.checkInTime || '-'}</td>
                                <td className="p-1.5 sm:p-2 border">{row.checkOutTime || '-'}</td>
                                <td className="p-1.5 sm:p-2 border text-blue-600">{formatWorkHours(row.normalHours)}</td>
                                <td className="p-1.5 sm:p-2 border text-orange-600">{formatWorkHours(row.overtimeHours)}</td>
                                <td className="p-1.5 sm:p-2 border font-medium">{formatWorkHours(row.totalHours)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {/* 汇总 */}
                      <div className="mt-3 sm:mt-4 grid grid-cols-3 gap-2 sm:gap-4">
                        <div className="bg-blue-50 rounded-lg p-2 sm:p-3 text-center">
                          <p className="text-sm sm:text-lg font-bold text-blue-600">
                            {formatWorkHours(workHoursData.reduce((s, r) => s + r.normalHours, 0))}
                          </p>
                          <p className="text-[10px] sm:text-xs text-slate-500">正班工时</p>
                        </div>
                        <div className="bg-orange-50 rounded-lg p-2 sm:p-3 text-center">
                          <p className="text-sm sm:text-lg font-bold text-orange-600">
                            {formatWorkHours(workHoursData.reduce((s, r) => s + r.overtimeHours, 0))}
                          </p>
                          <p className="text-[10px] sm:text-xs text-slate-500">加班工时</p>
                        </div>
                        <div className="bg-green-50 rounded-lg p-2 sm:p-3 text-center">
                          <p className="text-sm sm:text-lg font-bold text-green-600">
                            {formatWorkHours(workHoursData.reduce((s, r) => s + r.totalHours, 0))}
                          </p>
                          <p className="text-[10px] sm:text-xs text-slate-500">总工时</p>
                        </div>
                      </div>
                    </>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* 工资 - 新卡片样式 */}
              <AccordionItem value="salary" className="border-0 bg-white rounded-lg shadow px-4 sm:px-6">
                <AccordionTrigger className="hover:no-underline py-4 sm:py-5">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-2 sm:p-2.5 bg-orange-100 rounded-lg">
                      <Wallet className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                    </div>
                    <span className="font-semibold text-slate-800 text-base sm:text-lg">工资</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {/* 筛选栏 */}
                  <div className="flex flex-wrap gap-2 sm:gap-3 items-center mb-4 sm:mb-5">
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                      <SelectTrigger className="w-20 sm:w-28 h-9 sm:h-10 text-sm sm:text-base">
                        <SelectValue placeholder="年" />
                      </SelectTrigger>
                      <SelectContent>
                        {yearOptions.map(y => (
                          <SelectItem key={y} value={y} className="text-sm sm:text-base">{y}年</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                      <SelectTrigger className="w-20 sm:w-28 h-9 sm:h-10 text-sm sm:text-base">
                        <SelectValue placeholder="月" />
                      </SelectTrigger>
                      <SelectContent>
                        {monthOptions.map(m => (
                          <SelectItem key={m} value={m} className="text-sm sm:text-base">{parseInt(m)}月</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="default" variant="outline" className="h-9 sm:h-10 text-sm sm:text-base px-4 sm:px-5">查询</Button>
                  </div>
                  
                  {/* 工资卡片列表 */}
                  {filteredSalaryRecords.length === 0 ? (
                    <p className="text-center text-slate-500 py-8 sm:py-10 text-base">暂无工资记录</p>
                  ) : (
                    <div className="space-y-4">
                      {filteredSalaryRecords.map((record) => {
                        const isOffice = record.location !== '车间';
                        return (
                          <div key={record.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                            {/* 顶部标题栏 */}
                            <div className="bg-slate-50 px-4 py-3 flex items-center justify-between">
                              <div>
                                <h3 className="font-semibold text-slate-800">山泽{record.year}年{record.month_num}月份工资条</h3>
                                <p className="text-sm text-slate-500">{record.employee_name}</p>
                              </div>
                              <div className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 ${
                                record.signature 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-gray-100 text-gray-500'
                              }`}>
                                {record.signature && <span className="text-green-600">✓</span>}
                                {record.signature ? '已确认' : '待确认'}
                              </div>
                            </div>
                            
                            <div className="px-4 py-2 text-xs text-slate-400 border-b">
                              请及时确认 如有疑问请联系财务部
                            </div>
                            
                            {/* 基础信息 */}
                            <div className="p-4 space-y-2 border-b border-slate-100">
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-500">序号</span>
                                <span className="text-slate-800">{record.id}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-500">部门</span>
                                <span className="text-slate-800">{record.department || '-'}</span>
                              </div>
                              {record.base_salary > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-500">基本工资</span>
                                  <span className="text-slate-800">¥{record.base_salary?.toLocaleString() ?? "0"}</span>
                                </div>
                              )}
                            </div>
                            
                            {/* 考勤记录 */}
                            <div className="p-4 border-b border-slate-100">
                              <p className="text-xs text-slate-400 mb-3">考勤记录</p>
                              <div className="space-y-2">
                                {(record.should_attend_days ?? 0) > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">正班应出勤天数</span>
                                    <span className="text-slate-800">{record.should_attend_days}天</span>
                                  </div>
                                )}
                                {(record.saturday_days ?? 0) > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">当月周六天数</span>
                                    <span className="text-slate-800">{record.saturday_days}天</span>
                                  </div>
                                )}
                                {(record.actual_attend_days ?? 0) > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">正班实际出勤天数</span>
                                    <span className="text-slate-800">{record.actual_attend_days}天</span>
                                  </div>
                                )}
                                {(record.paid_leave_days ?? 0) > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">本月已休带薪假</span>
                                    <span className="text-slate-800">{record.paid_leave_days}天</span>
                                  </div>
                                )}
                                {(record.weekday_overtime ?? 0) > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">平时加班时间</span>
                                    <span className="text-slate-800">{record.weekday_overtime}小时</span>
                                  </div>
                                )}
                                {(record.weekend_overtime ?? 0) > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">周末加班时间</span>
                                    <span className="text-slate-800">{record.weekend_overtime}小时</span>
                                  </div>
                                )}
                                {(record.holiday_overtime ?? 0) > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">法定日加班</span>
                                    <span className="text-slate-800">{record.holiday_overtime}天</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* 基本工资+补贴项目 */}
                            <div className="p-4 border-b border-slate-100">
                              <p className="text-xs text-slate-400 mb-3">基本工资+补贴项目</p>
                              <div className="space-y-2">
                                {(record.normal_pay ?? 0) > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">实际出勤工资</span>
                                    <span className="text-blue-600 font-medium">¥{(record.normal_pay ?? 0).toLocaleString()}</span>
                                  </div>
                                )}
                                {(record.holiday_pay ?? 0) > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">本月法定日休假工资</span>
                                    <span className="text-blue-600 font-medium">¥{(record.holiday_pay ?? 0).toLocaleString()}</span>
                                  </div>
                                )}
                                {(record.weekday_overtime_pay ?? 0) > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">平时加班工资</span>
                                    <span className="text-blue-600 font-medium">¥{record.weekday_overtime_pay?.toLocaleString() ?? "0"}</span>
                                  </div>
                                )}
                                {(record.weekend_overtime_pay ?? 0) > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">周未加班工资</span>
                                    <span className="text-blue-600 font-medium">¥{record.weekend_overtime_pay?.toLocaleString() ?? "0"}</span>
                                  </div>
                                )}
                                {(record.holiday_overtime_pay ?? 0) > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">法定日加班工资</span>
                                    <span className="text-blue-600 font-medium">¥{record.holiday_overtime_pay?.toLocaleString() ?? "0"}</span>
                                  </div>
                                )}
                                {(record.performance_bonus ?? 0) > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">绩效奖金</span>
                                    <span className="text-blue-600 font-medium">¥{record.performance_bonus?.toLocaleString() ?? "0"}</span>
                                  </div>
                                )}
                                {(record.meal_subsidy ?? 0) > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">用餐补贴</span>
                                    <span className="text-blue-600 font-medium">¥{(record.meal_subsidy ?? 0).toLocaleString()}</span>
                                  </div>
                                )}
                                {(record.housing_subsidy ?? 0) > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">住房补贴</span>
                                    <span className="text-blue-600 font-medium">¥{record.housing_subsidy?.toLocaleString() ?? "0"}</span>
                                  </div>
                                )}
                                {(record.transport_subsidy ?? 0) > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">交通补贴</span>
                                    <span className="text-blue-600 font-medium">¥{(record.transport_subsidy ?? 0).toLocaleString()}</span>
                                  </div>
                                )}
                                {(record.position_subsidy ?? 0) > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">岗位补贴</span>
                                    <span className="text-blue-600 font-medium">¥{(record.position_subsidy ?? 0).toLocaleString()}</span>
                                  </div>
                                )}
                                {(record.living_subsidy ?? 0) > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">生活补贴</span>
                                    <span className="text-blue-600 font-medium">¥{(record.living_subsidy ?? 0).toLocaleString()}</span>
                                  </div>
                                )}
                                {(record.other_subsidy ?? 0) > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">补贴</span>
                                    <span className="text-blue-600 font-medium">¥{record.other_subsidy?.toLocaleString() ?? "0"}</span>
                                  </div>
                                )}
                                {/* 应领工资 */}
                                {(record.total_payable ?? 0) > 0 && (
                                  <div className="flex justify-between text-sm font-semibold border-t border-slate-100 pt-2 mt-2">
                                    <span className="text-slate-700">应领工资</span>
                                    <span className="text-blue-600">¥{record.total_payable?.toLocaleString() ?? "0"}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* 应扣项目 */}
                            <div className="p-4 border-b border-slate-100">
                              <p className="text-xs text-slate-400 mb-3">应扣项目</p>
                              <div className="space-y-2">
                                {(record.housing_fund ?? 0) > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">公积金</span>
                                    <span className="text-red-500">¥{(record.housing_fund ?? 0).toLocaleString()}</span>
                                  </div>
                                )}
                                {(record.social_insurance ?? 0) > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">社会保险</span>
                                    <span className="text-red-500">¥{record.social_insurance?.toLocaleString() ?? "0"}</span>
                                  </div>
                                )}
                                {(record.social_pension_adj ?? 0) > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">社保养老调</span>
                                    <span className="text-red-500">¥{record.social_pension_adj?.toLocaleString() ?? "0"}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* 底部汇总 */}
                            <div className="p-4 bg-slate-50">
                              <div className="space-y-2">
                                {(record.social_security_subsidy ?? 0) > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">社保补贴</span>
                                    <span className="text-blue-600 font-medium">¥{(record.social_security_subsidy ?? 0).toLocaleString()}</span>
                                  </div>
                                )}
                                {(record.pre_tax_salary ?? 0) > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">税前工资</span>
                                    <span className="text-slate-800">¥{record.pre_tax_salary?.toLocaleString() ?? "0"}</span>
                                  </div>
                                )}
                                {(record.income_tax ?? 0) > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">个人所得税</span>
                                    <span className="text-red-500">¥{(record.income_tax ?? 0).toLocaleString()}</span>
                                  </div>
                                )}
                                {(record.seniority_award ?? 0) > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">工龄奖</span>
                                    <span className="text-slate-800">¥{(record.seniority_award ?? 0).toLocaleString()}</span>
                                  </div>
                                )}
                                {(record.full_attendance_award ?? 0) > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">全勤奖</span>
                                    <span className="text-slate-800">¥{(record.full_attendance_award ?? 0).toLocaleString()}</span>
                                  </div>
                                )}
                                {(record.living_subsidy ?? 0) > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">生活补贴</span>
                                    <span className="text-slate-800">¥{(record.living_subsidy ?? 0).toLocaleString()}</span>
                                  </div>
                                )}
                                {(record.deduct_utilities ?? 0) > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">本月水电费</span>
                                    <span className="text-red-500">¥{(record.deduct_utilities ?? 0).toLocaleString()}</span>
                                  </div>
                                )}
                                {(record.total_deduction ?? 0) > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">应扣合计</span>
                                    <span className="text-red-500">¥{(record.total_deduction ?? 0).toLocaleString()}</span>
                                  </div>
                                )}
                                {(record.deduct_social_security ?? 0) !== 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">社保扣款</span>
                                    <span className="text-red-500">¥{Math.abs(record.deduct_social_security ?? 0).toLocaleString()}</span>
                                  </div>
                                )}
                                {(record.deduct_loan ?? 0) !== 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">贷款扣款</span>
                                    <span className="text-red-500">¥{Math.abs(record.deduct_loan ?? 0).toLocaleString()}</span>
                                  </div>
                                )}
                                {(record.deduct_urgent ?? 0) !== 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">急扣</span>
                                    <span className="text-red-500">¥{Math.abs(record.deduct_urgent ?? 0).toLocaleString()}</span>
                                  </div>
                                )}
                                {(record.deduct_other ?? 0) !== 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">其他扣除</span>
                                    <span className="text-red-500">¥{Math.abs(record.deduct_other ?? 0).toLocaleString()}</span>
                                  </div>
                                )}
                                {(record.fine ?? 0) !== 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">扣款</span>
                                    <span className="text-red-500">¥{Math.abs(record.fine ?? 0).toLocaleString()}</span>
                                  </div>
                                )}
                                {(record.other_deduction ?? 0) !== 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">其他扣款</span>
                                    <span className="text-red-500">¥{Math.abs(record.other_deduction ?? 0).toLocaleString()}</span>
                                  </div>
                                )}
                                {/* 实发工资 */}
                                {(record.actual_amount ?? 0) > 0 && (
                                  <div className="flex justify-between text-base font-bold border-t border-slate-200 pt-2 mt-2">
                                    <span className="text-slate-800">实发工资</span>
                                    <span className="text-green-600">¥{record.actual_amount?.toLocaleString() ?? "0"}</span>
                                  </div>
                                )}
                                {/* 银行卡号 */}
                                {record.bank_account && (
                                  <div className="flex justify-between text-sm mt-3">
                                    <span className="text-slate-500">银行卡号</span>
                                    <span className="text-slate-700 text-right max-w-[60%] break-all">{record.bank_account}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* 签字区域 */}
                            <div className="px-4 py-3 border-t flex items-center justify-between">
                              {record.signature ? (
                                <div className="flex items-center gap-3">
                                  <img src={record.signature} alt="签字" className="h-12 border rounded" />
                                  <div className="text-xs text-slate-400">
                                    <p>已签字确认</p>
                                    {record.signature_time && <p>{new Date(record.signature_time).toLocaleDateString()}</p>}
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p className="text-xs text-slate-400">请在下方画板签名确认工资明细</p>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => openSignDialog(record.id)}
                                    className="h-8 text-xs"
                                  >
                                    签字确认
                                  </Button>
                                </>
                              )}
                            </div>
                            
                            {/* 备注 */}
                            {record.remark && (
                              <div className="px-4 py-2 bg-amber-50 border-t border-amber-100">
                                <p className="text-xs text-amber-700">备注：{record.remark}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </>
        )}

        {/* 签字对话框 */}
        {signDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setSignDialogOpen(false)} />
            <div className="relative z-10 w-full h-full max-w-2xl bg-white flex flex-col shadow-2xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
                <div>
                  <h3 className="text-base font-semibold">确认签字</h3>
                  <p className="text-xs text-slate-500">请在下方画板签名确认工资明细</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleFullscreen}
                    className="p-2 rounded-lg border border-slate-300 hover:bg-slate-100 transition-colors"
                    title={isFullscreen ? '退出全屏' : '全屏'}
                  >
                    {isFullscreen ? <Minimize2 className="h-5 w-5 text-slate-600" /> : <Maximize2 className="h-5 w-5 text-slate-600" />}
                  </button>
                  <button
                    onClick={() => setSignDialogOpen(false)}
                    className="p-2 rounded-lg border border-slate-300 hover:bg-slate-100 transition-colors"
                  >
                    <X className="h-5 w-5 text-slate-600" />
                  </button>
                </div>
              </div>
              <div className="flex-1 flex flex-col p-4 bg-gray-50">
                <div className="flex-1 border-2 border-dashed border-slate-300 rounded-lg bg-white overflow-hidden">
                  <canvas
                    ref={canvasRef}
                    className="w-full h-full cursor-crosshair touch-none"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={(e) => { e.preventDefault(); startDrawing(e); }}
                    onTouchMove={(e) => { e.preventDefault(); draw(e); }}
                    onTouchEnd={stopDrawing}
                  />
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={clearSignature}
                    className="flex-1 min-h-[48px] px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                  >
                    <RotateCcw className="h-4 w-4" />
                    清除
                  </button>
                  <button
                    onClick={submitSignature}
                    className="flex-1 min-h-[48px] px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                  >
                    确认签字
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 底部说明 */}
        <div className="mt-6 text-center text-slate-400 text-sm">
          <p>如有问题请联系人事部门</p>
        </div>
      </div>
    </div>
  );
}
