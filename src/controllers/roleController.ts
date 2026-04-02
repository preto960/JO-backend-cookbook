import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Role } from '../models/Role';
import { User } from '../models/User';
import { Permission } from '../models/Permission';
import { AuthRequest } from '../middleware/auth';
 
export class RoleController {
  private roleRepository = AppDataSource.getRepository(Role);
  private userRepository = AppDataSource.getRepository(User);
  private permissionRepository = AppDataSource.getRepository(Permission);
 
  getAllRoles = async (req: AuthRequest, res: Response) => {
    try {
      const { includeInactive = false } = req.query;
 
      const queryBuilder = this.roleRepository.createQueryBuilder('role');
 
      if (!includeInactive) {
        queryBuilder.where('role.isActive = :isActive', { isActive: true });
      }
 
      const roles = await queryBuilder
        .orderBy('role.isSystem', 'DESC')
        .addOrderBy('role.name', 'ASC')
        .getMany();
 
      res.json({ roles });
    } catch (error) {
      console.error('Error fetching roles:', error);
      res.status(500).json({ message: 'Failed to fetch roles' });
    }
  };
 
  getRoleById = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
 
      const role = await this.roleRepository.findOne({ where: { id } });
 
      if (!role) {
        return res.status(404).json({ message: 'Role not found' });
      }
 
