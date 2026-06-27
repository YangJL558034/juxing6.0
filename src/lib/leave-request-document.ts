import { formatLeaveDateRange, formatLeaveDuration } from '@/lib/leave-records';
import type { LeaveRequestRecord } from '@/types/leave-request';

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function display(value: unknown) {
  const text = String(value ?? '').trim();
  return text || '-';
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return value.replace('T', ' ').slice(0, 16);
}

function buildRows(record: LeaveRequestRecord) {
  const rows: Array<[string, string, string, string]> = [
    ['员工姓名', display(record.employeeName), '身份证号', display(record.idCard)],
    ['手机号', display(record.phone), '部门', display(record.department)],
    ['岗位', display(record.position), '请假日期', formatLeaveDateRange(record)],
    ['请假时长', formatLeaveDuration(record.duration, record.halfDayPeriod), '请假类型', display(record.leaveType)],
    ['提交人', display(record.createdByName), '提交时间', formatDateTime(record.createdAt)],
    ['审核人', display(record.reviewerName), '审核时间', formatDateTime(record.reviewedAt)],
  ];

  return rows.map(([leftLabel, leftValue, rightLabel, rightValue]) => `
    <tr>
      <th>${escapeHtml(leftLabel)}</th>
      <td>${escapeHtml(leftValue)}</td>
      <th>${escapeHtml(rightLabel)}</th>
      <td>${escapeHtml(rightValue)}</td>
    </tr>
  `).join('');
}

export function buildLeaveRequestPrintHtml(record: LeaveRequestRecord, autoPrint = true) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(record.employeeName || '员工')}-请假申请单</title>
  <style>
    @page { size: A4; margin: 18mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #e5e7eb;
      color: #111827;
      font-family: "Microsoft YaHei", SimSun, Arial, sans-serif;
      font-size: 12pt;
      line-height: 1.55;
    }
    .toolbar {
      position: sticky;
      top: 0;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 10px 16px;
      background: #fff;
      border-bottom: 1px solid #d1d5db;
    }
    .toolbar button {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #fff;
      padding: 7px 14px;
      cursor: pointer;
      font-size: 13px;
    }
    .toolbar .primary {
      border-color: #111827;
      background: #111827;
      color: #fff;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 12px auto;
      padding: 18mm;
      background: #fff;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
    }
    h1 {
      margin: 0 0 12mm;
      text-align: center;
      font-size: 20pt;
      letter-spacing: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    th, td {
      border: 1px solid #111827;
      padding: 9px 10px;
      vertical-align: top;
      word-break: break-word;
    }
    th {
      width: 18%;
      background: #f3f4f6;
      text-align: center;
      font-weight: 700;
    }
    td {
      width: 32%;
    }
    .reason-title {
      margin: 12mm 0 3mm;
      font-weight: 700;
    }
    .reason {
      min-height: 45mm;
      border: 1px solid #111827;
      padding: 10px;
      white-space: pre-wrap;
    }
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18mm;
      margin-top: 14mm;
    }
    .line {
      display: inline-block;
      min-width: 48mm;
      border-bottom: 1px solid #111827;
      height: 8mm;
      vertical-align: bottom;
    }
    .signature-image {
      display: inline-block;
      max-width: 48mm;
      max-height: 18mm;
      object-fit: contain;
      vertical-align: bottom;
      border-bottom: 1px solid #111827;
    }
    .signature-text {
      display: inline-block;
      min-width: 48mm;
      padding: 0 2mm 1mm;
      border-bottom: 1px solid #111827;
      text-align: center;
      vertical-align: bottom;
      font-weight: 700;
    }
    @media print {
      body { background: #fff; }
      .toolbar { display: none; }
      .page {
        width: auto;
        min-height: auto;
        margin: 0;
        padding: 0;
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button type="button" onclick="window.close()">关闭</button>
    <button type="button" class="primary" onclick="window.print()">打印</button>
  </div>
  <main class="page">
    <h1>员工请假申请单</h1>
    <table>
      <tbody>${buildRows(record)}</tbody>
    </table>
    <div class="reason-title">请假原因</div>
    <div class="reason">${escapeHtml(display(record.reason))}</div>
    <div class="signatures">
      <div>员工签字：${record.applicantSignatureDataUrl ? `<img class="signature-image" src="${escapeHtml(record.applicantSignatureDataUrl)}" alt="员工签字" />` : '<span class="line"></span>'}</div>
      <div>审核签字：${record.reviewerName ? `<span class="signature-text">${escapeHtml(record.reviewerName)}</span>` : '<span class="line"></span>'}</div>
    </div>
  </main>
  ${autoPrint ? `<script>
    window.addEventListener('load', function () {
      window.setTimeout(function () { window.print(); }, 300);
    });
  </script>` : ''}
</body>
</html>`;
}

export function buildLeaveRequestExportHtml(record: LeaveRequestRecord) {
  return buildLeaveRequestPrintHtml(record, false);
}
