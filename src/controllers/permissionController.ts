import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { Permission, ResourceType, PermissionAction } from '../models/Permission';
import { UserRole } from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { pluginPermissionService } from '../services/pluginPermissionService';
import { pusherService } from '../services/pusherService';

export class PermissionController {
  private permissionRepository = AppDataSource.getRepository(Permission);

  // Get all permissions
  getAllPermissions = async (req: AuthRequest, res: Response) => {
    try {
      const permissions = await this.permissionRepository.find({
        order: {
          role: 'ASC',
          resource: 'ASC'
        }
      });

      res.json({ permissions });
    } catch (error) {
      console.error('Error fetching permissions:', error);
      res.status(500).json({ message: 'Failed to fetch permissions' });
    }
  };

  // Get permissions by role
  getPermissionsByRole = async (req: AuthRequest, res: Response) => {
    try {
      const { role } = req.params;

      if (!Object.values(UserRole).includes(role as UserRole)) {
        throw createError('Invalid role', 400);
      }

      const permissions = await this.permissionRepository.find({
        where: { role: role as UserRole },
        order: { resource: 'ASC' }
      });

      res.json({ permissions });
    } catch (error) {
      console.error('Error fetching permissions by role:', error);
      res.status(500).json({ message: 'Failed to fetch permissions' });
    }
  };

  // Get current user's permissions
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

