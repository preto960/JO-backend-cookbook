import dotenv from 'dotenv';
dotenv.config();

import { AppDataSource } from '../config/database';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { Setting, SettingCategory } from '../models/Setting';
import { Permission, ResourceType } from '../models/Permission';
import bcrypt from 'bcryptjs';

async function initBasicData() {
  try {
    console.log('🌱 Initializing basic data...');
    
    await AppDataSource.initialize();
    console.log('📊 Database connected');

    const userRepository = AppDataSource.getRepository(User);
    const roleRepository = AppDataSource.getRepository(Role);
    const settingRepository = AppDataSource.getRepository(Setting);
    const permissionRepository = AppDataSource.getRepository(Permission);

    // 1. Create basic roles
    console.log('\n📝 Creating basic roles...');
    const existingRoles = await roleRepository.count();
    if (existingRoles === 0) {
      const systemRoles = [
        {
          name: 'USER',
          displayName: 'User',
          description: 'Standard system user',
          isSystem: true,
          isDefault: true,
          isActive: true
        },
        {
          name: 'DEVELOPER',
          displayName: 'Developer',
          description: 'Developer with plugin access',
          isSystem: true,
          isDefault: false,
          isActive: true
        },
        {
          name: 'ADMIN',
          displayName: 'Administrator',
          description: 'Administrator with full system access',
          isSystem: true,
          isDefault: false,
          isActive: true
        }
      ];

      await roleRepository.save(systemRoles);
      console.log('✅ Created system roles');
    } else {
      console.log('✅ Roles already exist');
    }

    // 2. Create admin user
    console.log('\n👤 Creating admin user...');
    const existingUsers = await userRepository.count();
    if (existingUsers === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 12);
      const adminUser = userRepository.create({
        email: 'admin@example.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        isActive: true
      });

      await userRepository.save(adminUser);
      console.log('✅ Created admin user (admin@example.com / admin123)');
    } else {
      console.log('✅ Users already exist');
    }

    // 3. Create basic settings
    console.log('\n⚙️ Creating basic settings...');
    const existingSettings = await settingRepository.count();
    if (existingSettings === 0) {
      const basicSettings = [
        {
          key: 'multiTenancyEnabled',
          value: 'false',
          category: SettingCategory.ADVANCED,
          description: 'Enable multi-tenancy support',
          isPublic: true
        },
        {
          key: 'siteName',
          value: 'Admin Panel',
          category: SettingCategory.GENERAL,
          description: 'Site name',
          isPublic: true
        }
      ];

      await settingRepository.save(basicSettings);
      console.log('✅ Created basic settings');
    } else {
      console.log('✅ Settings already exist');
    }

    // 4. Create basic permissions
    console.log('\n🔐 Creating basic permissions...');
    const existingPermissions = await permissionRepository.count();
    if (existingPermissions === 0) {
      const basicPermissions = [
        // ADMIN permissions
        { role: 'ADMIN', resource: ResourceType.USERS, canView: true, canCreate: true, canEdit: true, canDelete: true, canInMenu: true },
        { role: 'ADMIN', resource: ResourceType.ROLES, canView: true, canCreate: true, canEdit: true, canDelete: true, canInMenu: true },
        { role: 'ADMIN', resource: ResourceType.SETTINGS, canView: true, canCreate: true, canEdit: true, canDelete: true, canInMenu: true },
        { role: 'ADMIN', resource: ResourceType.DASHBOARD, canView: true, canCreate: true, canEdit: true, canDelete: true, canInMenu: true },
        
        // USER permissions
        { role: 'USER', resource: ResourceType.DASHBOARD, canView: true, canCreate: false, canEdit: false, canDelete: false, canInMenu: true },
        { role: 'USER', resource: ResourceType.PROFILE, canView: true, canCreate: false, canEdit: true, canDelete: false, canInMenu: true },
        
        // DEVELOPER permissions
        { role: 'DEVELOPER', resource: ResourceType.DASHBOARD, canView: true, canCreate: false, canEdit: false, canDelete: false, canInMenu: true },
        { role: 'DEVELOPER', resource: ResourceType.PLUGINS, canView: true, canCreate: true, canEdit: true, canDelete: true, canInMenu: true },
      ];

      await permissionRepository.save(basicPermissions);
      console.log('✅ Created basic permissions');
    } else {
      console.log('✅ Permissions already exist');
    }

    console.log('\n🎉 Basic data initialization completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error during basic data initialization:', error);
    process.exit(1);
  }
}

initBasicData();