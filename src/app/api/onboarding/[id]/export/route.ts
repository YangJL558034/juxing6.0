import { NextRequest, NextResponse } from 'next/server';
import { db, logOperationServer } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { parseOnboardingRow, type OnboardingDbRow } from '@/lib/onboarding-records';
import { buildOnboardingDocx } from '@/lib/onboarding-docx';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
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

    const record = parseOnboardingRow(row);
    if (record.status === '待审核') {
      return NextResponse.json({ success: false, error: '请先完成人事审核，审核后才能导出和打印' }, { status: 400 });
    }

    const docx = buildOnboardingDocx(record);
    const body = docx.buffer.slice(docx.byteOffset, docx.byteOffset + docx.byteLength) as ArrayBuffer;
    const filename = `${record.name || '员工'}-入职登记表.docx`;

    logOperationServer({
      userId: user.id,
      userName: user.name || user.username,
      module: 'personnel',
      action: 'export',
      details: { onboardingId: id, employeeName: record.name },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Export onboarding record error:', error);
    return NextResponse.json({ success: false, error: '导出入职登记表失败' }, { status: 500 });
  }
}
