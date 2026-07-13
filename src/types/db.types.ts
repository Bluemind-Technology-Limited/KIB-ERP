// Database schema direct types and tables schema placeholder
export interface DbUserTable {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  full_name: string;
  role: string;
  is_active: boolean;
  phone_number?: string;
  created_at: string;
  updated_at: string;
}
