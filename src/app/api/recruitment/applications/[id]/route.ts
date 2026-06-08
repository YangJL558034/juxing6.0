import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import {
  applicationStatuses,
  normalizeApplicationStatus,
  parseRecruitmentApplication,
  type RecruitmentApplicationDbRow,
} from '@/lib/recruitment-records';
import type { RecruitmentApplicationStatus } from '@/types/recruitment';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value || request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  return verifyToken(token);
}

function getApplication(id: number) {
  const row = db.prepare('SELECT * FROM recruitment_applications WHERE id = ?').get(id) as RecruitmentApplicationDbRow | undefined;
  return row ? parseRecruitmentApplication(row) : null;
}

function isApplicationStatus(value: string): value is RecruitmentApplicationStatus {
  return applicationStatuses.includes(value as RecruitmentApplicationStatus);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { id: idText } = await params;
    const id = Number(idText);
    if (!getApplication(id)) {
      return NextResponse.json({ success: false, error: '简历投递不存在' }, { status: 404 });
    }

    const body = await request.json();
    const status = normalizeApplicationStatus(body?.status);
    if (!isApplicationStatus(status)) {
      return NextResponse.json({ success: false, error: '简历状态无效' }, { status: 400 });
    }

    db.prepare(`
      UPDATE recruitment_applications
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, id);

    return NextResponse.json({ success: true, application: getApplication(id), message: '简历状态已更新' });
  } catch (error) {
    console.error('Update recruitment application error:', error);
    return NextResponse.json({ success: false, error: '更新简历状态失败' }, { status: 500 });
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
    if (!getApplication(id)) {
      return NextResponse.json({ success: false, error: '简历投递不存在' }, { status: 404 });
    }

    db.prepare('DELETE FROM recruitment_applications WHERE id = ?').run(id);
    return NextResponse.json({ success: true, message: '简历投递已删除' });
  } catch (error) {
    console.error('Delete recruitment application error:', error);
    return NextResponse.json({ success: false, error: '删除简历投递失败' }, { status: 500 });
  }
}
