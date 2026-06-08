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
    const reviewerName = String(body?.reviewerName || '').trim();
    const reviewOpinion = String(body?.reviewOpinion || '同意住宿。').trim() || '同意住宿。';
    const roomNo = String(body?.roomNo || '').trim();
    const bedNo = String(body?.bedNo || '').trim();
    const roomBed = roomNo && bedNo ? `${roomNo}-${bedNo}` : '';
    const keyIssued = String(body?.keyIssued || '').trim();

    if (!reviewerName) {
      return NextResponse.json({ success: false, error: '请填写审核人姓名' }, { status: 400 });
    }
    if (!roomNo) {
      return NextResponse.json({ success: false, error: '请选择房号' }, { status: 400 });
    }
    if (!bedNo) {
      return NextResponse.json({ success: false, error: '请选择床号' }, { status: 400 });
    }
    if (!keyIssued) {
      return NextResponse.json({ success: false, error: '请填写领用几把钥匙' }, { status: 400 });
    }

    const row = db.prepare('SELECT * FROM dormitory_records WHERE id = ?').get(id) as DormitoryDbRow | undefined;
    if (!row) {
      return NextResponse.json({ success: false, error: '住宿申请不存在' }, { status: 404 });
    }

    const record = parseDormitoryRow(row);
    if (record.status !== '待审核') {
      return NextResponse.json({ success: false, error: '只有待审核记录可以审核' }, { status: 400 });
    }

    const bed = db.prepare(`
      SELECT b.id FROM dormitory_beds b
      JOIN dormitory_rooms r ON r.id = b.room_id
      WHERE r.room_no = ? AND b.bed_no = ?
    `).get(roomNo, bedNo);
    if (!bed) {
      return NextResponse.json({ success: false, error: '该房号下不存在这个床号' }, { status: 400 });
    }

    const occupied = db.prepare(`
      SELECT id, name FROM dormitory_records
      WHERE room_no = ?
        AND bed_no = ?
        AND id <> ?
        AND status IN ('已审核', '已入住')
      LIMIT 1
    `).get(roomNo, bedNo, id) as { id: number; name: string } | undefined;
    if (occupied) {
      return NextResponse.json({ success: false, error: `该床位已分配给 ${occupied.name}` }, { status: 400 });
    }

    db.prepare(`
      UPDATE dormitory_records
      SET status = '已审核',
          reviewer_name = ?,
          review_opinion = ?,
          room_no = ?,
          bed_no = ?,
          room_bed = ?,
          key_issued = ?,
          reviewed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(reviewerName, reviewOpinion, roomNo, bedNo, roomBed, keyIssued, id);

    logOperationServer({
      userId: user.id,
      userName: user.name || user.username,
      module: 'administration',
      action: 'review',
      details: { dormitoryId: id, employeeName: record.name, reviewerName, roomNo, bedNo, keyIssued },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    const updated = db.prepare('SELECT * FROM dormitory_records WHERE id = ?').get(id) as DormitoryDbRow;
    return NextResponse.json({ success: true, record: parseDormitoryRow(updated), message: '审核完成' });
  } catch (error) {
    console.error('Review dormitory record error:', error);
    return NextResponse.json({ success: false, error: '审核住宿申请失败' }, { status: 500 });
  }
}
