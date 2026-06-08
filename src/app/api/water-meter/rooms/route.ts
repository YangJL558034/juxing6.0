import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { parseWaterMeterRoom } from '@/lib/water-meter-records';

export async function GET() {
  try {
    const rows = db.prepare(`
      SELECT
        r.room_no,
        r.capacity,
        latest.current_reading as latest_reading,
        latest.current_reading_text as latest_reading_text,
        latest.reading_date as latest_reading_date
      FROM dormitory_rooms r
      LEFT JOIN water_meter_records latest
        ON latest.id = (
          SELECT id
          FROM water_meter_records
          WHERE room_no = r.room_no
          ORDER BY reading_date DESC, id DESC
          LIMIT 1
        )
      ORDER BY r.room_no ASC
    `).all() as Array<Parameters<typeof parseWaterMeterRoom>[0]>;

    return NextResponse.json({ success: true, rooms: rows.map(parseWaterMeterRoom) });
  } catch (error) {
    console.error('Get water meter rooms error:', error);
    return NextResponse.json({ success: false, error: '获取房号失败' }, { status: 500 });
  }
}
