import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/database';
import {
  normalizeLeaveRequestData,
  parseLeaveRequestRow,
  type LeaveRequestDbRow,
} from '@/lib/leave-records';
import { hasPermission } from '@/lib/permission-check';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

function purgeExpiredDeletedLeaveRequests() {
  db.prepare(`
    DELETE FROM leave_request_records
    WHERE deleted_at IS NOT NULL
      AND deleted_at <= datetime('now', '+8 hours', '-7 days')
  `).run();
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    if (!hasPermission(user, 'personnel')) {
      return NextResponse.json({ success: false, error: '无权管理请假申请' }, { status: 403 });
    }

    const { id } = await context.params;
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return NextResponse.json({ success: false, error: '参数错误' }, { status: 400 });
    }

    const existing = db.prepare('SELECT * FROM leave_request_records WHERE id = ? AND deleted_at IS NULL')
      .get(numericId) as LeaveRequestDbRow | undefined;
    if (!existing) {
      return NextResponse.json({ success: false, error: '请假申请不存在' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const current = parseLeaveRequestRow(existing);
    const data = normalizeLeaveRequestData({
      ...current,
      ...body?.data,
    });

    if (!data.employeeName) {
      return NextResponse.json({ success: false, error: '员工姓名不能为空' }, { status: 400 });
    }
    if (!data.leaveStartDate || !/^\d{4}-\d{2}-\d{2}$/.test(data.leaveStartDate)) {
      return NextResponse.json({ success: false, error: '请选择正确的请假开始日期' }, { status: 400 });
    }
    if (!data.leaveEndDate || !/^\d{4}-\d{2}-\d{2}$/.test(data.leaveEndDate)) {
      return NextResponse.json({ success: false, error: '请选择正确的请假结束日期' }, { status: 400 });
    }
    if (data.leaveEndDate < data.leaveStartDate) {
      return NextResponse.json({ success: false, error: '请假结束日期不能早于开始日期' }, { status: 400 });
    }

    db.prepare(`
      UPDATE leave_request_records
      SET employee_name = ?,
          id_card = ?,
          phone = ?,
          department = ?,
          position = ?,
          leave_date = ?,
          leave_start_date = ?,
          leave_end_date = ?,
          duration = ?,
          half_day_period = ?,
          leave_type = ?,
          reason = ?,
          applicant_signature_data_url = ?,
          updated_at = datetime('now', '+8 hours')
      WHERE id = ?
    `).run(
      data.employeeName,
      data.idCard,
      data.phone,
      data.department,
      data.position,
      data.leaveStartDate,
      data.leaveStartDate,
      data.leaveEndDate,
      data.duration,
      data.duration === 'half' ? data.halfDayPeriod : '',
      data.leaveType,
      data.reason,
      data.applicantSignatureDataUrl || current.applicantSignatureDataUrl,
      numericId,
    );

    const updated = db.prepare('SELECT * FROM leave_request_records WHERE id = ?').get(numericId) as LeaveRequestDbRow;
    return NextResponse.json({
      success: true,
      record: parseLeaveRequestRow(updated),
      message: '请假申请已更改',
    });
  } catch (error) {
    console.error('Update leave request error:', error);
    return NextResponse.json({ success: false, error: '更改请假申请失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    purgeExpiredDeletedLeaveRequests();

    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    if (!hasPermission(user, 'personnel')) {
      return NextResponse.json({ success: false, error: '无权管理请假申请' }, { status: 403 });
    }

    const { id } = await context.params;
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return NextResponse.json({ success: false, error: '参数错误' }, { status: 400 });
    }

    const existing = db.prepare('SELECT id FROM leave_request_records WHERE id = ? AND deleted_at IS NULL').get(numericId);
    if (!existing) {
      return NextResponse.json({ success: false, error: '请假申请不存在' }, { status: 404 });
    }

    db.prepare("UPDATE leave_request_records SET deleted_at = datetime('now', '+8 hours'), updated_at = datetime('now', '+8 hours') WHERE id = ?").run(numericId);
    return NextResponse.json({ success: true, message: '请假申请已删除，7天后自动彻底清除' });
  } catch (error) {
    console.error('Delete leave request error:', error);
    return NextResponse.json({ success: false, error: '删除请假申请失败' }, { status: 500 });
  }
}
