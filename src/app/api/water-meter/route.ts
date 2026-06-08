import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { parseWaterMeterRow, round2, type WaterMeterDbRow } from '@/lib/water-meter-records';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

function listRecords(searchParams: URLSearchParams) {
  const roomNo = searchParams.get('roomNo')?.trim();
  const month = searchParams.get('month')?.trim();
  const dateFrom = searchParams.get('dateFrom')?.trim();
  const dateTo = searchParams.get('dateTo')?.trim();

  const where: string[] = [];
  const params: unknown[] = [];

  if (roomNo && roomNo !== 'all') {
    where.push('room_no = ?');
    params.push(roomNo);
  }
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    where.push('reading_date LIKE ?');
    params.push(`${month}-%`);
  }
  if (dateFrom) {
    where.push('reading_date >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    where.push('reading_date <= ?');
    params.push(dateTo);
  }

  const rows = db.prepare(`
    SELECT *
    FROM water_meter_records
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY reading_date DESC, id DESC
  `).all(...params) as WaterMeterDbRow[];

  return rows.map(parseWaterMeterRow);
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const records = listRecords(searchParams);
    const totalUsage = round2(records.reduce((sum, record) => sum + (record.usageAmount || 0), 0));
    const totalFee = round2(records.reduce((sum, record) => sum + (record.feeAmount || 0), 0));

    return NextResponse.json({ success: true, records, summary: { total: records.length, totalUsage, totalFee } });
  } catch (error) {
    console.error('Get water meter records error:', error);
    return NextResponse.json({ success: false, error: '获取水表记录失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const roomNo = String(body?.roomNo || '').trim();
    const readingDate = String(body?.readingDate || '').trim();
    const currentReadingText = String(body?.currentReading ?? '').trim();
    const currentReading = Number(currentReadingText);
    const unitPriceValue = String(body?.unitPrice ?? '').trim();
    const unitPrice = unitPriceValue ? Number(unitPriceValue) : null;
    const recorderName = String(body?.recorderName || '').trim();
    const remark = String(body?.remark || '').trim();

    if (!roomNo) {
      return NextResponse.json({ success: false, error: '请选择房号' }, { status: 400 });
    }
    if (!readingDate) {
      return NextResponse.json({ success: false, error: '请选择登记日期' }, { status: 400 });
    }
    if (!currentReadingText || !/^\d+(?:\.\d+)?$/.test(currentReadingText) || !Number.isFinite(currentReading) || currentReading < 0) {
      return NextResponse.json({ success: false, error: '请填写正确的本次水表读数' }, { status: 400 });
    }
    if (unitPrice !== null && (!Number.isFinite(unitPrice) || unitPrice < 0)) {
      return NextResponse.json({ success: false, error: '请填写正确的水费单价' }, { status: 400 });
    }

    const room = db.prepare('SELECT room_no FROM dormitory_rooms WHERE room_no = ?').get(roomNo) as { room_no: string } | undefined;
    if (!room) {
      return NextResponse.json({ success: false, error: '房号不存在' }, { status: 400 });
    }

    const previous = db.prepare(`
      SELECT current_reading, current_reading_text
      FROM water_meter_records
      WHERE room_no = ?
      ORDER BY reading_date DESC, id DESC
      LIMIT 1
    `).get(roomNo) as { current_reading: number; current_reading_text: string | null } | undefined;

    const previousReading = previous ? Number(previous.current_reading) : null;
    const previousReadingText = previous ? (previous.current_reading_text || String(previous.current_reading)) : null;
    if (previousReading !== null && currentReading < previousReading) {
      return NextResponse.json({ success: false, error: `本次读数不能小于上次读数 ${previousReading}` }, { status: 400 });
    }

    const usageAmount = previousReading === null ? null : round2(currentReading - previousReading);
    const feeAmount = usageAmount === null || unitPrice === null ? null : round2(usageAmount * unitPrice);

    const result = db.prepare(`
      INSERT INTO water_meter_records (
        room_no, reading_date, previous_reading, previous_reading_text, current_reading, current_reading_text,
        usage_amount, unit_price, fee_amount, recorder_name, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      roomNo,
      readingDate,
      previousReading,
      previousReadingText,
      currentReading,
      currentReadingText,
      usageAmount,
      unitPrice,
      feeAmount,
      recorderName || null,
      remark || null,
    );

    const row = db.prepare('SELECT * FROM water_meter_records WHERE id = ?').get(result.lastInsertRowid) as WaterMeterDbRow;
    return NextResponse.json({ success: true, record: parseWaterMeterRow(row), message: '水表登记成功' });
  } catch (error) {
    console.error('Create water meter record error:', error);
    return NextResponse.json({ success: false, error: '提交水表登记失败' }, { status: 500 });
  }
}
