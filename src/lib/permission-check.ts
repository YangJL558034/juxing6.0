import type { User } from '@/lib/auth';
import { db } from '@/lib/database';

const managerPermissions = new Set([
  'dashboard',
  'organization',
  'users',
  'approvals',
  'expense_claims',
  'purchase_requests',
]);

export function hasPermission(user: User | null | undefined, permission: string) {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'super_admin') return true;
  if (user.role === 'manager' && managerPermissions.has(permission)) return true;

  const row = db.prepare(`
    SELECT up.granted AS granted
    FROM user_permissions up
    JOIN permissions p ON p.id = up.permission_id
    WHERE up.user_id = ? AND p.code = ?
  `).get(user.id, permission) as { granted: number | null } | undefined;

  return row?.granted === 1;
}

export function hasAnyPermission(user: User | null | undefined, permissions: string[]) {
  return permissions.some((permission) => hasPermission(user, permission));
}
