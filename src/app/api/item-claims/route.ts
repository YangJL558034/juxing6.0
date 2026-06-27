import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/database';
import { hasPermission } from '@/lib/permission-check';
import type { User } from '@/lib/auth';
import type { ItemClaimListResponse, ItemClaimRecord, ItemClaimStatus } from '@/types/item-management';

interface ItemRow {
  id: number;
  name: string;
  quantity: number | null;
}

interface ItemClaimRow {
  id: number;
  item_id: number;
  item_name: string;
  applicant_id: number | null;
  applicant_name: string;
  department: string | null;
  quantity: number | null;
  reason: string | null;
  status: ItemClaimStatus;
  reviewer_name: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

interface CreateClaimBody {
  applicantName?: unknown;
  department?: unknown;
  itemId?: unknown;
  quantity?: unknown;
  reason?: unknown;
}

function asText(value: unknown) {
  return String(value ?? '').trim();
}

function mapClaim(row: ItemClaimRow): ItemClaimRecord {
  return {
    id: row.id,
    itemId: row.item_id,
    itemName: row.item_name,
    applicantId: row.applicant_id,
    applicantName: row.applicant_name,
    department: row.department || '',
    quantity: Number(row.quantity || 0),
    reason: row.reason || '',
    status: row.status,
    reviewerName: row.reviewer_name || '',
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

async function requireUser(request: NextRequest) {
  return getCurrentUser(request.headers.get('cookie'));
}

function getClaimRows(user: User, canManage: boolean) {
  if (canManage) {
    return db.prepare(`
      SELECT *
      FROM item_claim_records
      WHERE deleted_at IS NULL
      ORDER BY
        CASE status WHEN '待审核' THEN 0 WHEN '已审核' THEN 1 ELSE 2 END,
        created_at DESC,
        id DESC
    `).all() as ItemClaimRow[];
  }

  return db.prepare(`
    SELECT *
    FROM item_claim_records
    WHERE deleted_at IS NULL AND applicant_id = ?
    ORDER BY created_at DESC, id DESC
  `).all(user.id) as ItemClaimRow[];
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json<ItemClaimListResponse>({ success: false, error: '未登录' }, { status: 401 });
    }

    const canManage = hasPermission(user, 'administration');
    const rows = getClaimRows(user, canManage);
    return NextResponse.json<ItemClaimListResponse>({ success: true, claims: rows.map(mapClaim) });
  } catch (error) {
    console.error('Get item claims error:', error);
    return NextResponse.json<ItemClaimListResponse>({ success: false, error: '获取领用记录失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);

    const body = await request.json().catch(() => ({})) as CreateClaimBody;
    const applicantName = user?.name || asText(body.applicantName);
    const department = user?.department || asText(body.department);
    const itemId = Number(body.itemId);
    const quantity = Math.floor(Number(body.quantity || 0));
    const reason = asText(body.reason);

    if (!applicantName) {
      return NextResponse.json({ success: false, error: '请填写申请人名称' }, { status: 400 });
    }
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ success: false, error: '请选择领用物品' }, { status: 400 });
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json({ success: false, error: '领用数量必须大于 0' }, { status: 400 });
    }
    if (!reason) {
      return NextResponse.json({ success: false, error: '请填写领用原因' }, { status: 400 });
    }

    const item = db.prepare('SELECT id, name, quantity FROM item_inventory WHERE id = ?').get(itemId) as ItemRow | undefined;
    if (!item) {
      return NextResponse.json({ success: false, error: '物品不存在' }, { status: 404 });
    }
    if (quantity > Number(item.quantity || 0)) {
      return NextResponse.json({ success: false, error: '领用数量不能超过当前剩余数量' }, { status: 400 });
    }

    const result = db.prepare(`
      INSERT INTO item_claim_records (
        item_id, item_name, applicant_id, applicant_name, department, quantity, reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      item.id,
      item.name,
      user?.id ?? null,
      applicantName,
      department,
      quantity,
      reason,
    );

    const row = db.prepare('SELECT * FROM item_claim_records WHERE id = ?').get(result.lastInsertRowid) as ItemClaimRow;
    return NextResponse.json({ success: true, claim: mapClaim(row), message: '物品领用申请已提交，等待后台审核' });
  } catch (error) {
    console.error('Create item claim error:', error);
    return NextResponse.json({ success: false, error: '提交物品领用申请失败' }, { status: 500 });
  }
}
