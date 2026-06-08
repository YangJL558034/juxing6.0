import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import {
  normalizeJobPayload,
  parseRecruitmentJob,
  type RecruitmentJobDbRow,
} from '@/lib/recruitment-records';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value || request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  return verifyToken(token);
}

function todayText() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getJob(id: number) {
  const row = db.prepare(`
    SELECT j.*, COUNT(a.id) as application_count
    FROM recruitment_jobs j
    LEFT JOIN recruitment_applications a ON a.job_id = j.id
    WHERE j.id = ?
    GROUP BY j.id
  `).get(id) as RecruitmentJobDbRow | undefined;
  return row ? parseRecruitmentJob(row) : null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isPublic = searchParams.get('public') === '1';

    if (!isPublic) {
      const user = await requireUser(request);
      if (!user) {
        return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
      }
    }

    const keyword = searchParams.get('keyword')?.trim();
    const status = searchParams.get('status')?.trim();
    const where: string[] = [];
    const params: unknown[] = [];

    if (isPublic) {
      where.push("j.status = '招聘中'");
      where.push("(j.deadline IS NULL OR j.deadline = '' OR j.deadline >= ?)");
      params.push(todayText());
    } else if (status && status !== 'all') {
      where.push('j.status = ?');
      params.push(status);
    }

    if (keyword) {
      where.push('(j.title LIKE ? OR j.department LIKE ? OR j.location LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    const rows = db.prepare(`
      SELECT j.*, COUNT(a.id) as application_count
      FROM recruitment_jobs j
      LEFT JOIN recruitment_applications a ON a.job_id = j.id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      GROUP BY j.id
      ORDER BY j.sort_order DESC, j.created_at DESC, j.id DESC
    `).all(...params) as RecruitmentJobDbRow[];

    return NextResponse.json({ success: true, jobs: rows.map(parseRecruitmentJob) });
  } catch (error) {
    console.error('Get recruitment jobs error:', error);
    return NextResponse.json({ success: false, error: '获取招聘职位失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const data = normalizeJobPayload(await request.json());
    if (!data.title) {
      return NextResponse.json({ success: false, error: '职位名称不能为空' }, { status: 400 });
    }

    const result = db.prepare(`
      INSERT INTO recruitment_jobs (
        title, department, location, salary_range, headcount, deadline,
        requirements, responsibilities, benefits, status, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.title,
      data.department || null,
      data.location || null,
      data.salaryRange || null,
      data.headcount,
      data.deadline || null,
      data.requirements || null,
      data.responsibilities || null,
      data.benefits || null,
      data.status,
      data.sortOrder,
    );

    return NextResponse.json({ success: true, job: getJob(Number(result.lastInsertRowid)), message: '职位添加成功' });
  } catch (error) {
    console.error('Create recruitment job error:', error);
    return NextResponse.json({ success: false, error: '添加招聘职位失败' }, { status: 500 });
  }
}
