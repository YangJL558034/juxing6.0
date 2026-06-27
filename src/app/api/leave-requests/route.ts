import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/database';
import {
  normalizeLeaveRequestData,
  parseLeaveRequestRow,
  type LeaveRequestDbRow,
} from '@/lib/leave-records';
import { isCompleteIdCard, isCompleteMainlandMobile, normalizeIdCard, normalizeMobile } from '@/lib/identity-validation';
import { hasPermission } from '@/lib/permission-check';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

function purgeExpiredDeletedLeaveRequests() {
  db.prepare(`
    DELETE FROM leave_request_records
    WHERE deleted_at IS NOT NULL
      AND deleted_at <= datetime('now', '+8 hours', '-7 days')
  `).run();
}

interface EmployeeRow {
  id: number;
  name: string;
  id_card: string | null;
  phone: string | null;
  department: string | null;
  position: string | null;
  status: string | null;
}

function findEmployeeByNameAndIdCard(employeeName: string, idCard: string) {
  const candidates = db.prepare(`
    SELECT id, name, id_card, phone, department, position, status
    FROM employees
    WHERE name = ?
  `).all(employeeName) as EmployeeRow[];

  const normalizedIdCard = normalizeIdCard(idCard);

  return candidates.find(employee =>
    normalizeIdCard(employee.id_card || '') === normalizedIdCard
  ) || null;
}

function getEmployee(employeeId: number | null) {
  if (!employeeId) return null;
  return db.prepare('SELECT id, name, id_card, phone, department, position, status FROM employees WHERE id = ?').get(employeeId) as {
    id: number;
    name: string;
    id_card: string | null;
    phone: string | null;
    department: string | null;
    position: string | null;
    status: string | null;
  } | null;
}

