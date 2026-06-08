import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { normalizeDormitoryData, parseDormitoryRow, type DormitoryDbRow } from '@/lib/dormitory-records';
import type { DormitoryStatus } from '@/types/dormitory';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword')?.trim();
    const status = searchParams.get('status')?.trim();

    const where: string[] = [];
    const params: unknown[] = [];

    if (keyword) {
      where.push('(name LIKE ? OR phone LIKE ? OR id_card LIKE ? OR department LIKE ? OR position LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    if (status && status !== 'all') {
      where.push('status = ?');
      params.push(status);
    }

    const rows = db.prepare(`
      SELECT * FROM dormitory_records
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY created_at DESC, id DESC
    `).all(...params) as DormitoryDbRow[];

    const countsRows = db.prepare('SELECT status, COUNT(*) as count FROM dormitory_records GROUP BY status').all() as Array<{ status: DormitoryStatus; count: number }>;
    const totalRow = db.prepare('SELECT COUNT(*) as count FROM dormitory_records').get() as { count: number };
    const counts = {
      total: totalRow.count,
      pending: countsRows.find((item) => item.status === '待审核')?.count || 0,
      reviewed: countsRows.find((item) => item.status === '已审核')?.count || 0,
      checkedIn: countsRows.find((item) => item.status === '已入住')?.count || 0,
      checkedOut: countsRows.find((item) => item.status === '已退宿')?.count || 0,
    };

    return NextResponse.json({ success: true, records: rows.map(parseDormitoryRow), counts });
  } catch (error) {
    console.error('Get dormitory records error:', error);
    return NextResponse.json({ success: false, error: '获取住宿申请列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = normalizeDormitoryData(body?.data || body);

    if (!data.name) {
      return NextResponse.json({ success: false, error: '姓名不能为空' }, { status: 400 });
    }
    if (!data.phone) {
      return NextResponse.json({ success: false, error: '手机号不能为空' }, { status: 400 });
    }
    if (!data.department) {
      return NextResponse.json({ success: false, error: '所在部门不能为空' }, { status: 400 });
    }
    if (!data.position) {
      return NextResponse.json({ success: false, error: '职位不能为空' }, { status: 400 });
    }
    if (!data.idCard) {
      return NextResponse.json({ success: false, error: '身份证号不能为空' }, { status: 400 });
    }
    if (!data.expectedCheckInDate) {
      return NextResponse.json({ success: false, error: '安排入住日期不能为空' }, { status: 400 });
    }
    if (!data.reason) {
      return NextResponse.json({ success: false, error: '入住原因不能为空' }, { status: 400 });
    }
    if (!data.agreedToRules) {
      return NextResponse.json({ success: false, error: '请确认遵守宿舍管理条款' }, { status: 400 });
    }

    const result = db.prepare(`
      INSERT INTO dormitory_records (
        status, name, phone, department, position, id_card,
        expected_check_in_date, reason, data_json
      ) VALUES ('待审核', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.name,
      data.phone,
      data.department,
      data.position,
      data.idCard,
      data.expectedCheckInDate,
      data.reason,
      JSON.stringify(data),
    );

    return NextResponse.json({
      success: true,
      id: Number(result.lastInsertRowid),
      message: '住宿申请提交成功',
    });
  } catch (error) {
    console.error('Create dormitory record error:', error);
    return NextResponse.json({ success: false, error: '提交住宿申请失败' }, { status: 500 });
  }
}
