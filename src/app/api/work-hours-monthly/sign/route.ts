import { NextRequest, NextResponse } from 'next/server';
import { db, query } from '@/lib/database';
import { verifyToken, type User } from '@/lib/auth';
import { hasPermission } from '@/lib/permission-check';

interface EmployeeLookup {
  id: number;
  name: string;
}

interface MonthlyRecordRow {
  id: number;
  employee_id: number;
  employee_name: string;
}

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

function findCurrentEmployee(user: User) {
  return db.prepare(`
    SELECT id, name
    FROM employees
    WHERE user_id = ?
       OR name = ?
       OR employee_id = ?
    ORDER BY CASE WHEN user_id = ? THEN 0 WHEN name = ? THEN 1 ELSE 2 END
    LIMIT 1
  `).get(user.id, user.name, user.username, user.id, user.name) as EmployeeLookup | undefined;
}

function findOwnMonthlyRecord(recordId: number, employee: EmployeeLookup) {
  return db.prepare(`
    SELECT w.id, w.employee_id, w.employee_name
    FROM work_hours_monthly w
    WHERE w.id = ?
      AND (
        w.employee_id = ?
        OR (
          w.employee_name = ?
          AND NOT EXISTS (
            SELECT 1 FROM employees linked_employee WHERE linked_employee.id = w.employee_id
          )
        )
      )
    LIMIT 1
  `).get(recordId, employee.id, employee.name) as MonthlyRecordRow | undefined;
}

function findMonthlyRecord(recordId: number) {
  return db.prepare(`
    SELECT id, employee_id, employee_name
    FROM work_hours_monthly
    WHERE id = ?
    LIMIT 1
  `).get(recordId) as MonthlyRecordRow | undefined;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const body = await request.json() as { recordId?: unknown; signature?: unknown };
    const recordId = Number(body.recordId);
    const signature = typeof body.signature === 'string' ? body.signature : '';

    if (!Number.isInteger(recordId) || recordId <= 0 || !signature.startsWith('data:image/')) {
      return NextResponse.json({ success: false, error: '参数错误' }, { status: 400 });
    }

    const canManageSalary = hasPermission(user, 'salary');
    const record = canManageSalary
      ? findMonthlyRecord(recordId)
      : findOwnMonthlyRecord(recordId, findCurrentEmployee(user) ?? { id: -1, name: '' });

    if (!record) {
      return NextResponse.json({ success: false, error: canManageSalary ? '工资记录不存在' : '只能签字确认本人工资' }, { status: canManageSalary ? 404 : 403 });
    }

    query.updateWorkHoursMonthlySignature.run(signature, recordId);
    const updatedRecord = db.prepare('SELECT * FROM work_hours_monthly WHERE id = ?').get(recordId);

    return NextResponse.json({ success: true, record: updatedRecord, message: '签字成功' });
  } catch (error) {
    console.error('Sign work hours error:', error);
    return NextResponse.json({ success: false, error: '签字失败' }, { status: 500 });
  }
}
