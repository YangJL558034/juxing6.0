import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import {
  applicationStatuses,
  parseRecruitmentApplication,
  type RecruitmentApplicationDbRow,
} from '@/lib/recruitment-records';
import type { RecruitmentApplicationStatus, RecruitmentJobStatus } from '@/types/recruitment';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value || request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  return verifyToken(token);
}

function cleanText(value: FormDataEntryValue | null) {
  return String(value ?? '').trim();
}

function todayText() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function localDateTime() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function isApplicationStatus(value: string): value is RecruitmentApplicationStatus {
  return applicationStatuses.includes(value as RecruitmentApplicationStatus);
}

async function notifyAdmins({
  applicationId,
  jobTitle,
  applicantName,
  phone,
  email,
  resumeUrl,
  resumeFilePath,
  resumeFileName,
}: {
  applicationId: number;
  jobTitle: string;
  applicantName: string;
  phone: string;
  email: string;
  resumeUrl: string;
  resumeFilePath: string;
  resumeFileName: string;
}) {
  const admins = db.prepare(`
    SELECT id, name, username, email
    FROM users
    WHERE role = 'admin'
  `).all() as Array<{ id: number; name: string | null; username: string; email: string | null }>;

  const content = [
    `应聘岗位：${jobTitle}`,
    `投递人：${applicantName}`,
    `联系电话：${phone}`,
    `邮箱：${email || '-'}`,
  ].join('\n');

  const html = `
    <div>
      <h3>收到新的简历投递</h3>
      <p><strong>应聘岗位：</strong>${escapeHtml(jobTitle)}</p>
      <p><strong>投递人：</strong>${escapeHtml(applicantName)}</p>
      <p><strong>联系电话：</strong>${escapeHtml(phone)}</p>
      <p><strong>邮箱：</strong>${escapeHtml(email || '-')}</p>
      <p><strong>简历文件：</strong>${escapeHtml(resumeFileName)}</p>
      <p>请登录系统的人力资源模块查看和处理。</p>
    </div>
  `;

  for (const admin of admins) {
    const notificationResult = db.prepare(`
      INSERT INTO notifications (
        title, content, sender_id, sender_name, receiver_id, receiver_name,
        type, email_sent, email_error, attachment_file, attachment_file_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      '新简历投递通知',
      content,
      null,
      '人力资源招聘',
      admin.id,
      admin.name || admin.username,
      'recruitment',
      0,
      null,
      resumeUrl,
      resumeFileName,
      localDateTime(),
    );
    const notificationId = Number(notificationResult.lastInsertRowid);

    if (admin.email) {
      const emailResult = await sendEmail(
        admin.email,
        `新简历投递：${jobTitle} - ${applicantName}`,
        html,
        { filePath: resumeFilePath, fileName: resumeFileName },
      );
      if (emailResult.success) {
        db.prepare('UPDATE notifications SET email_sent = 1 WHERE id = ?').run(notificationId);
      } else if (emailResult.error) {
        db.prepare('UPDATE notifications SET email_error = ? WHERE id = ?').run(emailResult.error, notificationId);
      }
    }
  }

  db.prepare('UPDATE recruitment_applications SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(applicationId);
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword')?.trim();
    const status = searchParams.get('status')?.trim();
    const jobId = searchParams.get('jobId')?.trim();
    const where: string[] = [];
    const params: unknown[] = [];

    if (keyword) {
      where.push('(applicant_name LIKE ? OR phone LIKE ? OR email LIKE ? OR job_title LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    if (status && status !== 'all' && isApplicationStatus(status)) {
      where.push('status = ?');
      params.push(status);
    }
    if (jobId && jobId !== 'all') {
      where.push('job_id = ?');
      params.push(Number(jobId));
    }

    const rows = db.prepare(`
      SELECT *
      FROM recruitment_applications
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY created_at DESC, id DESC
    `).all(...params) as RecruitmentApplicationDbRow[];

    const countRows = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM recruitment_applications
      GROUP BY status
    `).all() as Array<{ status: RecruitmentApplicationStatus; count: number }>;
    const totalRow = db.prepare('SELECT COUNT(*) as count FROM recruitment_applications').get() as { count: number };
    const counts = {
      total: totalRow.count,
      new: countRows.find((item) => item.status === '新投递')?.count || 0,
      viewed: countRows.find((item) => item.status === '已查看')?.count || 0,
      contacted: countRows.find((item) => item.status === '已联系')?.count || 0,
      rejected: countRows.find((item) => item.status === '不合适')?.count || 0,
    };

    return NextResponse.json({ success: true, applications: rows.map(parseRecruitmentApplication), counts });
  } catch (error) {
    console.error('Get recruitment applications error:', error);
    return NextResponse.json({ success: false, error: '获取简历投递失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const jobId = Number(cleanText(formData.get('jobId')));
    const applicantName = cleanText(formData.get('applicantName'));
    const phone = cleanText(formData.get('phone'));
    const email = cleanText(formData.get('email'));
    const education = cleanText(formData.get('education'));
    const experienceYears = cleanText(formData.get('experienceYears'));
    const currentCompany = cleanText(formData.get('currentCompany'));
    const expectedSalary = cleanText(formData.get('expectedSalary'));
    const message = cleanText(formData.get('message'));
    const resume = formData.get('resume');

    if (!jobId) {
      return NextResponse.json({ success: false, error: '请选择应聘职位' }, { status: 400 });
    }
    if (!applicantName) {
      return NextResponse.json({ success: false, error: '姓名不能为空' }, { status: 400 });
    }
    if (!phone) {
      return NextResponse.json({ success: false, error: '联系电话不能为空' }, { status: 400 });
    }
    if (!(resume instanceof File)) {
      return NextResponse.json({ success: false, error: '请上传 PDF 简历' }, { status: 400 });
    }

    const job = db.prepare(`
      SELECT id, title, status, deadline
      FROM recruitment_jobs
      WHERE id = ?
    `).get(jobId) as { id: number; title: string; status: RecruitmentJobStatus; deadline: string | null } | undefined;

    if (!job) {
      return NextResponse.json({ success: false, error: '职位不存在' }, { status: 404 });
    }
    if (job.status !== '招聘中' || (job.deadline && job.deadline < todayText())) {
      return NextResponse.json({ success: false, error: '该职位已停止招聘' }, { status: 400 });
    }

    const ext = path.extname(resume.name).toLowerCase();
    if (resume.type !== 'application/pdf' && ext !== '.pdf') {
      return NextResponse.json({ success: false, error: '简历只能上传 PDF 文件' }, { status: 400 });
    }

    const maxSize = 20 * 1024 * 1024;
    if (resume.size > maxSize) {
      return NextResponse.json({ success: false, error: 'PDF 简历不能超过 20MB' }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'recruitment-resumes');
    await mkdir(uploadDir, { recursive: true });

    const safeOriginalName = resume.name.replace(/[^\w.\-\u4e00-\u9fa5]/g, '_');
    const fileName = `resume_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.pdf`;
    const filePath = path.join(uploadDir, fileName);
    const fileUrl = `/uploads/recruitment-resumes/${fileName}`;
    await writeFile(filePath, Buffer.from(await resume.arrayBuffer()));

    const result = db.prepare(`
      INSERT INTO recruitment_applications (
        job_id, job_title, applicant_name, phone, email, education, experience_years,
        current_company, expected_salary, message, resume_url, resume_file_name, resume_file_size
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      job.id,
      job.title,
      applicantName,
      phone,
      email || null,
      education || null,
      experienceYears || null,
      currentCompany || null,
      expectedSalary || null,
      message || null,
      fileUrl,
      safeOriginalName || 'resume.pdf',
      resume.size,
    );
    const applicationId = Number(result.lastInsertRowid);

    await notifyAdmins({
      applicationId,
      jobTitle: job.title,
      applicantName,
      phone,
      email,
      resumeUrl: fileUrl,
      resumeFilePath: filePath,
      resumeFileName: safeOriginalName || 'resume.pdf',
    });

    return NextResponse.json({ success: true, id: applicationId, message: '简历投递成功' });
  } catch (error) {
    console.error('Create recruitment application error:', error);
    return NextResponse.json({ success: false, error: '提交简历失败' }, { status: 500 });
  }
}
