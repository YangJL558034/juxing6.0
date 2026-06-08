import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import type { DormitoryRoomResident } from '@/types/dormitory';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

function mapResident(row: {
  id: number;
  name: string;
  phone: string | null;
  department: string | null;
  position: string | null;
  bed_no: string | null;
  room_bed: string | null;
  key_issued: string | null;
  handler_name: string | null;
  checked_in_at: string | null;
}): DormitoryRoomResident {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    department: row.department,
    position: row.position,
    bedNo: row.bed_no,
    roomBed: row.room_bed,
    keyIssued: row.key_issued,
    handlerName: row.handler_name,
    checkedInAt: row.checked_in_at,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { id } = await params;
    const room = db.prepare('SELECT * FROM dormitory_rooms WHERE id = ?').get(id) as {
      id: number;
      room_no: string;
      capacity: number | null;
      remark: string | null;
    } | undefined;

    if (!room) {
      return NextResponse.json({ success: false, error: '房号不存在' }, { status: 404 });
    }

    const rows = db.prepare(`
      SELECT
        id,
        name,
        phone,
        department,
        position,
        bed_no,
        room_bed,
        key_issued,
        handler_name,
        checked_in_at
      FROM dormitory_records
      WHERE room_no = ? AND status = '已入住'
      ORDER BY bed_no ASC, checked_in_at ASC, id ASC
    `).all(room.room_no) as Array<Parameters<typeof mapResident>[0]>;

    return NextResponse.json({
      success: true,
      room: {
        id: room.id,
        roomNo: room.room_no,
        capacity: Number(room.capacity || 0),
        remark: room.remark,
      },
      residents: rows.map(mapResident),
    });
  } catch (error) {
    console.error('Get dormitory room residents error:', error);
    return NextResponse.json({ success: false, error: '获取房号入住详情失败' }, { status: 500 });
  }
}
