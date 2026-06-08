import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx-js-style';
import type { CellObject, WorkSheet } from 'xlsx-js-style';
import { patchXlsxPrintSettings } from '@/lib/xlsx-print-settings';
import type { DormitoryRecord } from '@/types/dormitory';

const templatePath = path.join(process.cwd(), 'src', 'templates', 'dormitory-application-template.xlsx');
const PRINT_AREA = 'A1:D27';
const BLACK = '000000';

const thinBorder = {
  top: { style: 'thin', color: { rgb: BLACK } },
  right: { style: 'thin', color: { rgb: BLACK } },
  bottom: { style: 'thin', color: { rgb: BLACK } },
  left: { style: 'thin', color: { rgb: BLACK } },
};

const baseStyle = {
  border: thinBorder,
  font: { name: '宋体', sz: 12 },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
};

const labelStyle = {
  ...baseStyle,
  font: { name: '宋体', sz: 12, bold: true },
  fill: { patternType: 'solid', fgColor: { rgb: 'F8FAFC' } },
};

const titleStyle = {
  ...baseStyle,
  font: { name: '宋体', sz: 18, bold: true },
  fill: { patternType: 'solid', fgColor: { rgb: 'D9EAF7' } },
};

const longTextStyle = {
  ...baseStyle,
  font: { name: '宋体', sz: 11 },
  alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
};

function setCell(sheet: WorkSheet, address: string, value: string) {
  const existing = sheet[address] as CellObject | undefined;
  sheet[address] = {
    ...(existing || {}),
    t: 's',
    v: value,
  };
}

function formatDate(value?: string | null) {
  if (!value) return '';
  return value.includes('T') ? value.split('T')[0] : value.slice(0, 10);
}

function ensureCell(sheet: WorkSheet, row: number, col: number) {
  const address = XLSX.utils.encode_cell({ r: row - 1, c: col - 1 });
  if (!sheet[address]) sheet[address] = { t: 's', v: '' };
  if (sheet[address].t === 'z' || sheet[address].v === undefined || sheet[address].v === '') {
    sheet[address].t = 's';
    sheet[address].v = ' ';
  }
  return sheet[address] as CellObject;
}

function styleRange(sheet: WorkSheet, startRow: number, endRow: number, startCol: number, endCol: number, style: unknown) {
  for (let row = startRow; row <= endRow; row += 1) {
    for (let col = startCol; col <= endCol; col += 1) {
      ensureCell(sheet, row, col).s = style;
    }
  }
}

function applyLayout(sheet: WorkSheet) {
  sheet['!ref'] = PRINT_AREA;
  sheet['!cols'] = [
    { wch: 18 },
    { wch: 30 },
    { wch: 18 },
    { wch: 30 },
  ];
  sheet['!rows'] = [
    { hpt: 34 },
    { hpt: 28 },
    { hpt: 28 },
    { hpt: 42 },
    { hpt: 28 },
    { hpt: 29 },
    { hpt: 29 },
    { hpt: 29 },
    { hpt: 29 },
    { hpt: 28 },
    { hpt: 28 },
    { hpt: 28 },
    { hpt: 28 },
    { hpt: 28 },
    { hpt: 12 },
    { hpt: 14 },
    { hpt: 34 },
    { hpt: 28 },
    { hpt: 28 },
    { hpt: 42 },
    { hpt: 28 },
    { hpt: 29 },
    { hpt: 29 },
    { hpt: 29 },
    { hpt: 29 },
    { hpt: 28 },
    { hpt: 28 },
  ];

  styleRange(sheet, 1, 14, 1, 4, baseStyle);
  styleRange(sheet, 17, 27, 1, 4, baseStyle);
  styleRange(sheet, 1, 1, 1, 4, titleStyle);
  styleRange(sheet, 17, 17, 1, 4, titleStyle);
  [2, 3, 10, 11, 18, 19, 26, 27].forEach((row) => {
    styleRange(sheet, row, row, 1, 1, labelStyle);
    styleRange(sheet, row, row, 3, 3, labelStyle);
  });
  [4, 5, 6, 7, 8, 9, 20, 21, 22, 23, 24, 25].forEach((row) => {
    styleRange(sheet, row, row, 1, 4, longTextStyle);
  });

  (sheet as WorkSheet & {
    '!pageSetup'?: Record<string, unknown>;
    '!printOptions'?: Record<string, unknown>;
    '!margins'?: Record<string, number>;
  })['!pageSetup'] = {
    paperSize: 9,
    orientation: 'portrait',
    fitToWidth: 1,
    fitToHeight: 1,
    scale: 100,
  };
  (sheet as WorkSheet & {
    '!printOptions'?: Record<string, unknown>;
  })['!printOptions'] = {
    horizontalCentered: true,
    verticalCentered: false,
  };
  (sheet as WorkSheet & {
    '!margins'?: Record<string, number>;
  })['!margins'] = {
    left: 0.25,
    right: 0.25,
    top: 0.3,
    bottom: 0.3,
    header: 0.1,
    footer: 0.1,
  };

}

export function buildDormitoryApplicationXlsx(record: DormitoryRecord) {
  const workbook = XLSX.read(fs.readFileSync(templatePath), {
    type: 'buffer',
    cellStyles: true,
  });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  setCell(sheet, 'B2', `${record.name} ${record.phone}`.trim());
  setCell(sheet, 'D2', [record.department, record.position].filter(Boolean).join('/'));
  setCell(sheet, 'B3', record.idCard);
  setCell(sheet, 'D3', formatDate(record.checkedInAt || record.expectedCheckInDate));
  setCell(sheet, 'B4', record.reason);
  setCell(sheet, 'B10', record.roomBed || '');
  setCell(sheet, 'D10', record.handlerName || record.reviewerName || '');
  setCell(sheet, 'B11', record.keyIssued || '');

  setCell(sheet, 'B18', `${record.name} ${record.phone}`.trim());
  setCell(sheet, 'D18', [record.department, record.position].filter(Boolean).join('/'));
  setCell(sheet, 'B19', formatDate(record.checkoutApplyDate || record.checkedOutAt));
  setCell(sheet, 'D19', formatDate(record.moveOutDate));
  setCell(sheet, 'B20', record.checkoutReason || '');
  setCell(sheet, 'B26', record.roomBed || '');
  setCell(sheet, 'D26', record.checkoutHandlerName || '');
  setCell(sheet, 'B27', record.keyReturned || '');
  applyLayout(sheet);

  const output = XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
    cellStyles: true,
    bookSST: true,
  }) as Buffer;

  return patchXlsxPrintSettings(output, {
    sheetName,
    printArea: '$A$1:$D$27',
    orientation: 'portrait',
    fitToWidth: 1,
    fitToHeight: 1,
    margins: {
      left: 0.15,
      right: 0.15,
      top: 0.2,
      bottom: 0.2,
      header: 0.05,
      footer: 0.05,
    },
  });
}
