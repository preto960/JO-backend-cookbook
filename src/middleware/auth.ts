import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { User, UserRole } from '../models/User';
import { Permission, ResourceType, PermissionAction } from '../models/Permission';

export interface AuthRequest extends Request {
  user?: User;
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; tenantId?: string };
    const userRepository = AppDataSource.getRepository(User);
    
    // Build where condition based on multi-tenant mode
    const whereCondition = req.isMultiTenantMode && decoded.tenantId
      ? { id: decoded.userId, tenantId: decoded.tenantId, isActive: true }
      : { id: decoded.userId, isActive: true };

    const user = await userRepository.findOne({ 
      where: whereCondition
      // relations: ['tenant'] // Commented out until relations are restored
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid token or user not found' });
    }

    // Verify tenant context matches
    if (req.isMultiTenantMode && req.tenantId && user.tenantId !== req.tenantId) {
      return res.status(403).json({ message: 'Token tenant mismatch' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
};

export const requireDeveloper = requireRole(['DEVELOPER', 'ADMIN']);
export const requireAdmin = requireRole(['ADMIN']);

// Check if user has specific permission for a resource
export const requirePermission = (resource: ResourceType, action: PermissionAction) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    try {
      const permissionRepository = AppDataSource.getRepository(Permission);
      const permission = await permissionRepository.findOne({
        where: {
          role: req.user.role,
          resource: resource
        }
      });

      if (!permission) {
        return res.status(403).json({ message: 'No permissions configured for this resource' });
      }

      let hasPermission = false;
      switch (action) {
        case PermissionAction.VIEW:
          hasPermission = permission.canView;
          break;
        case PermissionAction.CREATE:
          hasPermission = permission.canCreate;
          break;
        case PermissionAction.EDIT:
          hasPermission = permission.canEdit;
          break;
        case PermissionAction.DELETE:
          hasPermission = permission.canDelete;
          break;
      }

      if (!hasPermission) {
        return res.status(403).json({ message: 'Insufficient permissions for this action' });
      }

      next();
    } catch (error) {
      console.error('Error checking permission:', error);
      return res.status(500).json({ message: 'Error checking permissions' });
    }
  };
};