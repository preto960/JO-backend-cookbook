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
 
    // 1. SEED ROLES
    console.log('\n📝 Seeding roles...');
    const existingRoles = await client.query('SELECT COUNT(*) as count FROM roles');
    if (parseInt(existingRoles.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO roles (name, "displayName", description, "isSystem", "isDefault", "isActive") VALUES
        ('USER', 'User', 'Standard system user', true, true, true),
        ('ADMIN', 'Administrator', 'Administrator with full access', true, false, true)
        ON CONFLICT (name) DO NOTHING
      `);
      console.log('✅ Created system roles');
    } else {
      console.log('ℹ️  Roles already exist, skipping...');
    }
 
    // 2. SEED ADMIN USER
    console.log('\n👤 Seeding admin user...');
    const existingAdmin = await client.query(`SELECT COUNT(*) as count FROM users WHERE email = 'admin@njo.com'`);
    if (parseInt(existingAdmin.rows[0].count) === 0) {
      const hashedPassword = await bcrypt.hash('password123', 12);
      await client.query(`
        INSERT INTO users (email, password, "firstName", "lastName", role, "isActive")
        VALUES ($1, $2, 'System', 'Administrator', 'ADMIN', true)
      `, ['admin@njo.com', hashedPassword]);
      console.log('✅ Created admin user (admin@njo.com / password123)');
    } else {
      console.log('ℹ️  Admin user already exists, skipping...');
    }
 
    // 3. SEED SETTINGS
    console.log('\n⚙️  Seeding settings...');
    const existingSettings = await client.query('SELECT COUNT(*) as count FROM settings');
    if (parseInt(existingSettings.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO settings (key, value, category, description, "isPublic") VALUES
        ('siteName', 'App Backend', 'general', 'Application name', true),
        ('language', 'en', 'general', 'Default system language', true),
        ('sessionTimeout', '30', 'security', 'Session timeout in minutes', false),
        ('emailNotifications', 'true', 'notifications', 'Enable email notifications', false),
        ('debugMode', 'false', 'advanced', 'Enable debug mode', false)
        ON CONFLICT (key) DO NOTHING
      `);
      console.log('✅ Created default settings');
    } else {
      console.log('ℹ️  Settings already exist, skipping...');
    }
 
    // 4. SEED PERMISSIONS
    console.log('\n🔐 Seeding permissions...');
    const existingPermissions = await client.query('SELECT COUNT(*) as count FROM permissions');
    if (parseInt(existingPermissions.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO permissions (role, resource, "canInMenu", "canView", "canCreate", "canEdit", "canDelete", "pluginId", "isDynamic") VALUES
        ('ADMIN', 'DASHBOARD', true, true, true, true, true, null, false),
        ('ADMIN', 'USERS', true, true, true, true, true, null, false),
        ('ADMIN', 'ROLES', true, true, true, true, true, null, false),
        ('ADMIN', 'PERMISSIONS', true, true, true, true, true, null, false),
        ('ADMIN', 'SETTINGS', true, true, true, true, true, null, false),
        ('ADMIN', 'PROFILE', true, true, false, true, false, null, false),
        ('ADMIN', 'TRANSLATIONS', true, true, true, true, true, null, false),
        ('ADMIN', 'SHOPPING_LISTS', true, true, true, true, true, null, false),
        ('USER', 'DASHBOARD', true, true, false, false, false, null, false),
        ('USER', 'PROFILE', true, true, false, true, false, null, false),
        ('USER', 'SHOPPING_LISTS', true, true, true, true, true, null, false),
        ('USER', 'USERS', false, false, false, false, false, null, false),
        ('USER', 'ROLES', false, false, false, false, false, null, false),
        ('USER', 'SETTINGS', false, false, false, false, false, null, false)
        ON CONFLICT (role, resource, "pluginId") DO NOTHING
      `);
      console.log('✅ Created system permissions');
    } else {
      console.log('ℹ️  Permissions already exist, skipping...');
    }
 
    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - System roles created (USER, ADMIN)');
    console.log('   - Admin user: admin@njo.com / password123');
    console.log('   - Default settings configured');
    console.log('   - Base permissions set up');
    console.log('\n🚀 System is ready!');
 
  } catch (error) {
    console.error('❌ Error during database seeding:', error);
    throw error;
  } finally {
    await client.end();
  }
}
 
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('✅ Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}
 
export default seedDatabase;