import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/database';
import { hasPermission } from '@/lib/permission-check';
import type { ItemClaimRecord, ItemClaimStatus } from '@/types/item-management';

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

interface UpdateClaimBody {
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

async function requireAdmin(request: NextRequest) {
  const user = await getCurrentUser(request.headers.get('cookie'));
  if (!user) return { user: null, response: NextResponse.json({ success: false, error: '未登录' }, { status: 401 }) };
  if (!hasPermission(user, 'administration')) {
    return { user: null, response: NextResponse.json({ success: false, error: '无权管理物品领用' }, { status: 403 }) };
  }
  return { user, response: null };
}

async function getId(context: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await context.params;
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin(request);
    if (auth.response) return auth.response;

    const id = await getId(context);
    if (!id) {
      return NextResponse.json({ success: false, error: '参数错误' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({})) as UpdateClaimBody;
    const itemId = Number(body.itemId);
    const quantity = Math.floor(Number(body.quantity || 0));
    const reason = asText(body.reason);

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ success: false, error: '请选择领用物品' }, { status: 400 });
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json({ success: false, error: '领用数量必须大于 0' }, { status: 400 });
    }
    if (!reason) {
      return NextResponse.json({ success: false, error: '请填写领用原因' }, { status: 400 });
    }

    const claim = db.prepare(`
      SELECT *
      FROM item_claim_records
      WHERE id = ? AND deleted_at IS NULL
    `).get(id) as ItemClaimRow | undefined;
    if (!claim) {
      return NextResponse.json({ success: false, error: '领用申请不存在' }, { status: 404 });
    }
    if (claim.status !== '待审核') {
      return NextResponse.json({ success: false, error: '已审核或已驳回的领用申请不能修改' }, { status: 400 });
    }

    const item = db.prepare('SELECT id, name, quantity FROM item_inventory WHERE id = ?').get(itemId) as ItemRow | undefined;
    if (!item) {
      return NextResponse.json({ success: false, error: '物品不存在' }, { status: 404 });
    }
    if (quantity > Number(item.quantity || 0)) {
      return NextResponse.json({ success: false, error: '领用数量不能超过当前剩余数量' }, { status: 400 });
    }

    db.prepare(`
      UPDATE item_claim_records
      SET item_id = ?,
          item_name = ?,
          quantity = ?,
          reason = ?,
          updated_at = datetime('now', '+8 hours')
      WHERE id = ?
    `).run(item.id, item.name, quantity, reason, id);

    const updated = db.prepare('SELECT * FROM item_claim_records WHERE id = ?').get(id) as ItemClaimRow;
    return NextResponse.json({ success: true, claim: mapClaim(updated), message: '领用申请已修改' });
  } catch (error) {
    console.error('Update item claim error:', error);
    return NextResponse.json({ success: false, error: '修改领用申请失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin(request);
    if (auth.response) return auth.response;

    const id = await getId(context);
    if (!id) {
      return NextResponse.json({ success: false, error: '参数错误' }, { status: 400 });
    }

    const claim = db.prepare(`
      SELECT *
      FROM item_claim_records
      WHERE id = ? AND deleted_at IS NULL
    `).get(id) as ItemClaimRow | undefined;
    if (!claim) {
      return NextResponse.json({ success: false, error: '领用申请不存在' }, { status: 404 });
    }
    db.prepare(`
      UPDATE item_claim_records
      SET deleted_at = datetime('now', '+8 hours'),
          updated_at = datetime('now', '+8 hours')
      WHERE id = ?
    `).run(id);

    return NextResponse.json({ success: true, message: '领用申请已删除' });
  } catch (error) {
    console.error('Delete item claim error:', error);
    return NextResponse.json({ success: false, error: '删除领用申请失败' }, { status: 500 });
  }
}
