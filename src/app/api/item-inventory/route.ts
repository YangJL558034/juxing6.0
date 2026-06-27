import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/database';
import { hasPermission } from '@/lib/permission-check';
import type {
  ItemInventoryListResponse,
  ItemInventoryRecord,
  ItemInventorySummary,
} from '@/types/item-management';

interface ItemInventoryRow {
  id: number;
  name: string;
  category: string | null;
  unit: string | null;
  quantity: number | null;
  unit_price: number | null;
  remark: string | null;
  claimed_quantity: number | null;
  pending_quantity: number | null;
  created_at: string;
  updated_at: string | null;
}

interface CreateItemBody {
  name?: unknown;
  category?: unknown;
  unit?: unknown;
  quantity?: unknown;
  unitPrice?: unknown;
  remark?: unknown;
}

function asText(value: unknown) {
  return String(value ?? '').trim();
}

function asNonNegativeNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : 0;
}

function mapItem(row: ItemInventoryRow): ItemInventoryRecord {
  const quantity = Number(row.quantity || 0);
  const unitPrice = Number(row.unit_price || 0);
  const claimedQuantity = Number(row.claimed_quantity || 0);
  const pendingQuantity = Number(row.pending_quantity || 0);
  return {
    id: row.id,
    name: row.name,
    category: row.category || '',
    unit: row.unit || '个',
    quantity,
    unitPrice,
    remark: row.remark || '',
    claimedQuantity,
    pendingQuantity,
    remainingQuantity: quantity,
    totalValue: Number((quantity * unitPrice).toFixed(2)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function summarize(items: ItemInventoryRecord[]): ItemInventorySummary {
  return items.reduce<ItemInventorySummary>((summary, item) => ({
    itemCount: summary.itemCount + 1,
    totalQuantity: summary.totalQuantity + item.quantity + item.claimedQuantity,
    remainingQuantity: summary.remainingQuantity + item.remainingQuantity,
    claimedQuantity: summary.claimedQuantity + item.claimedQuantity,
    pendingQuantity: summary.pendingQuantity + item.pendingQuantity,
    totalValue: Number((summary.totalValue + item.totalValue).toFixed(2)),
  }), {
    itemCount: 0,
    totalQuantity: 0,
    remainingQuantity: 0,
    claimedQuantity: 0,
    pendingQuantity: 0,
    totalValue: 0,
  });
}

async function requireUser(request: NextRequest) {
  return getCurrentUser(request.headers.get('cookie'));
}

export async function GET() {
  try {
    const rows = db.prepare(`
      SELECT
        i.*,
        COALESCE(SUM(CASE WHEN c.status = '已审核' AND c.deleted_at IS NULL THEN c.quantity ELSE 0 END), 0) AS claimed_quantity,
        COALESCE(SUM(CASE WHEN c.status = '待审核' AND c.deleted_at IS NULL THEN c.quantity ELSE 0 END), 0) AS pending_quantity
      FROM item_inventory i
      LEFT JOIN item_claim_records c ON c.item_id = i.id
      GROUP BY i.id
      ORDER BY i.created_at DESC, i.id DESC
    `).all() as ItemInventoryRow[];

    const items = rows.map(mapItem);
    return NextResponse.json<ItemInventoryListResponse>({
      success: true,
      items,
      summary: summarize(items),
    });
  } catch (error) {
    console.error('Get item inventory error:', error);
    return NextResponse.json<ItemInventoryListResponse>({ success: false, error: '获取物品库失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    if (!hasPermission(user, 'administration')) {
      return NextResponse.json({ success: false, error: '无权管理物品库' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({})) as CreateItemBody;
    const name = asText(body.name);
    const category = asText(body.category);
    const unit = asText(body.unit) || '个';
    const quantity = Math.floor(asNonNegativeNumber(body.quantity));
    const unitPrice = asNonNegativeNumber(body.unitPrice);
    const remark = asText(body.remark);

    if (!name) {
      return NextResponse.json({ success: false, error: '请填写物品名称' }, { status: 400 });
    }

    const result = db.prepare(`
      INSERT INTO item_inventory (name, category, unit, quantity, unit_price, remark)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, category, unit, quantity, unitPrice, remark);

    const row = db.prepare(`
      SELECT i.*, 0 AS claimed_quantity, 0 AS pending_quantity
      FROM item_inventory i
      WHERE i.id = ?
    `).get(result.lastInsertRowid) as ItemInventoryRow;

    return NextResponse.json({ success: true, item: mapItem(row), message: '物品已加入物品库' });
  } catch (error) {
    console.error('Create item inventory error:', error);
    return NextResponse.json({ success: false, error: '保存物品失败' }, { status: 500 });
  }
}
