import type { WaterMeterRecord, WaterMeterRoomOption } from '@/types/water-meter';

export interface WaterMeterDbRow {
  id: number;
  room_no: string;
  reading_date: string;
  previous_reading: number | null;
  previous_reading_text: string | null;
  current_reading: number;
  current_reading_text: string | null;
  usage_amount: number | null;
  unit_price: number | null;
  fee_amount: number | null;
  recorder_name: string | null;
  remark: string | null;
  created_at: string;
}

function readingText(text: string | null | undefined, numeric: number | null | undefined) {
  if (text !== undefined && text !== null && text !== '') return text;
  if (numeric === undefined || numeric === null) return null;
  return String(numeric);
}

export function parseWaterMeterRow(row: WaterMeterDbRow): WaterMeterRecord {
  return {
    id: row.id,
    roomNo: row.room_no,
    readingDate: row.reading_date,
    previousReading: row.previous_reading,
    previousReadingText: readingText(row.previous_reading_text, row.previous_reading),
    currentReading: row.current_reading,
    currentReadingText: readingText(row.current_reading_text, row.current_reading) || '',
    usageAmount: row.usage_amount,
    unitPrice: row.unit_price,
    feeAmount: row.fee_amount,
    recorderName: row.recorder_name,
    remark: row.remark,
    createdAt: row.created_at,
  };
}

export function parseWaterMeterRoom(row: {
  room_no: string;
  capacity: number | null;
  latest_reading: number | null;
  latest_reading_text: string | null;
  latest_reading_date: string | null;
}): WaterMeterRoomOption {
  return {
    roomNo: row.room_no,
    capacity: Number(row.capacity || 0),
    latestReading: row.latest_reading,
    latestReadingText: readingText(row.latest_reading_text, row.latest_reading),
    latestReadingDate: row.latest_reading_date,
  };
}

export function round2(value: number) {
  return Math.round(value * 100) / 100;
}
