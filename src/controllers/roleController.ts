import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Role } from '../models/Role';
import { User, UserRole } from '../models/User';
import { Permission, ResourceType } from '../models/Permission';
import { AuthRequest } from '../middleware/auth';

export class RoleController {
  private roleRepository = AppDataSource.getRepository(Role);
  private userRepository = AppDataSource.getRepository(User);
  private permissionRepository = AppDataSource.getRepository(Permission);

  // Obtener todos los roles
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

  // Obtener rol por ID
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

  // Crear nuevo rol
  createRole = async (req: AuthRequest, res: Response) => {
    try {
      const { name, displayName, description, isDefault, metadata } = req.body;

      // Validar campos requeridos
      if (!name || !displayName) {
        return res.status(400).json({ message: 'Name and display name are required' });
      }

      // Verificar que el nombre no exista
      const existingRole = await this.roleRepository.findOne({ where: { name: name.toUpperCase() } });
      if (existingRole) {
        return res.status(409).json({ message: 'Role name already exists' });
      }

      // Si es rol por defecto, quitar el flag de otros roles
      if (isDefault) {
        await this.roleRepository.update({ isDefault: true }, { isDefault: false });
      }

      // Crear el rol
      const role = this.roleRepository.create({
        name: name.toUpperCase(),
        displayName,
        description,
        isDefault: isDefault || false,
        isSystem: false, // Los roles creados por usuario nunca son del sistema
        metadata: metadata || {}
      });

      await this.roleRepository.save(role);

      // Create default permissions for the new role
      await this.createDefaultPermissionsForRole(role.name);

      res.status(201).json({
        message: 'Role created successfully',
        role
      });
    } catch (error) {
      console.error('Error creating role:', error);
      res.status(500).json({ message: 'Failed to create role' });
    }
  };

  // Actualizar rol
  updateRole = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { displayName, description, isDefault, isActive, metadata } = req.body;

      const role = await this.roleRepository.findOne({ where: { id } });

      if (!role) {
        return res.status(404).json({ message: 'Role not found' });
      }

      // ADMIN es completamente inmutable
      if (role.name === 'ADMIN') {
        return res.status(400).json({ 
          message: 'ADMIN role cannot be modified',
          code: 'ADMIN_IMMUTABLE'
        });
      }

      // Roles del sistema (USER, DEVELOPER) pueden modificar algunos campos
      if (role.isSystem) {
        // Solo permitir cambiar displayName, description y metadata
        if (displayName !== undefined) role.displayName = displayName;
        if (description !== undefined) role.description = description;
        if (metadata !== undefined) role.metadata = metadata;
        
        // USER y DEVELOPER pueden cambiar si son default, pero no pueden desactivarse
        if (isDefault !== undefined) {
          if (isDefault && !role.isDefault) {
            await this.roleRepository.update({ isDefault: true }, { isDefault: false });
            role.isDefault = true;
          } else if (isDefault === false) {
            role.isDefault = false;
          }
        }
      } else {
        // Roles personalizados pueden cambiar todo excepto el name
        if (displayName !== undefined) role.displayName = displayName;
        if (description !== undefined) role.description = description;
        if (isActive !== undefined) role.isActive = isActive;
        if (metadata !== undefined) role.metadata = metadata;

        // Si se marca como default, quitar el flag de otros roles
        if (isDefault && !role.isDefault) {
          await this.roleRepository.update({ isDefault: true }, { isDefault: false });
          role.isDefault = true;
        } else if (isDefault === false) {
          role.isDefault = false;
        }
      }

      await this.roleRepository.save(role);

