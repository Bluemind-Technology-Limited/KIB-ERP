// Mirrors the Prisma `users` table (keyed 1:1 on Supabase Auth user id).
export interface DbUserTable {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  full_name: string;
  role:
    | 'SUPER_ADMIN'
    | 'EXECUTIVE_ADMIN'
    | 'STORE_OFFICER'
    | 'PRODUCTION_MANAGER'
    | 'PRODUCTION_SUPERVISOR'
    | 'GRINDING_SUPERVISOR'
    | 'PROCUREMENT_OFFICER'
    | 'QC'
    | 'HEAD_OF_QC'
    | 'OPERATOR'
    | 'TECHNICIAN';
  is_active: boolean;
  phone_number?: string;
  created_at: string;
  updated_at: string;
}
