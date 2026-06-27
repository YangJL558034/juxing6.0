import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/database';
import { parseLeaveRequestRow, type LeaveRequestDbRow } from '@/lib/leave-records';
import { buildLeaveRequestDocx } from '@/lib/leave-request-docx';
import { hasPermission } from '@/lib/permission-check';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

function safeFilePart(value: string) {
  return (value || '员工').replace(/[\\/:*?"<>|]/g, '_').trim() || '员工';
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    if (!hasPermission(user, 'personnel')) {
      return NextResponse.json({ success: false, error: '无权导出请假申请' }, { status: 403 });
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
      SET exported_at = datetime('now', '+8 hours'),
          updated_at = datetime('now', '+8 hours')
      WHERE id = ?
    `).run(id);

    const filename = `${safeFilePart(record.employeeName)}-请假申请单.docx`;
    const buffer = buildLeaveRequestDocx(record);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Export leave request error:', error);
    return NextResponse.json({ success: false, error: '导出请假申请单失败' }, { status: 500 });
  }
}
