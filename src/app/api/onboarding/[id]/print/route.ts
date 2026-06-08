import { NextRequest, NextResponse } from 'next/server';
import { db, logOperationServer } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { parseOnboardingRow, type OnboardingDbRow } from '@/lib/onboarding-records';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

function escapeHtml(value?: string | number | null) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value?: string | null) {
  if (!value) return '';
  return value.includes('T') ? value.split('T')[0] : value.slice(0, 10);
}

function field(value?: string | number | null) {
  const text = String(value ?? '').trim();
  return escapeHtml(text || ' ');
}

function row(cells: Array<[string, string | number | null | undefined]>) {
  return `
    <tr>
      ${cells.map(([label, value]) => `<th>${escapeHtml(label)}</th><td>${field(value)}</td>`).join('')}
    </tr>
  `;
}

function healthText(answer: string, note?: string) {
  return note ? `${answer}，${note}` : answer;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { id } = await params;
    const rowData = db.prepare('SELECT * FROM onboarding_records WHERE id = ?').get(id) as OnboardingDbRow | undefined;
    if (!rowData) {
      return NextResponse.json({ success: false, error: '入职登记不存在' }, { status: 404 });
    }

    const record = parseOnboardingRow(rowData);
    if (record.status === '待审核') {
      return NextResponse.json({ success: false, error: '请先完成人事审核，审核后才能打印' }, { status: 400 });
    }

    const data = record.data;
    const contact = data.emergencyContacts[0];
    const signature = data.signatureDataUrl?.startsWith('data:image/') ? data.signatureDataUrl : '';
    const probation = [data.probationMonths ? `${data.probationMonths}个月` : '', data.probationSalary ? `${data.probationSalary}元/月` : ''].filter(Boolean).join('，');

    logOperationServer({
      userId: user.id,
      userName: user.name || user.username,
      module: 'personnel',
      action: 'print',
      details: { onboardingId: id, employeeName: record.name },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>${field(record.name)}-入职登记表打印</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #e5e7eb;
      color: #111827;
      font-family: SimSun, "Microsoft YaHei", Arial, sans-serif;
      font-size: 12px;
      line-height: 1.55;
    }
    .toolbar {
      position: sticky;
      top: 0;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 10px 18px;
      background: #fff;
      border-bottom: 1px solid #d1d5db;
    }
    .toolbar button {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #fff;
      padding: 7px 14px;
      cursor: pointer;
    }
    .toolbar button.primary {
      border-color: #2563eb;
      background: #2563eb;
      color: #fff;
    }
    .page {
      width: 186mm;
      min-height: 273mm;
      margin: 16px auto;
      padding: 0;
      background: #fff;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
      page-break-after: always;
    }
    .page:last-child { page-break-after: auto; }
    h1 {
      margin: 0 0 10px;
      text-align: center;
      font-size: 22px;
      letter-spacing: 0;
    }
    h2 {
      margin: 14px 0 6px;
      font-size: 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    th, td {
      border: 1px solid #111827;
      padding: 5px 6px;
      vertical-align: middle;
      word-break: break-all;
    }
    th {
      width: 15%;
      background: #f8fafc;
      font-weight: 700;
      text-align: center;
    }
    td { width: 35%; min-height: 26px; }
    .content { padding: 2mm 0; }
    .promise {
      margin: 8px 0 0;
      text-indent: 2em;
      font-size: 13px;
      line-height: 1.85;
    }
    .signature {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14mm;
      margin-top: 14mm;
      align-items: end;
    }
    .signature-box {
      min-height: 25mm;
      border-bottom: 1px solid #111827;
      display: flex;
      align-items: end;
      justify-content: center;
      padding-bottom: 2mm;
    }
    .signature-box img {
      max-width: 52mm;
      max-height: 18mm;
      object-fit: contain;
    }
    .muted { color: #64748b; }
    @media print {
      body { background: #fff; }
      .toolbar { display: none; }
      .page {
        width: auto;
        min-height: auto;
        margin: 0;
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

  <main>
    <section class="page">
      <h1>入职登记表</h1>
      <div class="content">
        <h2>一、个人基本信息</h2>
        <table>
          ${row([['姓名', data.name], ['性别', data.gender]])}
          ${row([['民族', data.ethnicity], ['籍贯', data.nativePlace]])}
          ${row([['学历', data.education], ['政治面貌', data.politicalStatus]])}
          ${row([['婚姻状况', data.maritalStatus], ['身份证号', data.idCard]])}
          ${row([['联系电话', data.phone], ['微信/QQ', data.wechat]])}
          ${row([['邮箱', data.email], ['招聘来源', record.recruitmentSource]])}
        </table>

        <h2>二、紧急联系人</h2>
        <table>
          ${row([['姓名', contact?.name], ['关系', contact?.relation]])}
          ${row([['联系电话', contact?.phone], ['单位住址', contact?.address]])}
        </table>

        <h2>三、岗位信息</h2>
        <table>
          ${row([['入职岗位', data.position], ['所属部门', data.department]])}
          ${row([['入职日期', formatDate(data.hireDate)], ['填表日期', formatDate(data.fillDate)]])}
          ${row([['合同期限', data.contractTerm], ['试用期（底薪）', probation]])}
          ${row([['工资方式', data.wageMethod], ['使用机器约定', data.machineAgreement]])}
        </table>

        <h2>四、健康信息</h2>
        <table>
          ${row([['利手', data.dominantHand], ['重大疾病或家族病史', healthText(data.majorDisease, data.majorDiseaseNote)]])}
          ${row([['残疾人证明', healthText(data.disabilityProof, data.disabilityProofNote)], ['粉尘/重体力/有毒工种', healthText(data.heavyWork, data.heavyWorkNote)]])}
          ${row([['职业病或工作禁忌', healthText(data.occupationalDisease, data.occupationalDiseaseNote)], ['登记状态', record.status]])}
        </table>
      </div>
    </section>

    <section class="page">
      <h1>入职承诺</h1>
      <p class="promise">本人在填写本《入职登记表》时，已保证自己符合国家法律的劳动年龄的标准，且身体健康、能胜任用人单位、机构、组织、团体无劳动关系；若违反承诺，导致用人单位造成有关经济损失的，所有责任均由本人承担。</p>
      <p class="promise">本人在填写《入职登记表》时，用人单位已如实告知工作内容、工作地点、工作条件、职业危害、安全生产状况、劳动报酬以及本人所需要了解的所有情况。</p>
      <p class="promise">本人如有传染病、精神病或其他可能影响在用人单位工作的病史，本人应以书面形式向用人单位说明。</p>
      <p class="promise">本人承诺已与原单位解除劳动关系，且无仍然生效的保密协议、竞业限制协议。</p>
      <p class="promise">本人填写的《入职登记表》所有信息真实有效，如有任何虚假，用人单位可按严重违反规章制度解除劳动合同，并保留追究责任的权利。</p>

      <div class="signature">
        <div>
          <div class="signature-box">
            ${signature ? `<img src="${signature}" alt="员工签名" />` : '<span class="muted">未采集电子签名</span>'}
          </div>
          <p>签名：${field(data.name)}</p>
        </div>
        <div>
          <div class="signature-box">${field(formatDate(data.signatureDate))}</div>
          <p>日期</p>
        </div>
      </div>

      <h2>人事部门意见</h2>
      <table>
        ${row([['审核意见', record.hrOpinion], ['审核人', record.reviewerName]])}
        ${row([['审核日期', formatDate(record.reviewedAt)], ['员工档案ID', record.employeeId]])}
      </table>
    </section>
  </main>

  <script>
    window.addEventListener('load', function () {
      window.setTimeout(function () { window.print(); }, 300);
    });
  </script>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Print onboarding record error:', error);
    return NextResponse.json({ success: false, error: '打开打印页失败' }, { status: 500 });
  }
}
