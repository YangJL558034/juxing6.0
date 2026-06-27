import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/database';
import { parseLeaveRequestRow, type LeaveRequestDbRow } from '@/lib/leave-records';
import { hasPermission } from '@/lib/permission-check';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    if (!hasPermission(user, 'personnel')) {
      return NextResponse.json({ success: false, error: '无权审核请假申请' }, { status: 403 });
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

    const body = await request.json().catch(() => ({})) as { reviewerName?: string };
    const reviewerName = String(body.reviewerName || user.name || user.username || '').trim();

    db.prepare(`
      UPDATE leave_request_records
      SET status = '已审核',
          reviewer_name = ?,
          reviewed_at = datetime('now', '+8 hours'),
          updated_at = datetime('now', '+8 hours')
      WHERE id = ?
    `).run(reviewerName, id);

    const updated = db.prepare('SELECT * FROM leave_request_records WHERE id = ?')
      .get(id) as LeaveRequestDbRow;

    return NextResponse.json({
      success: true,
      record: parseLeaveRequestRow(updated),
      message: '请假申请审核完成',
    });
  } catch (error) {
    console.error('Review leave request error:', error);
    return NextResponse.json({ success: false, error: '审核请假申请失败' }, { status: 500 });
  }
}
