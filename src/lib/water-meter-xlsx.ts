import { deflateRawSync, inflateRawSync } from 'node:zlib';
import * as XLSX from 'xlsx-js-style';
import type { WaterMeterRecord } from '@/types/water-meter';

const COLUMN_COUNT = 14;
const MIN_DATA_ROWS = 20;
const BLACK = '000000';

const thinBorder = {
  top: { style: 'thin', color: { rgb: BLACK } },
  right: { style: 'thin', color: { rgb: BLACK } },
  bottom: { style: 'thin', color: { rgb: BLACK } },
  left: { style: 'thin', color: { rgb: BLACK } },
};

const tableCellStyle = {
  border: thinBorder,
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
};

const tableHeaderStyle = {
  ...tableCellStyle,
  font: { bold: true },
};

interface ZipEntry {
  name: string;
  data: Buffer;
  modTime: number;
  modDate: number;
}

const crcTable = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function numberText(value: number | null | undefined) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function exportMonth(records: WaterMeterRecord[], month?: string) {
  const source = month ? `${month}-01` : records[0]?.readingDate || new Date().toISOString().slice(0, 10);
  const [year, monthNumber] = source.split('-');
  return `日期：${year || '20  '}年 ${monthNumber || '  '}月`;
}

function setCell(sheet: XLSX.WorkSheet, row: number, col: number, value: string | number, forceText = false, style?: unknown) {
  const address = XLSX.utils.encode_cell({ r: row - 1, c: col - 1 });
  sheet[address] = forceText
    ? { t: 's', v: String(value) }
    : typeof value === 'number'
      ? { t: 'n', v: value }
      : { t: 's', v: value };
  if (style) sheet[address].s = style;
}

function styleRange(sheet: XLSX.WorkSheet, startRow: number, endRow: number, startCol: number, endCol: number, style: unknown) {
  for (let row = startRow; row <= endRow; row += 1) {
    for (let col = startCol; col <= endCol; col += 1) {
      const address = XLSX.utils.encode_cell({ r: row - 1, c: col - 1 });
      if (!sheet[address]) sheet[address] = { t: 's', v: ' ' };
      if (sheet[address].t === 'z' || sheet[address].v === undefined || sheet[address].v === '') {
        sheet[address].t = 's';
        sheet[address].v = ' ';
      }
      sheet[address].s = style;
    }
  }
}

function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const minOffset = Math.max(0, buffer.length - 22 - 0xffff);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error('Invalid xlsx zip: EOCD not found');
}

