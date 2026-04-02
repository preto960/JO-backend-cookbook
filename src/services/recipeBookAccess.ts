import { AppDataSource } from '../config/database';
import { Permission } from '../models/Permission';

const RECIPE_BOOK = 'RECIPE_BOOK';

export async function getRecipeBookPermissionForRole(role: string): Promise<Permission | null> {
  return AppDataSource.getRepository(Permission).findOne({
    where: { role, resource: RECIPE_BOOK },
  });
}

/**
 * Full catalog: all active recipes (incl. others' unpublished). Replaces hard-coded ADMIN/DEVELOPER.
 * Requires view + create + edit on RECIPE_BOOK (matches seeded ADMIN / DEVELOPER rows).
 */
export function canAccessFullRecipeCatalog(p: Permission | null): boolean {
  return !!(p?.canView && p.canCreate && p.canEdit);
}

/** May edit or publish another user's recipe. */
export function canEditOthersRecipes(p: Permission | null): boolean {
  return canAccessFullRecipeCatalog(p);
}

/**
 * Soft-delete another user's recipe. Requires canDelete plus editorial access (ADMIN row in seed;
 * DEVELOPER has canDelete false so cannot delete others — same as previous code).
 */
export function canDeleteOthersRecipes(p: Permission | null): boolean {
  return !!(p?.canDelete && canAccessFullRecipeCatalog(p));
}
