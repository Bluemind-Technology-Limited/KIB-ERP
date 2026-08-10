// Roles match the backend Prisma `UserRole` enum (separation of duties).
export type UserRole =
  | 'SUPER_ADMIN'
  | 'EXECUTIVE_ADMIN'
  | 'STORE_OFFICER'
  | 'PRODUCTION_MANAGER'
  | 'PROCUREMENT_OFFICER'
  | 'QA_INSPECTOR';

// User shape mirrors the Prisma User returned by GET /auth/me (camelCase).
export interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  phoneNumber?: string;
  createdAt?: string;
  updatedAt?: string;
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
