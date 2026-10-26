import type { TenantRole } from '@/api/auth';

const rank: Record<TenantRole, number> = { viewer: 1, agent: 2, admin: 3, owner: 4 };

/** The same order the API uses; the API still decides, this only hides what would be refused. */
export function atLeast(role: TenantRole | null | undefined, min: TenantRole): boolean {
  return role ? rank[role] >= rank[min] : false;
}
