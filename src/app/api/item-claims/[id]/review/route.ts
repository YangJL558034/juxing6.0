import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/database';
import { hasPermission } from '@/lib/permission-check';
import type { ItemClaimRecord, ItemClaimStatus } from '@/types/item-management';

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

interface ItemRow {
  id: number;
  quantity: number | null;
}

interface ReviewBody {
  action?: unknown;
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

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    if (!hasPermission(user, 'administration')) {
      return NextResponse.json({ success: false, error: '无权审核物品领用' }, { status: 403 });
    }

    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ success: false, error: '参数错误' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({})) as ReviewBody;
    const action = String(body.action || 'approve').trim();
    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ success: false, error: '审核动作错误' }, { status: 400 });
    }

    const result = db.transaction(() => {
      const claim = db.prepare(`
        SELECT *
        FROM item_claim_records
        WHERE id = ? AND deleted_at IS NULL
      `).get(id) as ItemClaimRow | undefined;
      if (!claim) {
        return { ok: false as const, status: 404, error: '领用申请不存在' };
      }
      if (claim.status !== '待审核') {
        return { ok: false as const, status: 400, error: '该领用申请已审核' };
      }

      if (action === 'approve') {
        const item = db.prepare('SELECT id, quantity FROM item_inventory WHERE id = ?')
          .get(claim.item_id) as ItemRow | undefined;
        if (!item) {
          return { ok: false as const, status: 404, error: '物品不存在' };
        }
        if (Number(item.quantity || 0) < Number(claim.quantity || 0)) {
          return { ok: false as const, status: 400, error: '物品剩余数量不足' };
        }

        db.prepare(`
          UPDATE item_inventory
          SET quantity = quantity - ?,
              updated_at = datetime('now', '+8 hours')
          WHERE id = ?
        `).run(Number(claim.quantity || 0), claim.item_id);
      }

      db.prepare(`
        UPDATE item_claim_records
        SET status = ?,
            reviewer_name = ?,
            reviewed_at = datetime('now', '+8 hours'),
            updated_at = datetime('now', '+8 hours')
        WHERE id = ?
      `).run(action === 'approve' ? '已审核' : '已驳回', user.name || user.username, id);

      const updated = db.prepare('SELECT * FROM item_claim_records WHERE id = ?').get(id) as ItemClaimRow;
      return { ok: true as const, claim: mapClaim(updated) };
    })();

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      claim: result.claim,
      message: action === 'approve' ? '领用申请已审核，库存已扣减' : '领用申请已驳回',
    });
  } catch (error) {
    console.error('Review item claim error:', error);
    return NextResponse.json({ success: false, error: '审核物品领用失败' }, { status: 500 });
  }
}
