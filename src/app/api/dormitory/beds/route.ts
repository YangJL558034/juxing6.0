import { NextRequest, NextResponse } from 'next/server';
import { db, logOperationServer } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import type { DormitoryBed } from '@/types/dormitory';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

function mapBed(row: {
  id: number;
  room_id: number;
  room_no: string;
  bed_no: string;
  occupied_record_id: number | null;
  occupied_by_name: string | null;
  created_at: string;
}): DormitoryBed {
  return {
    id: row.id,
    roomId: row.room_id,
    roomNo: row.room_no,
    bedNo: row.bed_no,
    occupiedRecordId: row.occupied_record_id,
    occupiedByName: row.occupied_by_name,
    createdAt: row.created_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    const params: unknown[] = [];
    const where = roomId ? 'WHERE b.room_id = ?' : '';
    if (roomId) params.push(roomId);

    const rows = db.prepare(`
      SELECT
        b.id,
        b.room_id,
        r.room_no,
        b.bed_no,
        dr.id as occupied_record_id,
        dr.name as occupied_by_name,
        b.created_at
      FROM dormitory_beds b
      JOIN dormitory_rooms r ON r.id = b.room_id
      LEFT JOIN dormitory_records dr
        ON dr.room_no = r.room_no
       AND dr.bed_no = b.bed_no
       AND dr.status = '已入住'
      ${where}
      ORDER BY r.room_no ASC, b.bed_no ASC
    `).all(...params) as Array<Parameters<typeof mapBed>[0]>;

    return NextResponse.json({ success: true, beds: rows.map(mapBed) });
  } catch (error) {
    console.error('Get dormitory beds error:', error);
    return NextResponse.json({ success: false, error: '获取床号失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const roomId = Number(body?.roomId || 0);
    const bedNo = String(body?.bedNo || '').trim();

    if (!roomId) {
      return NextResponse.json({ success: false, error: '请选择房号' }, { status: 400 });
    }
    if (!bedNo) {
      return NextResponse.json({ success: false, error: '请填写床号' }, { status: 400 });
    }

    const room = db.prepare('SELECT * FROM dormitory_rooms WHERE id = ?').get(roomId) as { room_no: string } | undefined;
    if (!room) {
      return NextResponse.json({ success: false, error: '房号不存在' }, { status: 404 });
    }

    const exists = db.prepare('SELECT id FROM dormitory_beds WHERE room_id = ? AND bed_no = ?').get(roomId, bedNo);
    if (exists) {
      return NextResponse.json({ success: false, error: '该房间床号已存在' }, { status: 400 });
    }

    db.prepare('INSERT INTO dormitory_beds (room_id, bed_no) VALUES (?, ?)').run(roomId, bedNo);

    logOperationServer({
      userId: user.id,
      userName: user.name || user.username,
      module: 'administration',
      action: 'create-bed',
      details: { roomId, roomNo: room.room_no, bedNo },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    return NextResponse.json({ success: true, message: '床号添加成功' });
  } catch (error) {
    console.error('Create dormitory bed error:', error);
    return NextResponse.json({ success: false, error: '添加床号失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: '缺少床号ID' }, { status: 400 });
    }

    const bed = db.prepare(`
      SELECT b.*, r.room_no FROM dormitory_beds b
      JOIN dormitory_rooms r ON r.id = b.room_id
      WHERE b.id = ?
    `).get(id) as { room_no: string; bed_no: string } | undefined;
    if (!bed) {
      return NextResponse.json({ success: false, error: '床号不存在' }, { status: 404 });
    }

    const occupied = db.prepare(`
      SELECT COUNT(*) as count FROM dormitory_records
      WHERE room_no = ? AND bed_no = ? AND status IN ('已审核', '已入住')
    `).get(bed.room_no, bed.bed_no) as { count: number };
    if (occupied.count > 0) {
      return NextResponse.json({ success: false, error: '该床号已有住宿记录，不能删除' }, { status: 400 });
    }

    db.prepare('DELETE FROM dormitory_beds WHERE id = ?').run(id);

    logOperationServer({
      userId: user.id,
      userName: user.name || user.username,
      module: 'administration',
      action: 'delete-bed',
      details: { bedId: id, roomNo: bed.room_no, bedNo: bed.bed_no },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    return NextResponse.json({ success: true, message: '床号删除成功' });
  } catch (error) {
    console.error('Delete dormitory bed error:', error);
    return NextResponse.json({ success: false, error: '删除床号失败' }, { status: 500 });
  }
}
