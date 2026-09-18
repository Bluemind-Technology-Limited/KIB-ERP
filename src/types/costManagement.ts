/**
 * Cost Management Types
 * Mirrors backend API responses and request payloads
 */

export type CostChangeStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type EntityType = 'Material' | 'BomIngredient' | 'ProductionOrder' | 'PurchaseOrderItem' | 'GoodsReceiptItem';

/**
 * Cost Audit Record
 */
export interface CostAudit {
  id: string;
  entityType: EntityType;
  entityId: string;
  fieldName: string;
  oldValue: number;
  newValue: number;
  reason: string;
  changeType: string;
  status: CostChangeStatus;
  rejectionReason?: string;
  changedBy: {
    id: string;
    fullName: string;
    email: string;
  };
  approvedBy?: {
    id: string;
    fullName: string;
    email: string;
  };
  changedAt: string;
  approvedAt?: string;
}

/**
 * Cost Request Payload
 */
export interface CostChangeRequest {
  entityType: EntityType;
  entityId: string;
  fieldName: string;
  newValue: number;
  reason: string;
  changeType: 'MANUAL_ADJUSTMENT' | 'VARIANCE_CORRECTION' | 'MARKET_UPDATE' | 'QUALITY_ADJUSTMENT';
}

/**
 * Cost Approval Payload
 */
export interface CostApprovalPayload {
  auditId: string;
  approved: boolean;
  rejectionReason?: string;
}

/**
 * Cost History Summary
 */
export interface CostHistoryItem {
  id: string;
  fieldName: string;
  oldValue: number;
  newValue: number;
  variance: number;
  variancePercent: number;
  status: CostChangeStatus;
  reason: string;
  changedBy: string;
  changedAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

/**
 * Material Cost Info
 */
export interface MaterialCostInfo {
  id: string;
  name: string;
  standardCost: number;
  lastCostUpdateAt?: string;
  lastCostUpdatedBy?: string;
  history: CostHistoryItem[];
}

/**
 * Pending Approval Item
 */
export interface PendingApproval {
  id: string;
  entityType: EntityType;
  entityId: string;
  entityName?: string;
  fieldName: string;
  oldValue: number;
  newValue: number;
  variance: number;
  variancePercent: number;
  reason: string;
  requiredApprovalLevel: 'MANAGER' | 'EXECUTIVE';
  changedBy: string;
  changedAt: string;
}

/**
 * Cost Audit Summary
 */
export interface CostAuditSummary {
  totalChanges: number;
  pendingApprovals: number;
  approvedChanges: number;
  rejectedChanges: number;
  averageVariancePercent: number;
  totalVarianceAmount: number;
  byEntity: Record<EntityType, number>;
  byStatus: Record<CostChangeStatus, number>;
  recentChanges: CostHistoryItem[];
}

/**
 * Cost Management State
 */
export interface CostManagementState {
  pendingApprovals: PendingApproval[];
  costHistory: CostHistoryItem[];
  auditSummary: CostAuditSummary | null;
  materialCostInfo: MaterialCostInfo | null;
  isLoading: boolean;
  error: string | null;
  successMessage: string | null;
}
