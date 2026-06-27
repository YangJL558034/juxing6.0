import { NextRequest, NextResponse } from 'next/server';
import { db, query } from '@/lib/database';
import { verifyToken, type User } from '@/lib/auth';
import { normalizeIdCard, normalizeMobile } from '@/lib/identity-validation';

interface EmployeeRow {
  id: number;
  name: string;
  id_card: string | null;
  phone: string | null;
  department: string | null;
  position: string | null;
  status: string | null;
}

function findCurrentEmployee(user: User) {
  return db.prepare(`
    SELECT
      e.id,
      e.name,
      e.id_card,
      e.phone,
      COALESCE(d.name, d_text.name, e.department) as department,
      e.position,
      e.status
    FROM employees e
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN departments d_text ON CAST(d_text.id AS TEXT) = e.department
    WHERE e.user_id = ?
       OR e.name = ?
       OR e.employee_id = ?
    ORDER BY CASE WHEN e.user_id = ? THEN 0 WHEN e.name = ? THEN 1 ELSE 2 END
    LIMIT 1
  `).get(user.id, user.name, user.username, user.id, user.name) as EmployeeRow | undefined;
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const tokenUser = await verifyToken(token);
    if (!tokenUser) {
      return NextResponse.json({ success: false, error: '登录已过期' }, { status: 401 });
    }

    const currentUser = (query.findUserById.get(tokenUser.id) as User | undefined) || tokenUser;
    const employee = findCurrentEmployee(currentUser);

    return NextResponse.json({
      success: true,
      user: {
        id: currentUser.id,
        name: currentUser.name,
        username: currentUser.username,
        department: currentUser.department || '',
      },
      employee: employee ? {
        id: employee.id,
        name: employee.name,
        idCard: normalizeIdCard(employee.id_card || ''),
        phone: normalizeMobile(employee.phone || ''),
        department: employee.department || currentUser.department || '',
        position: employee.position || '',
        status: employee.status || '',
      } : null,
    });
  } catch (error) {
    console.error('Get current leave employee error:', error);
    return NextResponse.json({ success: false, error: '获取员工信息失败' }, { status: 500 });
  }
}
