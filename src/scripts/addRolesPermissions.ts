import { AppDataSource } from '../config/database';
import { Permission, ResourceType } from '../models/Permission';
import { UserRole } from '../models/User';

async function addRolesPermissions() {
  try {
    await AppDataSource.initialize();
    console.log('📊 Database connected for adding roles permissions');

    const permissionRepository = AppDataSource.getRepository(Permission);

    // Verificar si ya existen permisos para ROLES
    const existingRolesPermissions = await permissionRepository.count({
      where: { resource: ResourceType.ROLES as string }
    });

    if (existingRolesPermissions > 0) {
      console.log('✅ Roles permissions already exist, skipping');
      return;
    }

    // Crear permisos para el recurso ROLES
    const rolesPermissions = [
      // USER role - Sin acceso a roles
      {
        role: 'USER',
        resource: ResourceType.ROLES as string,
        canInMenu: false,
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        pluginId: null,
        isDynamic: false
      },
      // DEVELOPER role - Sin acceso a roles
      {
        role: 'DEVELOPER',
        resource: ResourceType.ROLES as string,
        canInMenu: false,
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        pluginId: null,
        isDynamic: false
      },
      // ADMIN role - Acceso completo a roles
      {
        role: 'ADMIN',
        resource: ResourceType.ROLES as string,
        canInMenu: true,
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
        pluginId: null,
        isDynamic: false
      }
    ];

    for (const permissionData of rolesPermissions) {
      const permission = permissionRepository.create(permissionData);
      await permissionRepository.save(permission);
      console.log(`✅ Created roles permission for: ${permissionData.role}`);
    }

    console.log('🎉 Roles permissions added successfully');
  } catch (error) {
    console.error('❌ Error adding roles permissions:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

addRolesPermissions();

