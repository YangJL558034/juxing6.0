import { deflateRawSync, inflateRawSync } from 'node:zlib';

interface ZipEntry {
  name: string;
  data: Buffer;
  modTime: number;
  modDate: number;
}

interface PrintMargins {
  left: number;
  right: number;
  top: number;
  bottom: number;
  header: number;
  footer: number;
}

interface XlsxPrintSettings {
  sheetName: string;
  printArea: string;
  orientation: 'portrait' | 'landscape';
  sheetXmlPath?: string;
  paperSize?: number;
  fitToWidth?: number;
  fitToHeight?: number;
  margins?: PrintMargins;
}

const crcTable = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

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
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centralParts.push(central);

    offset += local.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...localParts, centralDirectory, eocd]);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function patchWorksheetXml(xml: string, settings: Required<Pick<XlsxPrintSettings, 'orientation' | 'paperSize' | 'fitToWidth' | 'fitToHeight' | 'margins'>>) {
  let next = xml;
  const sheetPrXml = '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>';
  const printOptionsXml = '<printOptions horizontalCentered="1"/>';
  const pageMarginsXml = `<pageMargins left="${settings.margins.left}" right="${settings.margins.right}" top="${settings.margins.top}" bottom="${settings.margins.bottom}" header="${settings.margins.header}" footer="${settings.margins.footer}"/>`;
  const pageSetupXml = `<pageSetup paperSize="${settings.paperSize}" orientation="${settings.orientation}" fitToWidth="${settings.fitToWidth}" fitToHeight="${settings.fitToHeight}"/>`;

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

function patchWorkbookXml(xml: string, sheetName: string, printArea: string) {
  const safeSheetName = `'${sheetName.replace(/'/g, "''")}'`;
  const definedName = `<definedName name="_xlnm.Print_Area" localSheetId="0">${escapeXml(`${safeSheetName}!${printArea}`)}</definedName>`;
  let next = xml.replace(/<definedName\b(?=[^>]*name="_xlnm\.Print_Area")[\s\S]*?<\/definedName>/g, '');

  if (/<definedNames>[\s\S]*?<\/definedNames>/.test(next)) {
    next = next.replace('</definedNames>', `${definedName}</definedNames>`);
  } else {
    next = next.replace('</workbook>', `<definedNames>${definedName}</definedNames></workbook>`);
  }

  return next;
}

export function patchXlsxPrintSettings(buffer: Buffer, settings: XlsxPrintSettings) {
  const normalized = {
    sheetName: settings.sheetName,
    printArea: settings.printArea,
    sheetXmlPath: settings.sheetXmlPath || 'xl/worksheets/sheet1.xml',
    orientation: settings.orientation,
    paperSize: settings.paperSize || 9,
    fitToWidth: settings.fitToWidth || 1,
    fitToHeight: settings.fitToHeight || 1,
    margins: settings.margins || {
      left: 0.15,
      right: 0.15,
      top: 0.2,
      bottom: 0.2,
      header: 0.05,
      footer: 0.05,
    },
  };

  const entries = readZip(buffer);
  for (const entry of entries) {
    if (entry.name === normalized.sheetXmlPath) {
      entry.data = Buffer.from(patchWorksheetXml(entry.data.toString('utf8'), normalized), 'utf8');
    }
    if (entry.name === 'xl/workbook.xml') {
      entry.data = Buffer.from(patchWorkbookXml(entry.data.toString('utf8'), normalized.sheetName, normalized.printArea), 'utf8');
    }
  }
  return writeZip(entries);
}