  // Check if user has permission
  checkPermission = async (req: AuthRequest, res: Response) => {
    try {
      const { role, resource, action } = req.query;

      if (!role || !resource || !action) {
        throw createError('Missing required parameters', 400);
      }

      const permission = await this.permissionRepository.findOne({
        where: {
          role: role as UserRole,
          resource: resource as ResourceType
        }
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

  // Update permission
  updatePermission = async (req: AuthRequest, res: Response) => {
    try {
      const { role, resource, canInMenu, canView, canCreate, canEdit, canDelete, pluginId } = req.body;

      if (!role || !resource) {
        throw createError('Role and resource are required', 400);
      }

      // Build where condition - include pluginId if present, otherwise ensure it's null for base permissions
      const whereCondition: any = {
        role: role as UserRole,
        resource: resource as ResourceType
      };

      // For base system permissions, explicitly check for null pluginId
      if (pluginId === undefined || pluginId === null) {
        whereCondition.pluginId = null;
      } else {
        whereCondition.pluginId = pluginId;
      }

      // Find existing permission
      let permission = await this.permissionRepository.findOne({
        where: whereCondition
      });

      if (permission) {
        // Update existing
        permission.canInMenu = canInMenu ?? permission.canInMenu;
        permission.canView = canView ?? permission.canView;
        permission.canCreate = canCreate ?? permission.canCreate;
        permission.canEdit = canEdit ?? permission.canEdit;
        permission.canDelete = canDelete ?? permission.canDelete;
      } else {
        // Create new
        permission = this.permissionRepository.create({
          role: role as UserRole,
          resource: resource as ResourceType,
          pluginId: pluginId || null,
          isDynamic: pluginId ? true : false,
          canInMenu: canInMenu ?? true,
          canView: canView ?? false,
          canCreate: canCreate ?? false,
          canEdit: canEdit ?? false,
          canDelete: canDelete ?? false
        });
      }

      await this.permissionRepository.save(permission);

      // Notify via Pusher
      await pusherService.notifyPermissionsUpdated({
        role,
        resource,
        pluginId: null,
        type: 'single'
      });

      res.json({
        message: 'Permission updated successfully',
        permission
      });
    } catch (error) {
      console.error('Error updating permission:', error);
      res.status(500).json({ message: 'Failed to update permission' });
    }
  };

  // Bulk update permissions
  bulkUpdatePermissions = async (req: AuthRequest, res: Response) => {
    try {
      const { permissions } = req.body;

      if (!Array.isArray(permissions)) {
        throw createError('Permissions must be an array', 400);
      }

      const results = [];

      for (const perm of permissions) {
        const { role, resource, canInMenu, canView, canCreate, canEdit, canDelete, pluginId } = perm;

        // Build where condition - include pluginId if present, otherwise ensure it's null for base permissions
        const whereCondition: any = {
          role: role as UserRole,
          resource: resource as ResourceType
        };

        // For base system permissions, explicitly check for null pluginId
        if (pluginId === undefined || pluginId === null) {
          whereCondition.pluginId = null;
        } else {
          whereCondition.pluginId = pluginId;
        }

        let permission = await this.permissionRepository.findOne({
          where: whereCondition
        });

        if (permission) {
          // Update existing permission
          permission.canInMenu = canInMenu ?? permission.canInMenu;
          permission.canView = canView ?? permission.canView;
          permission.canCreate = canCreate ?? permission.canCreate;
          permission.canEdit = canEdit ?? permission.canEdit;
          permission.canDelete = canDelete ?? permission.canDelete;
        } else {
          // Create new permission
          permission = this.permissionRepository.create({
            role: role as UserRole,
            resource: resource as ResourceType,
            pluginId: pluginId || null,
            isDynamic: pluginId ? true : false,
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

      // Extract affected roles for notification
      const affectedRoles = Array.from(new Set(permissions.map((p: any) => p.role).filter(Boolean))) as string[];

      // Notify via WebSocket
      await pusherService.notifyPermissionsUpdated({
        affectedRoles,
        type: 'bulk'
      });

      res.json({
        message: 'Permissions updated successfully',
        permissions: results
      });
    } catch (error) {
      console.error('Error bulk updating permissions:', error);
      res.status(500).json({ message: 'Failed to update permissions' });
    }
  };

  // Reset permissions to default
  resetPermissions = async (req: AuthRequest, res: Response) => {
    try {
      // Delete all existing permissions
      await this.permissionRepository.clear();

      // Create default permissions
      const defaultPermissions = this.getDefaultPermissions();
      await this.permissionRepository.save(defaultPermissions);

      const permissions = await this.permissionRepository.find({
        order: {
          role: 'ASC',
          resource: 'ASC'
        }
      });

      // Notify via WebSocket - affects all roles
      await pusherService.notifyPermissionsUpdated({
        affectedRoles: Object.values(UserRole),
        type: 'reset'
      });

      res.json({
        message: 'Permissions reset to default successfully',
        permissions
      });
    } catch (error) {
      console.error('Error resetting permissions:', error);
      res.status(500).json({ message: 'Failed to reset permissions' });
    }
  };

  // Helper method to get default permissions
  private getDefaultPermissions() {
    const permissions: Partial<Permission>[] = [];

    // USER role - Limited access
    permissions.push(
      { role: 'USER', resource: ResourceType.DASHBOARD as string, canInMenu: true, canView: true, canCreate: false, canEdit: false, canDelete: false, pluginId: null, isDynamic: false },
      { role: 'USER', resource: ResourceType.MARKET as string, canInMenu: false, canView: false, canCreate: false, canEdit: false, canDelete: false, pluginId: null, isDynamic: false },
      { role: 'USER', resource: ResourceType.PLUGINS as string, canInMenu: false, canView: false, canCreate: false, canEdit: false, canDelete: false, pluginId: null, isDynamic: false },
      { role: 'USER', resource: ResourceType.USERS as string, canInMenu: false, canView: false, canCreate: false, canEdit: false, canDelete: false, pluginId: null, isDynamic: false },
      { role: 'USER', resource: ResourceType.ROLES as string, canInMenu: false, canView: false, canCreate: false, canEdit: false, canDelete: false, pluginId: null, isDynamic: false },
      { role: 'USER', resource: ResourceType.SETTINGS as string, canInMenu: false, canView: false, canCreate: false, canEdit: false, canDelete: false, pluginId: null, isDynamic: false },
      { role: 'USER', resource: ResourceType.PROFILE as string, canInMenu: true, canView: true, canCreate: false, canEdit: true, canDelete: false, pluginId: null, isDynamic: false }
    );

    // DEVELOPER role - More access
    permissions.push(
      { role: 'DEVELOPER', resource: ResourceType.DASHBOARD as string, canInMenu: true, canView: true, canCreate: false, canEdit: false, canDelete: false, pluginId: null, isDynamic: false },
      { role: 'DEVELOPER', resource: ResourceType.MARKET as string, canInMenu: true, canView: true, canCreate: true, canEdit: true, canDelete: false, pluginId: null, isDynamic: false },
      { role: 'DEVELOPER', resource: ResourceType.PLUGINS as string, canInMenu: true, canView: true, canCreate: true, canEdit: true, canDelete: true, pluginId: null, isDynamic: false },
      { role: 'DEVELOPER', resource: ResourceType.USERS as string, canInMenu: false, canView: false, canCreate: false, canEdit: false, canDelete: false, pluginId: null, isDynamic: false },
      { role: 'DEVELOPER', resource: ResourceType.ROLES as string, canInMenu: false, canView: false, canCreate: false, canEdit: false, canDelete: false, pluginId: null, isDynamic: false },
      { role: 'DEVELOPER', resource: ResourceType.SETTINGS as string, canInMenu: false, canView: false, canCreate: false, canEdit: false, canDelete: false, pluginId: null, isDynamic: false },
      { role: 'DEVELOPER', resource: ResourceType.PROFILE as string, canInMenu: true, canView: true, canCreate: false, canEdit: true, canDelete: false, pluginId: null, isDynamic: false }
    );

    // ADMIN role - Full access
    permissions.push(
      { role: 'ADMIN', resource: ResourceType.DASHBOARD as string, canInMenu: true, canView: true, canCreate: true, canEdit: true, canDelete: true, pluginId: null, isDynamic: false },
      { role: 'ADMIN', resource: ResourceType.MARKET as string, canInMenu: true, canView: true, canCreate: true, canEdit: true, canDelete: true, pluginId: null, isDynamic: false },
      { role: 'ADMIN', resource: ResourceType.PLUGINS as string, canInMenu: true, canView: true, canCreate: true, canEdit: true, canDelete: true, pluginId: null, isDynamic: false },
      { role: 'ADMIN', resource: ResourceType.USERS as string, canInMenu: true, canView: true, canCreate: true, canEdit: true, canDelete: true, pluginId: null, isDynamic: false },
      { role: 'ADMIN', resource: ResourceType.ROLES as string, canInMenu: true, canView: true, canCreate: true, canEdit: true, canDelete: true, pluginId: null, isDynamic: false },
      { role: 'ADMIN', resource: ResourceType.SETTINGS as string, canInMenu: true, canView: true, canCreate: true, canEdit: true, canDelete: true, pluginId: null, isDynamic: false },
      { role: 'ADMIN', resource: ResourceType.PROFILE as string, canInMenu: true, canView: true, canCreate: false, canEdit: true, canDelete: false, pluginId: null, isDynamic: false }
    );

    return permissions;
  }

  // ============================================
  // PLUGIN PERMISSIONS ENDPOINTS
  // ============================================

  // Get base system permissions only
  getBasePermissions = async (req: AuthRequest, res: Response) => {
    try {
      const permissions = await pluginPermissionService.getBasePermissions();
      res.json({ permissions });
    } catch (error) {
      console.error('Error fetching base permissions:', error);
      res.status(500).json({ message: 'Failed to fetch base permissions' });
    }
  };

  // Get all plugin permissions
  getPluginPermissions = async (req: AuthRequest, res: Response) => {
    try {
      const permissions = await pluginPermissionService.getAllPluginPermissions();
      res.json({ permissions });
    } catch (error) {
      console.error('Error fetching plugin permissions:', error);
      res.status(500).json({ message: 'Failed to fetch plugin permissions' });
    }
  };

  // Get permissions for a specific plugin
  getPermissionsByPlugin = async (req: AuthRequest, res: Response) => {
    try {
      const { pluginId } = req.params;

      if (!pluginId) {
        throw createError('Plugin ID is required', 400);
      }

      const permissions = await pluginPermissionService.getPluginPermissions(pluginId);
      res.json({ permissions });
    } catch (error) {
      console.error('Error fetching permissions by plugin:', error);
      res.status(500).json({ message: 'Failed to fetch permissions' });
    }
  };

  // Get permissions grouped by plugin
  getPermissionsGrouped = async (req: AuthRequest, res: Response) => {
    try {
      const grouped = await pluginPermissionService.getPermissionsGroupedByPlugin();
      res.json({ grouped });
    } catch (error) {
      console.error('Error fetching grouped permissions:', error);
      res.status(500).json({ message: 'Failed to fetch grouped permissions' });
    }
  };

  // Update plugin permission
  updatePluginPermission = async (req: AuthRequest, res: Response) => {
    try {
      const { pluginId, role, resource, canInMenu, canView, canCreate, canEdit, canDelete } = req.body;

      if (!pluginId || !role || !resource) {
        throw createError('Plugin ID, role, and resource are required', 400);
      }

      const permission = await pluginPermissionService.updatePluginPermission(
        pluginId,
        role as UserRole,
        resource,
        { canInMenu, canView, canCreate, canEdit, canDelete }
      );

      if (!permission) {
        throw createError('Permission not found', 404);
      }

      // Notify via Pusher
      console.log('📡 Sending plugin permission update notification:', { pluginId, role, resource, type: 'single' });
      await pusherService.notifyPluginPermissionUpdated({
        pluginId,
        role,
        resource,
        type: 'single',
        updatedBy: req.user?.id
      });

      res.json({
        message: 'Plugin permission updated successfully',
        permission
      });
    } catch (error) {
      console.error('Error updating plugin permission:', error);
      res.status(500).json({ message: 'Failed to update plugin permission' });
    }
  };

  // Bulk update plugin permissions
  bulkUpdatePluginPermissions = async (req: AuthRequest, res: Response) => {
    try {
      const { pluginId, permissions } = req.body;

      if (!pluginId || !Array.isArray(permissions) || permissions.length === 0) {
        throw createError('Plugin ID and permissions array are required', 400);
      }

      const updatedPermissions = [];
      const affectedRoles = new Set<string>();

      for (const perm of permissions) {
        const { role, resource, canInMenu, canView, canCreate, canEdit, canDelete } = perm;

        if (!role || !resource) {
          continue; // Skip invalid entries
        }

        const permission = await pluginPermissionService.updatePluginPermission(
          pluginId,
          role as UserRole,
          resource,
          { canInMenu, canView, canCreate, canEdit, canDelete }
        );

        if (permission) {
          updatedPermissions.push(permission);
          affectedRoles.add(role);
        }
      }

      // Notify via Pusher ONCE for all updates with affected roles
      console.log('📡 Sending bulk plugin permission update notification:', { pluginId, type: 'bulk', affectedRoles: Array.from(affectedRoles) });
      await pusherService.notifyPluginPermissionUpdated({
        pluginId,
        type: 'bulk',
        affectedRoles: Array.from(affectedRoles),
        updatedBy: req.user?.id
      });

      res.json({
        message: 'Plugin permissions updated successfully',
        permissions: updatedPermissions
      });
    } catch (error) {
      console.error('Error bulk updating plugin permissions:', error);
      res.status(500).json({ message: 'Failed to bulk update plugin permissions' });
    }
  };
}

