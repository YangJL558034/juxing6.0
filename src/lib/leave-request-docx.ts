import { formatLeaveDateRange, formatLeaveDuration } from '@/lib/leave-records';
import type { LeaveRequestRecord } from '@/types/leave-request';

interface DocxFile {
  path: string;
  content: Buffer | string;
}

function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function display(value: unknown) {
  const text = String(value ?? '').trim();
  return text || '-';
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return value.replace('T', ' ').slice(0, 16);
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZip(files: DocxFile[]): Buffer {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((Math.max(1980, now.getFullYear()) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  for (const file of files) {
    const name = Buffer.from(file.path, 'utf8');
    const content = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, 'utf8');
    const crc = crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    chunks.push(local, name, content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(content.length, 20);
    centralHeader.writeUInt32LE(content.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt32LE(offset, 42);
    central.push(centralHeader, name);
    offset += local.length + name.length + content.length;
  }

  const centralOffset = offset;
  const centralContent = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralContent.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([...chunks, centralContent, end]);
}

function run(value: unknown, bold = false) {
  return `<w:r><w:rPr><w:rFonts w:eastAsia="Microsoft YaHei" w:ascii="Microsoft YaHei" w:hAnsi="Microsoft YaHei"/><w:sz w:val="22"/><w:szCs w:val="22"/>${bold ? '<w:b/><w:bCs/>' : ''}</w:rPr><w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r>`;
}

function paragraph(value: unknown, options: { center?: boolean; bold?: boolean; size?: number } = {}) {
  const jc = options.center ? '<w:jc w:val="center"/>' : '';
  const size = options.size || 22;
  return `<w:p><w:pPr>${jc}<w:spacing w:after="80"/></w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Microsoft YaHei" w:ascii="Microsoft YaHei" w:hAnsi="Microsoft YaHei"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/>${options.bold ? '<w:b/><w:bCs/>' : ''}</w:rPr><w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r></w:p>`;
}

function cell(value: unknown, width: number, shaded = false, bold = false) {
  const shade = shaded ? '<w:shd w:fill="F3F4F6"/>' : '';
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${shade}<w:vAlign w:val="center"/></w:tcPr>${paragraph(value, { center: shaded, bold })}</w:tc>`;
}

function row(leftLabel: string, leftValue: unknown, rightLabel: string, rightValue: unknown) {
  return `<w:tr>${cell(leftLabel, 1600, true, true)}${cell(leftValue, 3000)}${cell(rightLabel, 1600, true, true)}${cell(rightValue, 3000)}</w:tr>`;
}

function table(record: LeaveRequestRecord) {
  return `<w:tbl><w:tblPr><w:tblW w:w="9200" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="8" w:color="111827"/><w:left w:val="single" w:sz="8" w:color="111827"/><w:bottom w:val="single" w:sz="8" w:color="111827"/><w:right w:val="single" w:sz="8" w:color="111827"/><w:insideH w:val="single" w:sz="8" w:color="111827"/><w:insideV w:val="single" w:sz="8" w:color="111827"/></w:tblBorders></w:tblPr>
${row('员工姓名', record.employeeName, '身份证号', record.idCard)}
${row('手机号', record.phone, '部门', record.department)}
${row('岗位', record.position, '请假日期', formatLeaveDateRange(record))}
${row('请假时长', formatLeaveDuration(record.duration, record.halfDayPeriod), '请假类型', record.leaveType)}
${row('提交人', record.createdByName, '提交时间', formatDateTime(record.createdAt))}
${row('审核人', record.reviewerName, '审核时间', formatDateTime(record.reviewedAt))}
</w:tbl>`;
}

function textBox(value: unknown) {
  return `<w:tbl><w:tblPr><w:tblW w:w="9200" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="8" w:color="111827"/><w:left w:val="single" w:sz="8" w:color="111827"/><w:bottom w:val="single" w:sz="8" w:color="111827"/><w:right w:val="single" w:sz="8" w:color="111827"/></w:tblBorders></w:tblPr><w:tr><w:trPr><w:trHeight w:val="1500"/></w:trPr><w:tc><w:tcPr><w:tcW w:w="9200" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr>${paragraph(display(value))}</w:tc></w:tr></w:tbl>`;
}

function signatureImageRun(relId: string) {
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="1500000" cy="520000"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="1001" name="leave-signature"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1001" name="leave-signature.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1500000" cy="520000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

function signatureParagraph(record: LeaveRequestRecord, hasSignature: boolean) {
  const employeeSignature = hasSignature ? signatureImageRun('rIdLeaveSignature') : run('____________________');
  return `<w:p><w:pPr><w:spacing w:before="320"/><w:tabs><w:tab w:val="left" w:pos="5000"/></w:tabs></w:pPr>${run('员工签字：', true)}${employeeSignature}<w:r><w:tab/></w:r>${run('审核签字：', true)}${run(record.reviewerName || '____________________', true)}</w:p>`;
}

function imageBuffer(dataUrl: string) {
  const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
  return match ? Buffer.from(match[1], 'base64') : null;
}

function documentXml(record: LeaveRequestRecord, hasSignature: boolean) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
  <w:body>
    ${paragraph('员工请假申请单', { center: true, bold: true, size: 36 })}
    ${table(record)}
    ${paragraph('请假原因', { bold: true })}
    ${textBox(record.reason)}
    ${signatureParagraph(record, hasSignature)}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1200" w:right="1200" w:bottom="1200" w:left="1200" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>
  </w:body>
</w:document>`;
}

function relsXml(hasSignature: boolean) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${hasSignature ? '<Relationship Id="rIdLeaveSignature" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/leave-signature.png"/>' : ''}
</Relationships>`;
}

export function buildLeaveRequestDocx(record: LeaveRequestRecord) {
  const signature = imageBuffer(record.applicantSignatureDataUrl);
  const files: DocxFile[] = [
    {
      path: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    },
    {
      path: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdDocument" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    },
    { path: 'word/_rels/document.xml.rels', content: relsXml(Boolean(signature)) },
    { path: 'word/document.xml', content: documentXml(record, Boolean(signature)) },
  ];

  if (signature) {
    files.push({ path: 'word/media/leave-signature.png', content: signature });
  }

  return createZip(files);
}
