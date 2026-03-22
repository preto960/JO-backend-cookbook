import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { Permission, ResourceType, PermissionAction } from '../models/Permission';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

export class PermissionController {
  private permissionRepository = AppDataSource.getRepository(Permission);

  getAllPermissions = async (req: AuthRequest, res: Response) => {
    try {
      const permissions = await this.permissionRepository.find({
        order: { role: 'ASC', resource: 'ASC' }
      });

      res.json({ permissions });
    } catch (error) {
      console.error('Error fetching permissions:', error);
      res.status(500).json({ message: 'Failed to fetch permissions' });
    }
  };

  getPermissionsByRole = async (req: AuthRequest, res: Response) => {
    try {
      const { role } = req.params;

      const permissions = await this.permissionRepository.find({
        where: { role },
        order: { resource: 'ASC' }
      });

      res.json({ permissions });
    } catch (error) {
      console.error('Error fetching permissions by role:', error);
      res.status(500).json({ message: 'Failed to fetch permissions' });
    }
  };

  getMyPermissions = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const permissions = await this.permissionRepository.find({
        where: { role: req.user.role },
        order: { resource: 'ASC' }
      });

      res.json({ permissions });
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      res.status(500).json({ message: 'Failed to fetch permissions' });
    }
  };

  checkPermission = async (req: AuthRequest, res: Response) => {
    try {
      const { role, resource, action } = req.query;

      if (!role || !resource || !action) {
        throw createError('Missing required parameters', 400);
      }

      const permission = await this.permissionRepository.findOne({
        where: { role: role as string, resource: resource as string }
      });

      if (!permission) {
        return res.json({ hasPermission: false });
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

      res.json({ hasPermission });
    } catch (error) {
      console.error('Error checking permission:', error);
      res.status(500).json({ message: 'Failed to check permission' });
    }
  };

  updatePermission = async (req: AuthRequest, res: Response) => {
    try {
      const { role, resource, canInMenu, canView, canCreate, canEdit, canDelete } = req.body;

      if (!role || !resource) {
        throw createError('Role and resource are required', 400);
      }

      let permission = await this.permissionRepository.findOne({
        where: { role, resource, pluginId: null }
      });

      if (permission) {
        permission.canInMenu = canInMenu ?? permission.canInMenu;
        permission.canView = canView ?? permission.canView;
        permission.canCreate = canCreate ?? permission.canCreate;
        permission.canEdit = canEdit ?? permission.canEdit;
        permission.canDelete = canDelete ?? permission.canDelete;
      } else {
        permission = this.permissionRepository.create({
          role,
          resource,
          pluginId: null,
          isDynamic: false,
          canInMenu: canInMenu ?? true,
          canView: canView ?? false,
          canCreate: canCreate ?? false,
          canEdit: canEdit ?? false,
          canDelete: canDelete ?? false
        });
      }

      await this.permissionRepository.save(permission);

      res.json({ message: 'Permission updated successfully', permission });
    } catch (error) {
      console.error('Error updating permission:', error);
      res.status(500).json({ message: 'Failed to update permission' });
    }
  };

  bulkUpdatePermissions = async (req: AuthRequest, res: Response) => {
    try {
      const { permissions } = req.body;

      if (!Array.isArray(permissions)) {
        throw createError('Permissions must be an array', 400);
      }

      const results = [];

      for (const perm of permissions) {
        const { role, resource, canInMenu, canView, canCreate, canEdit, canDelete } = perm;

        let permission = await this.permissionRepository.findOne({
          where: { role, resource, pluginId: null }
        });

        if (permission) {
          permission.canInMenu = canInMenu ?? permission.canInMenu;
          permission.canView = canView ?? permission.canView;
          permission.canCreate = canCreate ?? permission.canCreate;
          permission.canEdit = canEdit ?? permission.canEdit;
          permission.canDelete = canDelete ?? permission.canDelete;
        } else {
          permission = this.permissionRepository.create({
            role,
            resource,
            pluginId: null,
            isDynamic: false,
            canInMenu: canInMenu ?? true,
            canView: canView ?? false,
            canCreate: canCreate ?? false,
            canEdit: canEdit ?? false,
            canDelete: canDelete ?? false
          });
        }

        await this.permissionRepository.save(permission);
        results.push(permission);
      }

      res.json({ message: 'Permissions updated successfully', permissions: results });
    } catch (error) {
      console.error('Error bulk updating permissions:', error);
      res.status(500).json({ message: 'Failed to update permissions' });
    }
  };

  resetPermissions = async (req: AuthRequest, res: Response) => {
    try {
      await this.permissionRepository.clear();

      const defaultPermissions = this.getDefaultPermissions();
      await this.permissionRepository.save(defaultPermissions);

      const permissions = await this.permissionRepository.find({
        order: { role: 'ASC', resource: 'ASC' }
      });

      res.json({ message: 'Permissions reset to default successfully', permissions });
    } catch (error) {
      console.error('Error resetting permissions:', error);
      res.status(500).json({ message: 'Failed to reset permissions' });
    }
  };

  private getDefaultPermissions(): Partial<Permission>[] {
    const permissions: Partial<Permission>[] = [];

    // USER role
    permissions.push(
      { role: 'USER', resource: ResourceType.DASHBOARD, canInMenu: true, canView: true, canCreate: false, canEdit: false, canDelete: false, pluginId: null, isDynamic: false },
      { role: 'USER', resource: ResourceType.USERS, canInMenu: false, canView: false, canCreate: false, canEdit: false, canDelete: false, pluginId: null, isDynamic: false },
      { role: 'USER', resource: ResourceType.ROLES, canInMenu: false, canView: false, canCreate: false, canEdit: false, canDelete: false, pluginId: null, isDynamic: false },
      { role: 'USER', resource: ResourceType.SETTINGS, canInMenu: false, canView: false, canCreate: false, canEdit: false, canDelete: false, pluginId: null, isDynamic: false },
      { role: 'USER', resource: ResourceType.PROFILE, canInMenu: true, canView: true, canCreate: false, canEdit: true, canDelete: false, pluginId: null, isDynamic: false },
    );

    // ADMIN role
    permissions.push(
      { role: 'ADMIN', resource: ResourceType.DASHBOARD, canInMenu: true, canView: true, canCreate: true, canEdit: true, canDelete: true, pluginId: null, isDynamic: false },
      { role: 'ADMIN', resource: ResourceType.USERS, canInMenu: true, canView: true, canCreate: true, canEdit: true, canDelete: true, pluginId: null, isDynamic: false },
      { role: 'ADMIN', resource: ResourceType.ROLES, canInMenu: true, canView: true, canCreate: true, canEdit: true, canDelete: true, pluginId: null, isDynamic: false },
      { role: 'ADMIN', resource: ResourceType.SETTINGS, canInMenu: true, canView: true, canCreate: true, canEdit: true, canDelete: true, pluginId: null, isDynamic: false },
      { role: 'ADMIN', resource: ResourceType.PROFILE, canInMenu: true, canView: true, canCreate: false, canEdit: true, canDelete: false, pluginId: null, isDynamic: false },
      { role: 'ADMIN', resource: ResourceType.TRANSLATIONS, canInMenu: true, canView: true, canCreate: true, canEdit: true, canDelete: true, pluginId: null, isDynamic: false },
    );

    return permissions;
  }
}
