import { NextRequest, NextResponse } from 'next/server';
import { db, logOperationServer } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { parseOnboardingRow, type OnboardingDbRow } from '@/lib/onboarding-records';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { id } = await params;
    const row = db.prepare('SELECT * FROM onboarding_records WHERE id = ?').get(id) as OnboardingDbRow | undefined;
    if (!row) {
      return NextResponse.json({ success: false, error: '入职登记不存在' }, { status: 404 });
    }

    const record = parseOnboardingRow(row);
    if (record.status === '待审核') {
      return NextResponse.json({ success: false, error: '待审核记录不能直接设为已离职' }, { status: 400 });
    }

    db.prepare(`
      UPDATE onboarding_records
      SET status = '已离职',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    if (record.employeeId) {
      const resignDate = new Date().toISOString().slice(0, 10);
      db.prepare(`
        UPDATE employees
        SET status = '离职',
            resign_date = COALESCE(resign_date, ?)
        WHERE id = ?
      `).run(resignDate, record.employeeId);
    }

    logOperationServer({
      userId: user.id,
      userName: user.name || user.username,
      module: 'personnel',
      action: 'resign',
      details: { onboardingId: id, employeeName: record.name, employeeId: record.employeeId },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    const updated = db.prepare('SELECT * FROM onboarding_records WHERE id = ?').get(id) as OnboardingDbRow;
    return NextResponse.json({ success: true, record: parseOnboardingRow(updated), message: '已设为离职' });
  } catch (error) {
    console.error('Resign onboarding record error:', error);
    return NextResponse.json({ success: false, error: '设置离职失败' }, { status: 500 });
  }
}