      res.json({ role });
    } catch (error) {
      console.error('Error fetching role:', error);
      res.status(500).json({ message: 'Failed to fetch role' });
    }
  };
 
  createRole = async (req: AuthRequest, res: Response) => {
    try {
      const { name, displayName, description, isDefault, metadata } = req.body;
 
      if (!name || !displayName) {
        return res.status(400).json({ message: 'Name and display name are required' });
      }
 
      const existingRole = await this.roleRepository.findOne({ where: { name: name.toUpperCase() } });
      if (existingRole) {
        return res.status(409).json({ message: 'Role name already exists' });
      }
 
      if (isDefault) {
        await this.roleRepository.update({ isDefault: true }, { isDefault: false });
      }
 
      const role = this.roleRepository.create({
        name: name.toUpperCase(),
        displayName,
        description,
        isDefault: isDefault || false,
        isSystem: false,
        metadata: metadata || {}
      });
 
      await this.roleRepository.save(role);
      await this.createDefaultPermissionsForRole(role.name);
 
      res.status(201).json({ message: 'Role created successfully', role });
    } catch (error) {
      console.error('Error creating role:', error);
      res.status(500).json({ message: 'Failed to create role' });
    }
  };
 
  updateRole = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { displayName, description, isDefault, isActive, metadata } = req.body;
 
      const role = await this.roleRepository.findOne({ where: { id } });
 
      if (!role) {
        return res.status(404).json({ message: 'Role not found' });
      }
 
      if (role.name === 'ADMIN') {
        return res.status(400).json({
          message: 'ADMIN role cannot be modified',
          code: 'ADMIN_IMMUTABLE'
        });
      }
 
      if (role.isSystem) {
        if (displayName !== undefined) role.displayName = displayName;
        if (description !== undefined) role.description = description;
        if (metadata !== undefined) role.metadata = metadata;
 
        if (isDefault !== undefined) {
          if (isDefault && !role.isDefault) {
            await this.roleRepository.update({ isDefault: true }, { isDefault: false });
            role.isDefault = true;
          } else if (isDefault === false) {
            role.isDefault = false;
          }
        }
      } else {
        if (displayName !== undefined) role.displayName = displayName;
        if (description !== undefined) role.description = description;
        if (isActive !== undefined) role.isActive = isActive;
        if (metadata !== undefined) role.metadata = metadata;
 
        if (isDefault && !role.isDefault) {
          await this.roleRepository.update({ isDefault: true }, { isDefault: false });
          role.isDefault = true;
        } else if (isDefault === false) {
          role.isDefault = false;
        }
      }
 
      await this.roleRepository.save(role);
 
      res.json({ message: 'Role updated successfully', role });
    } catch (error) {
      console.error('Error updating role:', error);
      res.status(500).json({ message: 'Failed to update role' });
    }
  };
 
  deleteRole = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
 
      const role = await this.roleRepository.findOne({ where: { id } });
 
      if (!role) {
        return res.status(404).json({ message: 'Role not found' });
      }
 
      if (role.isSystem) {
        return res.status(400).json({
          message: 'System roles cannot be deleted',
          code: 'SYSTEM_ROLE_PROTECTED'
        });
      }
 
      const userCount = await this.userRepository.count({ where: { role: role.name } });
      if (userCount > 0) {
        return res.status(400).json({
          message: 'Cannot delete role with assigned users',
          userCount,
          code: 'ROLE_IN_USE'
        });
      }
 
      await this.permissionRepository.delete({ role: role.name });
      await this.roleRepository.remove(role);
 
      res.json({ message: 'Role deleted successfully' });
    } catch (error) {
      console.error('Error deleting role:', error);
      res.status(500).json({ message: 'Failed to delete role' });
    }
  };
 
  getRoleStats = async (req: AuthRequest, res: Response) => {
    try {
      const roles = await this.roleRepository.find();
      const stats = [];
 
      for (const role of roles) {
        const userCount = await this.userRepository.count({ where: { role: role.name } });
 
        stats.push({
          roleId: role.id,
          roleName: role.name,
          displayName: role.displayName,
          userCount,
          isSystem: role.isSystem,
          isDefault: role.isDefault,
          isActive: role.isActive,
          canModify: role.name !== 'ADMIN',
          canDelete: !role.isSystem
        });
      }
 
      res.json({ stats });
    } catch (error) {
      console.error('Error fetching role stats:', error);
      res.status(500).json({ message: 'Failed to fetch role statistics' });
    }
  };
 
  toggleRoleStatus = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
 
      const role = await this.roleRepository.findOne({ where: { id } });
 
      if (!role) {
        return res.status(404).json({ message: 'Role not found' });
      }
 
      if (role.isSystem) {
        return res.status(400).json({
          message: 'System roles cannot be deactivated',
          code: 'SYSTEM_ROLE_PROTECTED'
        });
      }
 
      role.isActive = !role.isActive;
      await this.roleRepository.save(role);
 
      res.json({ message: `Role ${role.isActive ? 'activated' : 'deactivated'} successfully`, role });
    } catch (error) {
      console.error('Error toggling role status:', error);
      res.status(500).json({ message: 'Failed to toggle role status' });
    }
  };
 
  private createDefaultPermissionsForRole = async (roleName: string) => {
    try {
      const defaultPermissions = [
        { role: roleName, resource: 'DASHBOARD', canInMenu: true, canView: true, canCreate: false, canEdit: false, canDelete: false, pluginId: null, isDynamic: false },
        { role: roleName, resource: 'PROFILE', canInMenu: true, canView: true, canCreate: false, canEdit: true, canDelete: false, pluginId: null, isDynamic: false },
        { role: roleName, resource: 'USERS', canInMenu: false, canView: false, canCreate: false, canEdit: false, canDelete: false, pluginId: null, isDynamic: false },
        { role: roleName, resource: 'ROLES', canInMenu: false, canView: false, canCreate: false, canEdit: false, canDelete: false, pluginId: null, isDynamic: false },
        { role: roleName, resource: 'SETTINGS', canInMenu: false, canView: false, canCreate: false, canEdit: false, canDelete: false, pluginId: null, isDynamic: false },
        { role: roleName, resource: 'RECIPE_BOOK', canInMenu: true, canView: true, canCreate: false, canEdit: false, canDelete: false, pluginId: null, isDynamic: false },
        { role: roleName, resource: 'SHOPPING_LISTS', canInMenu: true, canView: true, canCreate: true, canEdit: true, canDelete: true, pluginId: null, isDynamic: false },
      ];
 
      await this.permissionRepository.save(defaultPermissions);
    } catch (error) {
      console.error(`Error creating default permissions for role ${roleName}:`, error);
    }
  };
}