function readZip(buffer: Buffer): ZipEntry[] {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let centralOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries: ZipEntry[] = [];

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(centralOffset) !== 0x02014b50) {
      throw new Error('Invalid xlsx zip: central directory entry not found');
    }

    const flags = buffer.readUInt16LE(centralOffset + 8);
    const method = buffer.readUInt16LE(centralOffset + 10);
    const modTime = buffer.readUInt16LE(centralOffset + 12);
    const modDate = buffer.readUInt16LE(centralOffset + 14);
    const compressedSize = buffer.readUInt32LE(centralOffset + 20);
    const nameLength = buffer.readUInt16LE(centralOffset + 28);
    const extraLength = buffer.readUInt16LE(centralOffset + 30);
    const commentLength = buffer.readUInt16LE(centralOffset + 32);
    const localOffset = buffer.readUInt32LE(centralOffset + 42);
    const nameStart = centralOffset + 46;
    const name = buffer.toString(flags & 0x0800 ? 'utf8' : 'latin1', nameStart, nameStart + nameLength);

    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    const data = method === 0 ? Buffer.from(compressed) : method === 8 ? inflateRawSync(compressed) : null;
    if (!data) throw new Error(`Unsupported xlsx zip compression method: ${method}`);

    entries.push({ name, data, modTime, modDate });
    centralOffset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function writeZip(entries: ZipEntry[]) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const compressed = deflateRawSync(entry.data);
    const crc = crc32(entry.data);

    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(entry.modTime, 10);
    local.writeUInt16LE(entry.modDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    localParts.push(local, compressed);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(entry.modTime, 12);
    central.writeUInt16LE(entry.modDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centralParts.push(central);

    offset += local.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, eocd]);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function patchWorksheetPrintXml(xml: string) {
  let next = xml;
  const sheetPrXml = '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>';
  const printOptionsXml = '<printOptions horizontalCentered="1"/>';
  const pageMarginsXml = '<pageMargins left="0.15" right="0.15" top="0.2" bottom="0.2" header="0.05" footer="0.05"/>';
  const pageSetupXml = '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="1"/>';

  if (/<sheetPr[\s\S]*?<\/sheetPr>/.test(next)) {
    next = /<pageSetUpPr\b[^>]*\/>/.test(next)
      ? next.replace(/<pageSetUpPr\b[^>]*\/>/, '<pageSetUpPr fitToPage="1"/>')
      : next.replace('</sheetPr>', '<pageSetUpPr fitToPage="1"/></sheetPr>');
  } else {
    next = next.replace(/<worksheet([^>]*)>/, `<worksheet$1>${sheetPrXml}`);
  }

  next = /<printOptions\b[^>]*\/>/.test(next)
    ? next.replace(/<printOptions\b[^>]*\/>/, printOptionsXml)
    : next.replace(/<pageMargins\b[^>]*\/>|<\/worksheet>/, (match) => `${printOptionsXml}${match}`);
  next = /<pageMargins\b[^>]*\/>/.test(next)
    ? next.replace(/<pageMargins\b[^>]*\/>/, pageMarginsXml)
    : next.replace('</worksheet>', `${pageMarginsXml}</worksheet>`);
  next = /<pageSetup\b[^>]*\/>/.test(next)
    ? next.replace(/<pageSetup\b[^>]*\/>/, pageSetupXml)
    : next.replace(/<pageMargins\b[^>]*\/>/, (match) => `${match}${pageSetupXml}`);

  return next;
}

function patchWorkbookPrintAreaXml(xml: string, sheetName: string, lastRow: number) {
  const safeSheetName = `'${sheetName.replace(/'/g, "''")}'`;
  const printArea = `<definedName name="_xlnm.Print_Area" localSheetId="0">${escapeXml(`${safeSheetName}!$A$1:$N$${lastRow}`)}</definedName>`;
  let next = xml.replace(/<definedName\b(?=[^>]*name="_xlnm\.Print_Area")[\s\S]*?<\/definedName>/g, '');

  if (/<definedNames>[\s\S]*?<\/definedNames>/.test(next)) {
    next = next.replace('</definedNames>', `${printArea}</definedNames>`);
  } else {
    next = next.replace('</workbook>', `<definedNames>${printArea}</definedNames></workbook>`);
  }

  return next;
}

function patchWorkbookPrintSettings(buffer: Buffer, sheetName: string, lastRow: number) {
  const entries = readZip(buffer);
  for (const entry of entries) {
    if (entry.name === 'xl/worksheets/sheet1.xml') {
      entry.data = Buffer.from(patchWorksheetPrintXml(entry.data.toString('utf8')), 'utf8');
    }
    if (entry.name === 'xl/workbook.xml') {
      entry.data = Buffer.from(patchWorkbookPrintAreaXml(entry.data.toString('utf8'), sheetName, lastRow), 'utf8');
    }
  }
  return writeZip(entries);
}