export async function GET(request: NextRequest) {
  try {
    purgeExpiredDeletedLeaveRequests();

    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year')?.trim();
    const month = searchParams.get('month')?.trim();
    const keyword = searchParams.get('keyword')?.trim();
    const status = searchParams.get('status')?.trim();
    const approved = searchParams.get('approved') === '1';
    const includeDeleted = searchParams.get('includeDeleted') === '1';
    const onlyDeleted = searchParams.get('deleted') === '1';
    const canManagePersonnel = hasPermission(user, 'personnel');
    const canReadApprovedForSalary = approved && hasPermission(user, 'salary');
    if (!canManagePersonnel && !canReadApprovedForSalary) {
      return NextResponse.json({ success: false, error: '无权查看请假申请' }, { status: 403 });
    }
    if (!canManagePersonnel && (includeDeleted || onlyDeleted || status || keyword)) {
      return NextResponse.json({ success: false, error: '无权查看请假申请' }, { status: 403 });
    }

    const where: string[] = [];
    const params: unknown[] = [];

    if (onlyDeleted) {
      where.push('deleted_at IS NOT NULL');
    } else if (!includeDeleted) {
      where.push('deleted_at IS NULL');
    }

    if (year && month) {
      const normalizedMonth = month.padStart(2, '0');
      const daysInMonth = new Date(Number(year), Number(normalizedMonth), 0).getDate();
      where.push(`
        COALESCE(leave_start_date, leave_date) <= ?
        AND COALESCE(leave_end_date, leave_start_date, leave_date) >= ?
      `);
      params.push(`${year}-${normalizedMonth}-${String(daysInMonth).padStart(2, '0')}`, `${year}-${normalizedMonth}-01`);
    } else if (year) {
      where.push(`
        COALESCE(leave_start_date, leave_date) <= ?
        AND COALESCE(leave_end_date, leave_start_date, leave_date) >= ?
      `);
      params.push(`${year}-12-31`, `${year}-01-01`);
    }

    if (keyword) {
      where.push('(employee_name LIKE ? OR id_card LIKE ? OR phone LIKE ? OR department LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    if (approved) {
      where.push("status = '已审核'");
    } else if (status && status !== 'all') {
      where.push('status = ?');
      params.push(status);
    }

    const rows = db.prepare(`
      SELECT *
      FROM leave_request_records
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY leave_date DESC, created_at DESC, id DESC
    `).all(...params) as LeaveRequestDbRow[];

    return NextResponse.json({ success: true, records: rows.map(parseLeaveRequestRow) });
  } catch (error) {
    console.error('Get leave requests error:', error);
    return NextResponse.json({ success: false, error: '获取请假申请失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = normalizeLeaveRequestData(body?.data || body);

    if (!data.employeeName) {
      return NextResponse.json({ success: false, error: '请填写员工姓名' }, { status: 400 });
    }
    if (!isCompleteIdCard(data.idCard)) {
      return NextResponse.json({ success: false, error: '身份证号码必须填写完整且格式正确' }, { status: 400 });
    }
    if (data.phone && !isCompleteMainlandMobile(data.phone)) {
      return NextResponse.json({ success: false, error: '手机号格式不正确，请输入11位手机号' }, { status: 400 });
    }

    const employee = data.employeeId ? getEmployee(data.employeeId) : findEmployeeByNameAndIdCard(data.employeeName, data.idCard);
    const employeeMatches = employee
      && employee.name === data.employeeName
      && normalizeIdCard(employee.id_card || '') === normalizeIdCard(data.idCard);

    if (!employeeMatches) {
      return NextResponse.json({ success: false, error: '姓名和身份证必须与员工档案完全一致' }, { status: 400 });
    }
    if (String(employee.status || '').includes('离职')) {
      return NextResponse.json({ success: false, error: '该员工已离职，不能提交请假申请' }, { status: 400 });
    }

    if (!data.leaveStartDate || !/^\d{4}-\d{2}-\d{2}$/.test(data.leaveStartDate)) {
      return NextResponse.json({ success: false, error: '请选择正确的请假开始日期' }, { status: 400 });
    }
    if (!data.leaveEndDate || !/^\d{4}-\d{2}-\d{2}$/.test(data.leaveEndDate)) {
      return NextResponse.json({ success: false, error: '请选择正确的请假结束日期' }, { status: 400 });
    }
    if (data.leaveEndDate < data.leaveStartDate) {
      return NextResponse.json({ success: false, error: '请假结束日期不能早于开始日期' }, { status: 400 });
    }
    if (!data.applicantSignatureDataUrl) {
      return NextResponse.json({ success: false, error: '请完成手写签名' }, { status: 400 });
    }
    if (!data.applicantSignatureDataUrl.startsWith('data:image/')) {
      return NextResponse.json({ success: false, error: '手写签名格式不正确' }, { status: 400 });
    }

    const result = db.prepare(`
      INSERT INTO leave_request_records (
        status, employee_id, employee_name, id_card, phone, department, position,
        leave_date, leave_start_date, leave_end_date, duration, half_day_period, leave_type, reason,
        applicant_signature_data_url, created_by_name
      ) VALUES ('待审核', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      employee.id,
      employee.name,
      normalizeIdCard(employee.id_card || data.idCard),
      data.phone ? normalizeMobile(data.phone) : (employee.phone || ''),
      employee.department || data.department,
      employee.position || data.position,
      data.leaveStartDate,
      data.leaveStartDate,
      data.leaveEndDate,
      data.duration,
      data.duration === 'half' ? data.halfDayPeriod : '',
      data.leaveType,
      data.reason,
      data.applicantSignatureDataUrl,
      employee.name,
    );

    const row = db.prepare('SELECT * FROM leave_request_records WHERE id = ?')
      .get(result.lastInsertRowid) as LeaveRequestDbRow;

    return NextResponse.json({
      success: true,
      record: parseLeaveRequestRow(row),
      message: '请假申请提交成功，等待后台审核',
    });
  } catch (error) {
    console.error('Create leave request error:', error);
    return NextResponse.json({ success: false, error: '保存请假申请失败' }, { status: 500 });
  }
}
