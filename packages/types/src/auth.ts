/**
 * Shared types for authentication and onboarding
 * Used across landing and dashboard apps
 */

export type ProfileType = 'merchant_owner' | 'developer' | 'agency';

export const PROFILE_TYPE_LABELS: Record<ProfileType, string> = {
  merchant_owner: 'Dueño de negocio',
  developer: 'Desarrollador',
  agency: 'Agencia',
};

export interface SignUpPayload {
  profile_type: ProfileType;
  merchant_name: string;
  full_name: string;
  email: string;
  phone: string;
  password: string;
}

export interface AccountUpdatePayload {
  merchantId: string;
  merchant_name: string;
  full_name: string;
  phone: string;
}

export interface UsersProfile {
  user_id: string;
  full_name: string;
  phone: string;
  profile_type: ProfileType;
  default_merchant_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Merchant {
  id: string;
  owner_user_id: string;
  name: string;
  country: string;
  currency: string;
  channel: string;
  status: string;
  onboarding_stage: string;
  created_at: string;
  updated_at: string;
}

export interface MerchantMember {
  merchant_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  created_at: string;
}

export interface SignUpResponse {
  ok: boolean;
  error?: string;
  redirectTo?: string;
  pendingVerification?: boolean;
}

export interface AccountUpdateResponse {
  ok: boolean;
  error?: string;
  message?: string;
}
