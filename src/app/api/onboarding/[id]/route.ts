import { NextRequest, NextResponse } from 'next/server';
import { db, logOperationServer } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { normalizeOnboardingData, parseOnboardingRow, type OnboardingDbRow } from '@/lib/onboarding-records';

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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    return NextResponse.json({ success: true, record: parseOnboardingRow(row) });
  } catch (error) {
    console.error('Get onboarding record error:', error);
    return NextResponse.json({ success: false, error: '获取入职登记详情失败' }, { status: 500 });
  }
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

    const body = await request.json();
    const current = parseOnboardingRow(row);
    const data = normalizeOnboardingData({ ...current.data, ...(body?.data || {}) });

    if (!data.name.trim()) {
      return NextResponse.json({ success: false, error: '姓名不能为空' }, { status: 400 });
    }
    if (!data.phone.trim()) {
      return NextResponse.json({ success: false, error: '联系电话不能为空' }, { status: 400 });
    }
    if (!data.position.trim()) {
      return NextResponse.json({ success: false, error: '入职岗位不能为空' }, { status: 400 });
    }

    db.prepare(`
      UPDATE onboarding_records
      SET name = ?,
          gender = ?,
          phone = ?,
          id_card = ?,
          position = ?,
          department = ?,
          hire_date = ?,
          recruitment_source = ?,
          data_json = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
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
      id,
    );

    if (row.employee_id) {
      db.prepare(`
        UPDATE employees
        SET name = ?,
            phone = ?,
            id_card = ?,
            department = ?,
            position = ?,
            base_salary = ?,
            hire_date = ?
        WHERE id = ?
      `).run(
        data.name.trim(),
        data.phone.trim() || null,
        data.idCard.trim() || null,
        data.department.trim(),
        data.position.trim(),
        Number(data.probationSalary) || 0,
        data.hireDate || null,
        row.employee_id,
      );
    }

    logOperationServer({
      userId: user.id,
      userName: user.name || user.username,
      module: 'personnel',
      action: 'update',
      details: { onboardingId: id, employeeName: data.name, status: row.status },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    const updated = db.prepare('SELECT * FROM onboarding_records WHERE id = ?').get(id) as OnboardingDbRow;
    return NextResponse.json({ success: true, record: parseOnboardingRow(updated), message: '修改成功' });
  } catch (error) {
    console.error('Update onboarding record error:', error);
    return NextResponse.json({ success: false, error: '修改入职登记失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    db.prepare('DELETE FROM onboarding_records WHERE id = ?').run(id);

    logOperationServer({
      userId: user.id,
      userName: user.name || user.username,
      module: 'personnel',
      action: 'delete',
      details: { onboardingId: id, employeeName: record.name, status: record.status },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    return NextResponse.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('Delete onboarding record error:', error);
    return NextResponse.json({ success: false, error: '删除入职登记失败' }, { status: 500 });
  }
}
