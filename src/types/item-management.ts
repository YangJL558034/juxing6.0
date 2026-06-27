export interface ItemInventoryRecord {
  id: number;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  remark: string;
  claimedQuantity: number;
  pendingQuantity: number;
  remainingQuantity: number;
  totalValue: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface ItemInventorySummary {
  itemCount: number;
  totalQuantity: number;
  remainingQuantity: number;
  claimedQuantity: number;
  pendingQuantity: number;
  totalValue: number;
}

export interface ItemInventoryListResponse {
  success: boolean;
  items?: ItemInventoryRecord[];
  summary?: ItemInventorySummary;
  error?: string;
}

export type ItemClaimStatus = '待审核' | '已审核' | '已驳回';

export interface ItemClaimRecord {
  id: number;
  itemId: number;
  itemName: string;
  applicantId: number | null;
  applicantName: string;
  department: string;
  quantity: number;
  reason: string;
  status: ItemClaimStatus;
  reviewerName: string;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
}

export interface ItemClaimListResponse {
  success: boolean;
  claims?: ItemClaimRecord[];
  error?: string;
}
