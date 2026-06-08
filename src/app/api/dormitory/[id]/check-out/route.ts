import { NextRequest, NextResponse } from 'next/server';
import { db, logOperationServer } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { parseDormitoryRow, type DormitoryDbRow } from '@/lib/dormitory-records';

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
    const body = await request.json();
    const checkoutApplyDate = String(body?.checkoutApplyDate || '').trim();
    const moveOutDate = String(body?.moveOutDate || '').trim();
    const checkoutReason = String(body?.checkoutReason || '').trim();
    const keyReturned = String(body?.keyReturned || '').trim();
    const checkoutHandlerName = String(body?.checkoutHandlerName || '').trim();

    if (!checkoutApplyDate) {
      return NextResponse.json({ success: false, error: '请选择申请日期' }, { status: 400 });
    }
    if (!moveOutDate) {
      return NextResponse.json({ success: false, error: '请选择搬出日期' }, { status: 400 });
    }
    if (!checkoutReason) {
      return NextResponse.json({ success: false, error: '请填写搬出原因' }, { status: 400 });
    }
    if (!keyReturned) {
      return NextResponse.json({ success: false, error: '请填写归还几把钥匙' }, { status: 400 });
    }
    if (!checkoutHandlerName) {
      return NextResponse.json({ success: false, error: '请填写行政经办人' }, { status: 400 });
    }

    const row = db.prepare('SELECT * FROM dormitory_records WHERE id = ?').get(id) as DormitoryDbRow | undefined;
    if (!row) {
      return NextResponse.json({ success: false, error: '住宿申请不存在' }, { status: 404 });
    }

    const record = parseDormitoryRow(row);
    if (record.status !== '已入住') {
      return NextResponse.json({ success: false, error: '只有已入住记录可以办理退宿舍' }, { status: 400 });
    }

    db.prepare(`
      UPDATE dormitory_records
      SET status = '已退宿',
          checkout_apply_date = ?,
          move_out_date = ?,
          checkout_reason = ?,
          key_returned = ?,
          checkout_handler_name = ?,
          checked_out_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(checkoutApplyDate, moveOutDate, checkoutReason, keyReturned, checkoutHandlerName, id);

    logOperationServer({
      userId: user.id,
      userName: user.name || user.username,
      module: 'administration',
      action: 'check-out',
      details: { dormitoryId: id, employeeName: record.name, roomNo: record.roomNo, bedNo: record.bedNo, keyReturned },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    const updated = db.prepare('SELECT * FROM dormitory_records WHERE id = ?').get(id) as DormitoryDbRow;
    return NextResponse.json({ success: true, record: parseDormitoryRow(updated), message: '退宿舍办理完成' });
  } catch (error) {
    console.error('Check out dormitory record error:', error);
    return NextResponse.json({ success: false, error: '办理退宿舍失败' }, { status: 500 });
  }
}
