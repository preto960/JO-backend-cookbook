/**
 * src/middleware/recipePermission.ts
 *
 * Granular permission guard for the RECIPE_BOOK resource.
 *
 * Usage in routes:
 *   router.get('/',    authenticateToken, requireRecipePermission('view'),   controller.list)
 *   router.post('/',   authenticateToken, requireRecipePermission('create'),  controller.create)
 *   router.put('/:id', authenticateToken, requireRecipePermission('edit'),    controller.update)
 *   router.delete('/:id', authenticateToken, requireRecipePermission('delete'), controller.delete)
 *
 * How it works:
 *   1. Reads the requesting user's role from req.user (set by authenticateToken).
 *   2. Queries the permissions table for (role, 'RECIPE_BOOK').
 *   3. Checks the relevant can* flag.
 *   4. If the flag is false → 403.
 *   5. If no permission row exists at all → 403.
 */

import { Response, NextFunction } from 'express';
import { AppDataSource } from '../config/database';
import { Permission } from '../models/Permission';
import {
  getRecipeBookPermissionForRole,
  canEditOthersRecipes,
  canDeleteOthersRecipes,
} from '../services/recipeBookAccess';
import { AuthRequest } from './auth';

export type RecipeAction = 'view' | 'create' | 'edit' | 'delete';

const RESOURCE = 'RECIPE_BOOK';

export function requireRecipePermission(action: RecipeAction) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    // authenticateToken must have run first
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    try {
      const permissionRepo = AppDataSource.getRepository(Permission);

      const permission = await permissionRepo.findOne({
        where: {
          role:     req.user.role,
          resource: RESOURCE,
        },
      });

      if (!permission) {
        return res.status(403).json({
          message: `Your role (${req.user.role}) has no permissions configured for ${RESOURCE}`,
        });
      }

      const allowed =
        action === 'view'   ? permission.canView   :
        action === 'create' ? permission.canCreate :
        action === 'edit'   ? permission.canEdit   :
        action === 'delete' ? permission.canDelete :
        false;

      if (!allowed) {
        return res.status(403).json({
          message: `Your role (${req.user.role}) does not have ${action.toUpperCase()} permission for recipes`,
        });
      }

      next();
    } catch (error) {
      console.error('Error checking recipe permission:', error);
      return res.status(500).json({ message: 'Error checking permissions' });
    }
  };
}

/**
 * Secondary guard: owner of the recipe, or RECIPE_BOOK row grants elevated access
 * (see `canEditOthersRecipes` / `canDeleteOthersRecipes` in recipeBookAccess).
 * Use after `requireRecipePermission`.
 */
export function requireRecipeOwnerOrElevated(
  mode: 'edit' | 'delete',
  getOwnerId: (req: AuthRequest) => Promise<string | null>,
) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const perm = await getRecipeBookPermissionForRole(req.user.role);
    const bypass =
      mode === 'edit' ? canEditOthersRecipes(perm) : canDeleteOthersRecipes(perm);
    if (bypass) return next();

    const ownerId = await getOwnerId(req);
    if (!ownerId || ownerId !== req.user.id) {
      return res.status(403).json({ message: 'You are not allowed to modify this resource' });
    }

    next();
  };
}