      res.json({
        message: 'Role updated successfully',
        role
      });
    } catch (error) {
      console.error('Error updating role:', error);
      res.status(500).json({ message: 'Failed to update role' });
    }
  };

  // Eliminar rol
  deleteRole = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const role = await this.roleRepository.findOne({ where: { id } });

      if (!role) {
        return res.status(404).json({ message: 'Role not found' });
      }

      // No permitir eliminar roles del sistema (ADMIN, USER, DEVELOPER)
      if (role.isSystem) {
        return res.status(400).json({ 
          message: 'System roles cannot be deleted',
          code: 'SYSTEM_ROLE_PROTECTED'
        });
      }

        // Verificar que no haya usuarios con este rol
        let userCount = 0;
        
        // Solo verificar usuarios para roles que existen en el enum UserRole
        if (Object.values(UserRole).includes(role.name as UserRole)) {
          userCount = await this.userRepository.count({ where: { role: role.name as UserRole } });
        }
        // Para roles personalizados, userCount será 0 (correcto, ya que los usuarios
        // solo pueden tener roles del enum UserRole)
        
        if (userCount > 0) {
          return res.status(400).json({ 
            message: 'Cannot delete role with assigned users',
            userCount,
            code: 'ROLE_IN_USE'
          });
        }

      // Delete all permissions for this role
      await this.permissionRepository.delete({ role: role.name });

      await this.roleRepository.remove(role);

      res.json({ message: 'Role deleted successfully' });
    } catch (error) {
      console.error('Error deleting role:', error);
      res.status(500).json({ message: 'Failed to delete role' });
    }
  };

  // Obtener estadísticas de uso de roles
  getRoleStats = async (req: AuthRequest, res: Response) => {
    try {
      const roles = await this.roleRepository.find();
      const stats = [];

      for (const role of roles) {
        let userCount = 0;
        
        // Solo contar usuarios para roles que existen en el enum UserRole
        if (Object.values(UserRole).includes(role.name as UserRole)) {
          userCount = await this.userRepository.count({ 
            where: { role: role.name as UserRole } 
          });
        }
        // Para roles personalizados, el conteo será 0 ya que los usuarios
        // solo pueden tener roles del enum UserRole (USER, DEVELOPER, ADMIN)
        
        stats.push({
          roleId: role.id,
          roleName: role.name,
          displayName: role.displayName,
          userCount,
          isSystem: role.isSystem,
          isDefault: role.isDefault,
          isActive: role.isActive,
          canModify: role.name !== 'ADMIN', // Solo ADMIN no se puede modificar
          canDelete: !role.isSystem // Ningún rol del sistema se puede eliminar
        });
      }

      res.json({ stats });
    } catch (error) {
      console.error('Error fetching role stats:', error);
      res.status(500).json({ message: 'Failed to fetch role statistics' });
    }
  };

  // Activar/Desactivar rol
  toggleRoleStatus = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const role = await this.roleRepository.findOne({ where: { id } });

      if (!role) {
        return res.status(404).json({ message: 'Role not found' });
      }

      // No permitir desactivar roles del sistema
      if (role.isSystem) {
        return res.status(400).json({ 
          message: 'System roles cannot be deactivated',
          code: 'SYSTEM_ROLE_PROTECTED'
        });
      }

      role.isActive = !role.isActive;
      await this.roleRepository.save(role);

      res.json({
        message: `Role ${role.isActive ? 'activated' : 'deactivated'} successfully`,
        role
      });
    } catch (error) {
      console.error('Error toggling role status:', error);
      res.status(500).json({ message: 'Failed to toggle role status' });
    }
  };

  // Helper method to create default permissions for a new role
  private createDefaultPermissionsForRole = async (roleName: string) => {
    try {
      console.log(`🔧 Creating default permissions for role: ${roleName}`);
      
      // Default permissions for new custom roles (similar to USER role but more restrictive)
      const defaultPermissions = [
        {
          role: roleName,
          resource: 'DASHBOARD', // Explicit uppercase string
          canInMenu: true,
          canView: true,
          canCreate: false,
          canEdit: false,
          canDelete: false,
          pluginId: null,
          isDynamic: false
        },
        {
          role: roleName,
          resource: 'PROFILE', // Explicit uppercase string
          canInMenu: true,
          canView: true,
          canCreate: false,
          canEdit: true,
          canDelete: false,
          pluginId: null,
          isDynamic: false
        },
        // Other resources are disabled by default for new roles
        {
          role: roleName,
          resource: 'MARKET', // Explicit uppercase string
          canInMenu: false,
          canView: false,
          canCreate: false,
          canEdit: false,
          canDelete: false,
          pluginId: null,
          isDynamic: false
        },
        {
          role: roleName,
          resource: 'PLUGINS', // Explicit uppercase string
          canInMenu: false,
          canView: false,
          canCreate: false,
          canEdit: false,
          canDelete: false,
          pluginId: null,
          isDynamic: false
        },
        {
          role: roleName,
          resource: 'USERS', // Explicit uppercase string
          canInMenu: false,
          canView: false,
          canCreate: false,
          canEdit: false,
          canDelete: false,
          pluginId: null,
          isDynamic: false
        },
        {
          role: roleName,
          resource: 'ROLES', // Explicit uppercase string
          canInMenu: false,
          canView: false,
          canCreate: false,
          canEdit: false,
          canDelete: false,
          pluginId: null,
          isDynamic: false
        },
        {
          role: roleName,
          resource: 'SETTINGS', // Explicit uppercase string
          canInMenu: false,
          canView: false,
          canCreate: false,
          canEdit: false,
          canDelete: false,
          pluginId: null,
          isDynamic: false
        }
      ];

      // Save all permissions
      await this.permissionRepository.save(defaultPermissions);

      console.log(`✅ Created default permissions for role: ${roleName}`);
    } catch (error) {
      console.error(`Error creating default permissions for role ${roleName}:`, error);
      // Don't throw error to avoid breaking role creation
    }
  };
}
