export type UserRole =
  | 'SUPER_ADMIN'
  | 'EXECUTIVE_ADMIN'
  | 'PRODUCTION_MANAGER'
  | 'INVENTORY_OFFICER'
  | 'SALES_MANAGER'
  | 'DISTRIBUTOR'
  | 'SALES_REP'
  | 'FARM_MANAGER'
  | 'OPERATIONS_OFFICER';

export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  phone_number?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CustomerVisit {
  id?: string;
  rep_id: string;
  customer_name: string;
  check_in_lat: number;
  check_in_lng: number;
  verified_via_mapbox?: boolean;
  visit_image_r2_url?: string;
  notes?: string;
  created_at?: string;
}

export interface SfaOrder {
  id?: string;
  distributor_id: string;
  created_by: string;
  total_amount: number;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  created_at?: string;
}

export interface ErpBatch {
  id?: string;
  batch_number: string;
  recipe_id: string;
  target_quantity: number;
  actual_yield?: number;
  status: 'SCHEDULED' | 'PROCESSING' | 'COMPLETED' | 'WASTED';
  scheduled_start?: string;
  actual_end?: string;
  created_by: string;
}
