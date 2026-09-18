import { create } from 'zustand';
import { axiosClient } from '../lib/axiosClient';
import type {
  CostManagementState,
  CostChangeRequest,
  CostApprovalPayload,
} from '../types/costManagement';

interface CostManagementActions {
  // Fetchers
  fetchPendingApprovals: () => Promise<void>;
  fetchCostHistory: (entityType: string, entityId: string) => Promise<void>;
  fetchAuditSummary: () => Promise<void>;
  fetchMaterialCostInfo: (materialId: string) => Promise<void>;

  // Mutations
  requestCostChange: (request: CostChangeRequest) => Promise<void>;
  approveCostChange: (payload: CostApprovalPayload) => Promise<void>;

  // State setters
  clearError: () => void;
  clearSuccess: () => void;
  reset: () => void;
}

const initialState: CostManagementState = {
  pendingApprovals: [],
  costHistory: [],
  auditSummary: null,
  materialCostInfo: null,
  isLoading: false,
  error: null,
  successMessage: null,
};

export const useCostManagementStore = create<CostManagementState & CostManagementActions>((set) => ({
  ...initialState,

  // Fetchers
  fetchPendingApprovals: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await axiosClient.get('/cost-management/pending-approvals');
      set({ pendingApprovals: response.data.approvals, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to fetch pending approvals',
        isLoading: false,
      });
    }
  },

  fetchCostHistory: async (entityType: string, entityId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axiosClient.get(
        `/cost-management/history/${entityType}/${entityId}`
      );
      set({ costHistory: response.data.history, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to fetch cost history',
        isLoading: false,
      });
    }
  },

  fetchAuditSummary: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await axiosClient.get('/cost-management/audit-summary');
      set({ auditSummary: response.data.summary, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to fetch audit summary',
        isLoading: false,
      });
    }
  },

  fetchMaterialCostInfo: async (materialId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axiosClient.get(
        `/cost-management/material/${materialId}/cost-info`
      );
      set({ materialCostInfo: response.data.costInfo, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to fetch material cost info',
        isLoading: false,
      });
    }
  },

  // Mutations
  requestCostChange: async (request: CostChangeRequest) => {
    set({ isLoading: true, error: null });
    try {
      await axiosClient.post('/cost-management/request-change', request);
      set({
        isLoading: false,
        successMessage: 'Cost change requested successfully',
      });
      // Refresh pending approvals
      const store = useCostManagementStore.getState();
      await store.fetchPendingApprovals();
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to request cost change',
        isLoading: false,
      });
    }
  },

  approveCostChange: async (payload: CostApprovalPayload) => {
    set({ isLoading: true, error: null });
    try {
      await axiosClient.post(
        `/cost-management/approvals/${payload.auditId}/approve`,
        {
          approved: payload.approved,
          rejectionReason: payload.rejectionReason,
        }
      );
      set({
        isLoading: false,
        successMessage: payload.approved
          ? 'Cost change approved successfully'
          : 'Cost change rejected successfully',
      });
      // Refresh pending approvals
      const store = useCostManagementStore.getState();
      await store.fetchPendingApprovals();
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to process approval',
        isLoading: false,
      });
    }
  },

  // State setters
  clearError: () => set({ error: null }),
  clearSuccess: () => set({ successMessage: null }),
  reset: () => set(initialState),
}));
