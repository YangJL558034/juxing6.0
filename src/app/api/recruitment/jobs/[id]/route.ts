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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idText } = await params;
    const id = Number(idText);
    const isPublic = new URL(request.url).searchParams.get('public') === '1';
    const job = getJob(id);

    if (!job) {
      return NextResponse.json({ success: false, error: '职位不存在' }, { status: 404 });
    }

    if (isPublic) {
      const expired = job.deadline && job.deadline < todayText();
      if (job.status !== '招聘中' || expired) {
        return NextResponse.json({ success: false, error: '职位已停止招聘' }, { status: 404 });
      }
    } else {
      const user = await requireUser(request);
      if (!user) {
        return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
      }
    }

    return NextResponse.json({ success: true, job });
  } catch (error) {
    console.error('Get recruitment job error:', error);
    return NextResponse.json({ success: false, error: '获取职位详情失败' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { id: idText } = await params;
    const id = Number(idText);
    const exists = getJob(id);
    if (!exists) {
      return NextResponse.json({ success: false, error: '职位不存在' }, { status: 404 });
    }

    const data = normalizeJobPayload(await request.json());
    if (!data.title) {
      return NextResponse.json({ success: false, error: '职位名称不能为空' }, { status: 400 });
    }

    db.prepare(`
      UPDATE recruitment_jobs
      SET title = ?, department = ?, location = ?, salary_range = ?, headcount = ?, deadline = ?,
          requirements = ?, responsibilities = ?, benefits = ?, status = ?, sort_order = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
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
      id,
    );

    return NextResponse.json({ success: true, job: getJob(id), message: '职位更新成功' });
  } catch (error) {
    console.error('Update recruitment job error:', error);
    return NextResponse.json({ success: false, error: '更新职位失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { id: idText } = await params;
    const id = Number(idText);
    const job = getJob(id);
    if (!job) {
      return NextResponse.json({ success: false, error: '职位不存在' }, { status: 404 });
    }
    if (job.applicationCount > 0) {
      return NextResponse.json({ success: false, error: '该职位已有简历投递，不能删除，请改为暂停或已结束' }, { status: 400 });
    }

    db.prepare('DELETE FROM recruitment_jobs WHERE id = ?').run(id);
    return NextResponse.json({ success: true, message: '职位删除成功' });
  } catch (error) {
    console.error('Delete recruitment job error:', error);
    return NextResponse.json({ success: false, error: '删除职位失败' }, { status: 500 });
  }
}
