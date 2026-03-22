import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1000000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Creating initial schema...');

    // 1. ROLES TABLE
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        name varchar(100) UNIQUE NOT NULL,
        "displayName" varchar(255) NOT NULL,
        description text,
        "isSystem" boolean DEFAULT false,
        "isDefault" boolean DEFAULT false,
        "isActive" boolean DEFAULT true,
        metadata json,
        "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. USERS TABLE
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        email varchar(255) UNIQUE NOT NULL,
        password varchar(255) NOT NULL,
        "firstName" varchar(100) NOT NULL,
        "lastName" varchar(100) NOT NULL,
        avatar varchar(500),
        bio text,
        website varchar(255),
        github varchar(100),
        twitter varchar(100),
        role varchar(50) DEFAULT 'USER' NOT NULL,
        "isActive" boolean DEFAULT true,
        "lastLoginAt" timestamp,
        "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. PERMISSIONS TABLE
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        role varchar(50) NOT NULL,
        resource varchar(255) NOT NULL,
        "pluginId" varchar(255),
        "isDynamic" boolean DEFAULT false,
        "resourceLabel" varchar(255),
        "resourceDescription" text,
        "displayOrder" integer DEFAULT 0,
        "canInMenu" boolean DEFAULT false,
        "canView" boolean DEFAULT false,
        "canCreate" boolean DEFAULT false,
        "canEdit" boolean DEFAULT false,
        "canDelete" boolean DEFAULT false,
        "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. SETTINGS TABLE
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        key varchar(100) UNIQUE NOT NULL,
        value text NOT NULL,
        category varchar(20) CHECK (category IN ('general', 'security', 'notifications', 'advanced')) NOT NULL,
        description text,
        "isPublic" boolean DEFAULT false,
        "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. TRANSLATIONS TABLE
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS translations (
        id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        key varchar(255) NOT NULL,
        language varchar(10) CHECK (language IN ('en', 'es')) NOT NULL,
        value text NOT NULL,
        category varchar(100),
        description text,
        "isSystem" boolean DEFAULT false,
        "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // INDEXES
    console.log('📋 Creating indexes...');

    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_users_email" ON "users" ("email")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_users_role" ON "users" ("role")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_users_active" ON "users" ("isActive")');

    await queryRunner.query('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_permissions_role_resource_plugin" ON "permissions" ("role", "resource", "pluginId")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_permissions_role" ON "permissions" ("role")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_permissions_resource" ON "permissions" ("resource")');

    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_settings_key" ON "settings" ("key")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_settings_category" ON "settings" ("category")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_settings_public" ON "settings" ("isPublic")');

    await queryRunner.query('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_translations_key_language" ON "translations" ("key", "language")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_translations_category" ON "translations" ("category")');

    // DEFAULT DATA
    console.log('📊 Inserting default data...');

    // System roles
    await queryRunner.query(`
      INSERT INTO roles (name, "displayName", description, "isSystem", "isDefault", "isActive") VALUES
      ('USER', 'User', 'Standard system user', true, true, true),
      ('ADMIN', 'Administrator', 'Administrator with full access', true, false, true)
      ON CONFLICT (name) DO NOTHING
    `);

    // Default settings
    await queryRunner.query(`
      INSERT INTO settings (key, value, category, description, "isPublic") VALUES
      ('siteName', 'App Backend', 'general', 'Application name', true),
      ('language', 'en', 'general', 'Default system language', true),
      ('sessionTimeout', '30', 'security', 'Session timeout in minutes', false),
      ('emailNotifications', 'true', 'notifications', 'Enable email notifications', false),
      ('debugMode', 'false', 'advanced', 'Enable debug mode', false)
      ON CONFLICT (key) DO NOTHING
    `);

    // Default permissions
    await queryRunner.query(`
      INSERT INTO permissions (role, resource, "canInMenu", "canView", "canCreate", "canEdit", "canDelete", "pluginId", "isDynamic") VALUES
      -- ADMIN full access
      ('ADMIN', 'DASHBOARD', true, true, true, true, true, null, false),
      ('ADMIN', 'USERS', true, true, true, true, true, null, false),
      ('ADMIN', 'ROLES', true, true, true, true, true, null, false),
      ('ADMIN', 'PERMISSIONS', true, true, true, true, true, null, false),
      ('ADMIN', 'SETTINGS', true, true, true, true, true, null, false),
      ('ADMIN', 'PROFILE', true, true, false, true, false, null, false),
      ('ADMIN', 'TRANSLATIONS', true, true, true, true, true, null, false),
      -- USER basic access
      ('USER', 'DASHBOARD', true, true, false, false, false, null, false),
      ('USER', 'PROFILE', true, true, false, true, false, null, false),
      ('USER', 'USERS', false, false, false, false, false, null, false),
      ('USER', 'ROLES', false, false, false, false, false, null, false),
      ('USER', 'SETTINGS', false, false, false, false, false, null, false)
      ON CONFLICT (role, resource, "pluginId") DO NOTHING
    `);

    console.log('✅ Initial schema created successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS translations');
    await queryRunner.query('DROP TABLE IF EXISTS settings');
    await queryRunner.query('DROP TABLE IF EXISTS permissions');
    await queryRunner.query('DROP TABLE IF EXISTS users');
    await queryRunner.query('DROP TABLE IF EXISTS roles');

    console.log('✅ Schema dropped');
  }
}
