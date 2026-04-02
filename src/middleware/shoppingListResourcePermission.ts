import { Response, NextFunction } from 'express';
import { AppDataSource } from '../config/database';
import { Permission } from '../models/Permission';
import { AuthRequest } from './auth';

export type ShoppingListAction = 'view' | 'create' | 'edit' | 'delete';

const RESOURCE = 'SHOPPING_LISTS';

export function requireShoppingListPermission(action: ShoppingListAction) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    try {
      const permissionRepo = AppDataSource.getRepository(Permission);
      const permission = await permissionRepo.findOne({
        where: { role: req.user.role, resource: RESOURCE },
      });

      if (!permission) {
        return res.status(403).json({
          message: `Your role (${req.user.role}) has no permissions configured for ${RESOURCE}`,
        });
      }

      const allowed =
        action === 'view'
          ? permission.canView
          : action === 'create'
            ? permission.canCreate
            : action === 'edit'
              ? permission.canEdit
              : action === 'delete'
                ? permission.canDelete
                : false;

      if (!allowed) {
        return res.status(403).json({
          message: `Your role (${req.user.role}) does not have ${action.toUpperCase()} permission for shopping lists`,
        });
      }

      next();
    } catch (error) {
      console.error('Error checking shopping list permission:', error);
      return res.status(500).json({ message: 'Error checking permissions' });
    }
  };
}
