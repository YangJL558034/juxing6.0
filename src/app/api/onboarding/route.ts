import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { normalizeOnboardingData, parseOnboardingRow, type OnboardingDbRow } from '@/lib/onboarding-records';
import type { OnboardingStatus } from '@/types/onboarding';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

function sourceText(data: ReturnType<typeof normalizeOnboardingData>) {
  const source = data.recruitmentSource[0] || '';
  const other = data.otherRecruitmentSource.trim();
  if (source === '其他') return other ? `其他：${other}` : '其他';
  return source;
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
    const source = searchParams.get('source')?.trim();

    const where: string[] = [];
    const params: unknown[] = [];

    if (keyword) {
      where.push('(name LIKE ? OR phone LIKE ? OR id_card LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    if (status && status !== 'all') {
      where.push('status = ?');
      params.push(status);
    }
    if (source && source !== 'all') {
      where.push('recruitment_source LIKE ?');
      params.push(`%${source}%`);
    }

    const sql = `
      SELECT * FROM onboarding_records
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY created_at DESC, id DESC
    `;

    const rows = db.prepare(sql).all(...params) as OnboardingDbRow[];
    const records = rows.map(parseOnboardingRow);
    const countsRows = db.prepare('SELECT status, COUNT(*) as count FROM onboarding_records GROUP BY status').all() as Array<{ status: OnboardingStatus; count: number }>;
    const totalRow = db.prepare('SELECT COUNT(*) as count FROM onboarding_records').get() as { count: number };
    const counts = {
      total: totalRow.count,
      pending: countsRows.find((item) => item.status === '待审核')?.count || 0,
      reviewed: countsRows.find((item) => item.status === '已审核')?.count || 0,
      resigned: countsRows.find((item) => item.status === '已离职')?.count || 0,
    };

    return NextResponse.json({ success: true, records, counts });
  } catch (error) {
    console.error('Get onboarding records error:', error);
    return NextResponse.json({ success: false, error: '获取入职登记列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = normalizeOnboardingData(body?.data || body);

    if (!data.name.trim()) {
      return NextResponse.json({ success: false, error: '姓名不能为空' }, { status: 400 });
    }
    if (!data.phone.trim()) {
      return NextResponse.json({ success: false, error: '联系电话不能为空' }, { status: 400 });
    }
    if (!data.idCard.trim()) {
      return NextResponse.json({ success: false, error: '身份证号不能为空' }, { status: 400 });
    }
    if (!data.position.trim()) {
      return NextResponse.json({ success: false, error: '入职岗位不能为空' }, { status: 400 });
    }
    if (!data.signatureDataUrl.trim()) {
      return NextResponse.json({ success: false, error: '请完成电子签名' }, { status: 400 });
    }

    const result = db.prepare(`
      INSERT INTO onboarding_records (
        status, name, gender, phone, id_card, position, department, hire_date,
        recruitment_source, data_json
      ) VALUES ('待审核', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.name.trim(),
      data.gender,
      data.phone.trim(),
      data.idCard.trim(),
      data.position.trim(),
      data.department.trim(),
      data.hireDate || null,
      sourceText(data),
      JSON.stringify(data),
    );

    return NextResponse.json({
      success: true,
      id: Number(result.lastInsertRowid),
      message: '入职登记提交成功',
    });
  } catch (error) {
    console.error('Create onboarding record error:', error);
    return NextResponse.json({ success: false, error: '提交入职登记失败' }, { status: 500 });
  }
}
