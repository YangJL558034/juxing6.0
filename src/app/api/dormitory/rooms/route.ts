import { NextRequest, NextResponse } from 'next/server';
import { db, logOperationServer } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import type { DormitoryRoom } from '@/types/dormitory';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

function mapRoom(row: {
  id: number;
  room_no: string;
  capacity: number | null;
  remark: string | null;
  bed_count: number | null;
  occupied_count: number | null;
  created_at: string;
  updated_at: string | null;
}): DormitoryRoom {
  const capacity = Number(row.capacity || 0);
  const bedCount = Number(row.bed_count || 0);
  const occupiedCount = Number(row.occupied_count || 0);
  const effectiveCapacity = capacity || bedCount;

  return {
    id: row.id,
    roomNo: row.room_no,
    capacity,
    remark: row.remark,
    bedCount,
    occupiedCount,
    isFull: effectiveCapacity > 0 && occupiedCount >= effectiveCapacity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const rows = db.prepare(`
      SELECT
        r.*,
        COUNT(DISTINCT b.id) as bed_count,
        COUNT(DISTINCT CASE WHEN dr.status = '已入住' THEN dr.id END) as occupied_count
      FROM dormitory_rooms r
      LEFT JOIN dormitory_beds b ON b.room_id = r.id
      LEFT JOIN dormitory_records dr ON dr.room_no = r.room_no AND dr.status = '已入住'
      GROUP BY r.id
      ORDER BY r.room_no ASC
    `).all() as Array<Parameters<typeof mapRoom>[0]>;

    return NextResponse.json({ success: true, rooms: rows.map(mapRoom) });
  } catch (error) {
    console.error('Get dormitory rooms error:', error);
    return NextResponse.json({ success: false, error: '获取房号失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const roomNo = String(body?.roomNo || '').trim();
    const capacity = Math.max(0, Number(body?.capacity || 0));
    const remark = String(body?.remark || '').trim();

    if (!roomNo) {
      return NextResponse.json({ success: false, error: '请填写房号' }, { status: 400 });
    }

    const exists = db.prepare('SELECT id FROM dormitory_rooms WHERE room_no = ?').get(roomNo);
    if (exists) {
      return NextResponse.json({ success: false, error: '房号已存在' }, { status: 400 });
    }

    db.prepare(`
      INSERT INTO dormitory_rooms (room_no, capacity, remark)
      VALUES (?, ?, ?)
    `).run(roomNo, capacity, remark);

    logOperationServer({
      userId: user.id,
      userName: user.name || user.username,
      module: 'administration',
      action: 'create-room',
      details: { roomNo, capacity },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    return NextResponse.json({ success: true, message: '房号添加成功' });
  } catch (error) {
    console.error('Create dormitory room error:', error);
    return NextResponse.json({ success: false, error: '添加房号失败' }, { status: 500 });
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
      return NextResponse.json({ success: false, error: '缺少房号ID' }, { status: 400 });
    }

    const room = db.prepare('SELECT * FROM dormitory_rooms WHERE id = ?').get(id) as { room_no: string } | undefined;
    if (!room) {
      return NextResponse.json({ success: false, error: '房号不存在' }, { status: 404 });
    }

    const occupied = db.prepare(`
      SELECT COUNT(*) as count FROM dormitory_records
      WHERE room_no = ? AND status IN ('已审核', '已入住')
    `).get(room.room_no) as { count: number };
    if (occupied.count > 0) {
      return NextResponse.json({ success: false, error: '该房间已有住宿记录，不能删除' }, { status: 400 });
    }

    db.prepare('DELETE FROM dormitory_beds WHERE room_id = ?').run(id);
    db.prepare('DELETE FROM dormitory_rooms WHERE id = ?').run(id);

    logOperationServer({
      userId: user.id,
      userName: user.name || user.username,
      module: 'administration',
      action: 'delete-room',
      details: { roomId: id, roomNo: room.room_no },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    return NextResponse.json({ success: true, message: '房号删除成功' });
  } catch (error) {
    console.error('Delete dormitory room error:', error);
    return NextResponse.json({ success: false, error: '删除房号失败' }, { status: 500 });
  }
}
