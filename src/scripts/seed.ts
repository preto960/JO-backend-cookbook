import dotenv from 'dotenv';
dotenv.config();

import { Client } from 'pg';
import bcrypt from 'bcryptjs';

async function seedDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('🌱 Starting database seeding...');
    
    await client.connect();
    console.log('📊 Database connected');

    // 1. SEED DEFAULT TENANT
    console.log('\n🏢 Seeding default tenant...');
    const existingTenants = await client.query('SELECT COUNT(*) as count FROM tenants');
    if (parseInt(existingTenants.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO tenants (slug, name, description, "isActive") 
        VALUES ('default', 'Default Organization', 'Default tenant for single-tenant mode', true)
        ON CONFLICT (slug) DO NOTHING
      `);
      console.log('✅ Created default tenant');
    } else {
      console.log('ℹ️ Tenants already exist, skipping...');
    }

    // 2. SEED ROLES
    console.log('\n📝 Seeding roles...');
    const existingRoles = await client.query('SELECT COUNT(*) as count FROM roles');
    if (parseInt(existingRoles.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO roles (name, "displayName", description, "isSystem", "isDefault", "isActive") VALUES
        ('USER', 'Usuario', 'Usuario estándar del sistema', true, true, true),
        ('DEVELOPER', 'Desarrollador', 'Desarrollador con acceso a plugins', true, false, true),
        ('ADMIN', 'Administrador', 'Administrador con acceso completo - NO MODIFICABLE', true, false, true)
        ON CONFLICT (name) DO NOTHING
      `);
      console.log('✅ Created system roles');
    } else {
      console.log('ℹ️ Roles already exist, skipping...');
    }

    // 3. SEED ADMIN USER
    console.log('\n👤 Seeding admin user...');
    const existingAdmin = await client.query(`SELECT COUNT(*) as count FROM users WHERE email = 'admin@admin.com'`);
    if (parseInt(existingAdmin.rows[0].count) === 0) {
      const hashedPassword = await bcrypt.hash('password123', 12);
      
      await client.query(`
        INSERT INTO users (email, password, "firstName", "lastName", role, "isActive") 
        VALUES ($1, $2, 'System', 'Administrator', 'ADMIN', true)
      `, ['admin@njo.com', hashedPassword]);
      console.log('✅ Created admin user (admin@njo.com / password123)');
    } else {
      console.log('ℹ️ Admin user already exists, skipping...');
    }

    // 4. SEED SETTINGS
    console.log('\n⚙️ Seeding settings...');
    const existingSettings = await client.query('SELECT COUNT(*) as count FROM settings');
    if (parseInt(existingSettings.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO settings (key, value, category, description, "isPublic") VALUES
        ('siteName', 'Admin Panel', 'GENERAL', 'Site name displayed in the application', true),
        ('siteLogo', '', 'GENERAL', 'Site logo URL', true),
        ('useLogoOnly', 'false', 'GENERAL', 'Show only logo without name', true),
        ('language', 'en', 'GENERAL', 'Default system language', true),
        ('timezone', 'UTC', 'GENERAL', 'System timezone', false),
        ('autoUpdate', 'true', 'PLUGINS', 'Automatically update plugins', false),
        ('hotReload', 'true', 'PLUGINS', 'Enable hot reload for plugins', false),
        ('allowExternal', 'false', 'PLUGINS', 'Allow external plugin sources', false),
        ('twoFactorAuth', 'false', 'SECURITY', 'Enable two-factor authentication', false),
        ('sessionTimeout', '30', 'SECURITY', 'Session timeout in minutes', false),
        ('passwordExpiration', '90', 'SECURITY', 'Password expiration in days', false),
        ('emailNotifications', 'true', 'NOTIFICATIONS', 'Enable email notifications', false),
        ('browserNotifications', 'true', 'NOTIFICATIONS', 'Enable browser notifications', false),
        ('pluginUpdates', 'true', 'NOTIFICATIONS', 'Notify about plugin updates', false),
        ('multiTenancyEnabled', 'false', 'ADVANCED', 'Enable multi-tenancy support', true),
        ('debugMode', 'false', 'ADVANCED', 'Enable debug mode', false),
        ('cacheDuration', '3600', 'ADVANCED', 'Cache duration in seconds', false)
        ON CONFLICT (key) DO NOTHING
      `);
      console.log('✅ Created system settings');
    } else {
      console.log('ℹ️ Settings already exist, skipping...');
    }

    // 5. SEED PERMISSIONS
    console.log('\n🔐 Seeding permissions...');
    const existingPermissions = await client.query('SELECT COUNT(*) as count FROM permissions');
    if (parseInt(existingPermissions.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO permissions (role, resource, "canInMenu", "canView", "canCreate", "canEdit", "canDelete", "pluginId", "isDynamic") VALUES
        -- ADMIN permissions (full access)
        ('ADMIN', 'DASHBOARD', true, true, true, true, true, null, false),
        ('ADMIN', 'USERS', true, true, true, true, true, null, false),
        ('ADMIN', 'ROLES', true, true, true, true, true, null, false),
        ('ADMIN', 'PERMISSIONS', true, true, true, true, true, null, false),
        ('ADMIN', 'SETTINGS', true, true, true, true, true, null, false),
        ('ADMIN', 'PLUGINS', true, true, true, true, true, null, false),
        ('ADMIN', 'MARKET', true, true, true, true, true, null, false),
        ('ADMIN', 'PROFILE', true, true, false, true, false, null, false),
        ('ADMIN', 'TRANSLATIONS', true, true, true, true, true, null, false),
        ('ADMIN', 'TENANTS', true, true, true, true, true, null, false),
        
        -- DEVELOPER permissions (plugin access)
        ('DEVELOPER', 'DASHBOARD', true, true, false, false, false, null, false),
        ('DEVELOPER', 'PLUGINS', true, true, true, true, true, null, false),
        ('DEVELOPER', 'MARKET', true, true, true, true, false, null, false),
        ('DEVELOPER', 'PROFILE', true, true, false, true, false, null, false),
        
        -- USER permissions (basic access)
        ('USER', 'DASHBOARD', true, true, false, false, false, null, false),
        ('USER', 'PROFILE', true, true, false, true, false, null, false)
        
        ON CONFLICT (role, resource) DO NOTHING
      `);
      console.log('✅ Created system permissions');
    } else {
      console.log('ℹ️ Permissions already exist, skipping...');
    }

    // 6. SEED TRANSLATIONS
    console.log('\n🌐 Seeding translations...');
    const existingTranslations = await client.query('SELECT COUNT(*) as count FROM translations');
    if (parseInt(existingTranslations.rows[0].count) === 0) {
      const baseTranslations = [
        // Auth Messages
        { key: 'backend.user_already_exists', category: 'backend', en: 'User already exists', es: 'El usuario ya existe' },
        { key: 'backend.user_created_successfully', category: 'backend', en: 'User created successfully', es: 'Usuario creado exitosamente' },
        { key: 'backend.invalid_credentials', category: 'backend', en: 'Invalid credentials', es: 'Credenciales inválidas' },
        { key: 'backend.login_successful', category: 'backend', en: 'Login successful', es: 'Inicio de sesión exitoso' },
        { key: 'backend.profile_updated_successfully', category: 'backend', en: 'Profile updated successfully', es: 'Perfil actualizado exitosamente' },
        { key: 'backend.internal_server_error', category: 'backend', en: 'Internal server error', es: 'Error interno del servidor' },

        // User Messages
        { key: 'backend.user_not_found', category: 'backend', en: 'User not found', es: 'Usuario no encontrado' },
        { key: 'backend.email_already_exists', category: 'backend', en: 'Email already exists', es: 'El correo electrónico ya existe' },
        { key: 'backend.user_updated_successfully', category: 'backend', en: 'User updated successfully', es: 'Usuario actualizado exitosamente' },
        { key: 'backend.user_deleted_successfully', category: 'backend', en: 'User deleted successfully', es: 'Usuario eliminado exitosamente' },
        { key: 'backend.cannot_delete_last_admin', category: 'backend', en: 'Cannot delete the last admin user', es: 'No se puede eliminar el último usuario administrador' },

        // Role Messages
        { key: 'backend.role_not_found', category: 'backend', en: 'Role not found', es: 'Rol no encontrado' },
        { key: 'backend.role_created_successfully', category: 'backend', en: 'Role created successfully', es: 'Rol creado exitosamente' },
        { key: 'backend.role_updated_successfully', category: 'backend', en: 'Role updated successfully', es: 'Rol actualizado exitosamente' },
        { key: 'backend.role_deleted_successfully', category: 'backend', en: 'Role deleted successfully', es: 'Rol eliminado exitosamente' },
        { key: 'backend.admin_role_immutable', category: 'backend', en: 'ADMIN role cannot be modified', es: 'El rol ADMIN no puede ser modificado' },

        // Settings Messages
        { key: 'backend.setting_not_found', category: 'backend', en: 'Setting not found', es: 'Configuración no encontrada' },
        { key: 'backend.setting_updated_successfully', category: 'backend', en: 'Setting updated successfully', es: 'Configuración actualizada exitosamente' },
        { key: 'backend.settings_updated_successfully', category: 'backend', en: 'Settings updated successfully', es: 'Configuración actualizada exitosamente' },

        // Permission Messages
        { key: 'backend.permission_updated_successfully', category: 'backend', en: 'Permission updated successfully', es: 'Permiso actualizado exitosamente' },
        { key: 'backend.permissions_updated_successfully', category: 'backend', en: 'Permissions updated successfully', es: 'Permisos actualizados exitosamente' },

        // Dashboard Messages
        { key: 'backend.card_created_successfully', category: 'backend', en: 'Dashboard card created successfully', es: 'Tarjeta del panel creada exitosamente' },
        { key: 'backend.card_updated_successfully', category: 'backend', en: 'Dashboard card updated successfully', es: 'Tarjeta del panel actualizada exitosamente' },
        { key: 'backend.card_deleted_successfully', category: 'backend', en: 'Dashboard card deleted successfully', es: 'Tarjeta del panel eliminada exitosamente' },

        // Translation Messages
        { key: 'backend.translation_updated_successfully', category: 'backend', en: 'Translation updated successfully', es: 'Traducción actualizada exitosamente' },
        { key: 'backend.translation_added_successfully', category: 'backend', en: 'Translation added successfully', es: 'Traducción agregada exitosamente' },
        { key: 'backend.translation_deleted_successfully', category: 'backend', en: 'Translation deleted successfully', es: 'Traducción eliminada exitosamente' },

        // Upload Messages
        { key: 'backend.logo_uploaded_successfully', category: 'backend', en: 'Logo uploaded successfully', es: 'Logo subido exitosamente' },
        { key: 'backend.file_upload_failed', category: 'backend', en: 'File upload failed', es: 'Error al subir el archivo' },

        // Tenant Messages
        { key: 'backend.tenant_created_successfully', category: 'backend', en: 'Tenant created successfully', es: 'Inquilino creado exitosamente' },
        { key: 'backend.tenant_updated_successfully', category: 'backend', en: 'Tenant updated successfully', es: 'Inquilino actualizado exitosamente' },
        { key: 'backend.tenant_deleted_successfully', category: 'backend', en: 'Tenant deleted successfully', es: 'Inquilino eliminado exitosamente' },
        { key: 'backend.tenant_not_found', category: 'backend', en: 'Tenant not found', es: 'Inquilino no encontrado' },

        // External API Messages
        { key: 'backend.connection_created_successfully', category: 'backend', en: 'API connection created successfully', es: 'Conexión API creada exitosamente' },
        { key: 'backend.connection_updated_successfully', category: 'backend', en: 'API connection updated successfully', es: 'Conexión API actualizada exitosamente' },
        { key: 'backend.connection_deleted_successfully', category: 'backend', en: 'API connection deleted successfully', es: 'Conexión API eliminada exitosamente' },
        { key: 'backend.connection_test_successful', category: 'backend', en: 'Connection test successful', es: 'Prueba de conexión exitosa' },
        { key: 'backend.connection_test_failed', category: 'backend', en: 'Connection test failed', es: 'Prueba de conexión falló' }
      ];

      // Insert translations in batches
      for (const translation of baseTranslations) {
        // English translation
        await client.query(`
          INSERT INTO translations (key, language, value, category, "isSystem") 
          VALUES ($1, 'en', $2, $3, true)
          ON CONFLICT (key, language) DO NOTHING
        `, [translation.key, translation.en, translation.category]);

        // Spanish translation
        await client.query(`
          INSERT INTO translations (key, language, value, category, "isSystem") 
          VALUES ($1, 'es', $2, $3, true)
          ON CONFLICT (key, language) DO NOTHING
        `, [translation.key, translation.es, translation.category]);
      }

      console.log(`✅ Created ${baseTranslations.length * 2} system translations`);
    } else {
      console.log('ℹ️ Translations already exist, skipping...');
    }

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - Default tenant created');
    console.log('   - System roles created (USER, DEVELOPER, ADMIN)');
    console.log('   - Admin user created (admin@admin.com / admin123)');
    console.log('   - System settings configured');
    console.log('   - Base permissions set up');
    console.log('   - Essential translations loaded (EN/ES)');
    console.log('\n🚀 System is ready to use!');

  } catch (error) {
    console.error('❌ Error during database seeding:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Execute if called directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('✅ Database seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Database seeding failed:', error);
      process.exit(1);
    });
}

export default seedDatabase;