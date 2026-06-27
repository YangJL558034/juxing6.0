import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/database';
import { parseLeaveRequestRow, type LeaveRequestDbRow } from '@/lib/leave-records';
import { buildLeaveRequestPrintHtml } from '@/lib/leave-request-document';
import { hasPermission } from '@/lib/permission-check';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    if (!hasPermission(user, 'personnel')) {
      return NextResponse.json({ success: false, error: '无权打印请假申请' }, { status: 403 });
    }

    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ success: false, error: '参数错误' }, { status: 400 });
    }

    const row = db.prepare('SELECT * FROM leave_request_records WHERE id = ? AND deleted_at IS NULL')
      .get(id) as LeaveRequestDbRow | undefined;
    if (!row) {
      return NextResponse.json({ success: false, error: '请假申请不存在或已删除' }, { status: 404 });
    }

    const record = parseLeaveRequestRow(row);
    if (record.status !== '已审核') {
      return NextResponse.json({ success: false, error: '请先审核请假申请，再导出或打印' }, { status: 400 });
    }

    db.prepare(`
      UPDATE leave_request_records
      SET printed_at = datetime('now', '+8 hours'),
          updated_at = datetime('now', '+8 hours')
      WHERE id = ?
    `).run(id);

    return new NextResponse(buildLeaveRequestPrintHtml(record), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Print leave request error:', error);
    return NextResponse.json({ success: false, error: '打印请假申请单失败' }, { status: 500 });
  }
}