export function buildWaterMeterRecordsXlsx(records: WaterMeterRecord[], month?: string) {
  const dataRows = Math.max(records.length, MIN_DATA_ROWS);
  const totalRows = dataRows + 6;
  const rows: string[][] = Array.from({ length: totalRows }, () => Array.from({ length: COLUMN_COUNT }, () => ''));

  rows[0][0] = '房租用水用电抄表记录表';
  rows[1][0] = '小区(大厦)名称：';
  rows[1][10] = exportMonth(records, month);

  rows[2][0] = '日期';
  rows[2][1] = '楼房';
  rows[2][2] = '用户名号';
  rows[2][3] = '水表';
  rows[2][5] = '电表';
  rows[2][7] = '实际使用';
  rows[2][9] = '水费';
  rows[2][10] = '电费';
  rows[2][11] = '租金';
  rows[2][12] = '实收总额';
  rows[2][13] = '备注';

  rows[3][3] = '本月度数';
  rows[3][4] = '上月度数';
  rows[3][5] = '本月度数';
  rows[3][6] = '上月度数';
  rows[3][7] = '水度';
  rows[3][8] = '电度';

  records.forEach((record, index) => {
    const row = 4 + index;
    rows[row][0] = record.readingDate;
    rows[row][1] = record.roomNo;
    rows[row][2] = '';
    rows[row][3] = record.currentReadingText;
    rows[row][4] = record.previousReadingText || '';
    rows[row][5] = '';
    rows[row][6] = '';
    rows[row][7] = numberText(record.usageAmount);
    rows[row][8] = '';
    rows[row][9] = numberText(record.feeAmount);
    rows[row][10] = '';
    rows[row][11] = '';
    rows[row][12] = numberText(record.feeAmount);
    rows[row][13] = record.remark || '';
  });

  rows[totalRows - 1][0] = '快查号码（        ）';

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 13 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
    { s: { r: 1, c: 10 }, e: { r: 1, c: 13 } },
    { s: { r: 2, c: 0 }, e: { r: 3, c: 0 } },
    { s: { r: 2, c: 1 }, e: { r: 3, c: 1 } },
    { s: { r: 2, c: 2 }, e: { r: 3, c: 2 } },
    { s: { r: 2, c: 3 }, e: { r: 2, c: 4 } },
    { s: { r: 2, c: 5 }, e: { r: 2, c: 6 } },
    { s: { r: 2, c: 7 }, e: { r: 2, c: 8 } },
    { s: { r: 2, c: 9 }, e: { r: 3, c: 9 } },
    { s: { r: 2, c: 10 }, e: { r: 3, c: 10 } },
    { s: { r: 2, c: 11 }, e: { r: 3, c: 11 } },
    { s: { r: 2, c: 12 }, e: { r: 3, c: 12 } },
    { s: { r: 2, c: 13 }, e: { r: 3, c: 13 } },
    { s: { r: totalRows - 1, c: 0 }, e: { r: totalRows - 1, c: 3 } },
  ];
  worksheet['!cols'] = [
    { wch: 12 },
    { wch: 10 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 16 },
  ];
  worksheet['!rows'] = [
    { hpt: 30 },
    { hpt: 24 },
    { hpt: 24 },
    { hpt: 24 },
    ...Array.from({ length: dataRows }, () => ({ hpt: 25 })),
    { hpt: 24 },
  ];

  records.forEach((record, index) => {
    const row = 5 + index;
    setCell(worksheet, row, 4, record.currentReadingText, true, tableCellStyle);
    setCell(worksheet, row, 5, record.previousReadingText || '', true, tableCellStyle);
  });

  styleRange(worksheet, 1, 1, 1, COLUMN_COUNT, {
    font: { bold: true, sz: 20 },
    alignment: { horizontal: 'center', vertical: 'center' },
  });
  styleRange(worksheet, 2, 2, 1, COLUMN_COUNT, {
    alignment: { horizontal: 'left', vertical: 'center' },
  });
  styleRange(worksheet, 3, 4, 1, COLUMN_COUNT, tableHeaderStyle);
  styleRange(worksheet, 5, totalRows, 1, COLUMN_COUNT, tableCellStyle);
  styleRange(worksheet, totalRows, totalRows, 1, 4, {
    border: thinBorder,
    alignment: { horizontal: 'left', vertical: 'center' },
  });

  (worksheet as XLSX.WorkSheet & {
    '!pageSetup'?: Record<string, unknown>;
    '!margins'?: Record<string, number>;
  })['!pageSetup'] = {
    orientation: 'landscape',
    paperSize: 9,
    fitToWidth: 1,
    fitToHeight: 1,
  };
  (worksheet as XLSX.WorkSheet & {
    '!margins'?: Record<string, number>;
  })['!margins'] = {
    left: 0.25,
    right: 0.25,
    top: 0.3,
    bottom: 0.3,
    header: 0.1,
    footer: 0.1,
  };

  const workbook = XLSX.utils.book_new();
  const sheetName = '抄表记录';
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const output = XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
    bookSST: true,
  }) as Buffer;

  return patchWorkbookPrintSettings(output, sheetName, totalRows);
}
