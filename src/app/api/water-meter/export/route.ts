import { NextRequest, NextResponse } from 'next/server';
import { db, logOperationServer } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { buildWaterMeterRecordsXlsx } from '@/lib/water-meter-xlsx';
import { parseWaterMeterRow, type WaterMeterDbRow } from '@/lib/water-meter-records';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const roomNo = searchParams.get('roomNo')?.trim();
    const month = searchParams.get('month')?.trim();

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ success: false, error: '请选择要导出的月份' }, { status: 400 });
    }

    const where: string[] = [];
    const params: unknown[] = [];

    if (roomNo && roomNo !== 'all') {
      where.push('room_no = ?');
      params.push(roomNo);
    }
    where.push('reading_date LIKE ?');
    params.push(`${month}-%`);

    const rows = db.prepare(`
      SELECT *
      FROM water_meter_records
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY room_no ASC, reading_date ASC, id ASC
    `).all(...params) as WaterMeterDbRow[];

    const records = rows.map(parseWaterMeterRow);
    const xlsx = buildWaterMeterRecordsXlsx(records, month);
    const body = xlsx.buffer.slice(xlsx.byteOffset, xlsx.byteOffset + xlsx.byteLength) as ArrayBuffer;
    const filename = `水表记录-${month}.xlsx`;

    logOperationServer({
      userId: user.id,
      userName: user.name || user.username,
      module: 'administration',
      action: 'export-water-meter',
      details: { roomNo: roomNo || 'all', month, count: records.length },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Export water meter records error:', error);
    return NextResponse.json({ success: false, error: '导出水表记录失败' }, { status: 500 });
  }
}
