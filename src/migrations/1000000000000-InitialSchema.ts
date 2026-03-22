import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1000000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Creating initial schema...');

    // 1. CREATE TENANTS TABLE
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        slug varchar(100) UNIQUE NOT NULL,
        name varchar(255) NOT NULL,
        domain varchar(255) UNIQUE,
        description text,
        "isActive" boolean DEFAULT true,
        settings jsonb,
        features jsonb,
        "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. CREATE ROLES TABLE
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

    // 3. CREATE USERS TABLE
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        email varchar(255) UNIQUE NOT NULL,
        password varchar(255) NOT NULL,
        "firstName" varchar(100) NOT NULL,
        "lastName" varchar(100) NOT NULL,
        "tenantId" uuid,
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

    // 4. CREATE PERMISSIONS TABLE
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        role varchar(50) NOT NULL,
        resource varchar(100) NOT NULL,
        "canInMenu" boolean DEFAULT false,
        "canView" boolean DEFAULT false,
        "canCreate" boolean DEFAULT false,
        "canEdit" boolean DEFAULT false,
        "canDelete" boolean DEFAULT false,
        "pluginId" varchar(255),
        "isDynamic" boolean DEFAULT false,
        "resourceLabel" varchar(255),
        "resourceDescription" varchar(500),
        "displayOrder" integer DEFAULT 0,
        "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. CREATE SETTINGS TABLE
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        key varchar(100) UNIQUE NOT NULL,
        value text NOT NULL,
        category varchar(20) CHECK (category IN ('GENERAL', 'PLUGINS', 'SECURITY', 'NOTIFICATIONS', 'ADVANCED')) NOT NULL,
        description text,
        "isPublic" boolean DEFAULT false,
        "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 6. CREATE TRANSLATIONS TABLE
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS translations (
        id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        key varchar(255) NOT NULL,
        language varchar(10) CHECK (language IN ('en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko')) NOT NULL,
        value text NOT NULL,
        category varchar(100),
        description text,
        "isSystem" boolean DEFAULT false,
        "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 7. CREATE INSTALLED_PLUGINS TABLE
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS installed_plugins (
        id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        "publisherPluginId" varchar(255) NOT NULL,
        name varchar(255) NOT NULL,
        slug varchar(255) UNIQUE NOT NULL,
        version varchar(50) NOT NULL,
        description text,
        "packageUrl" varchar(500),
        manifest jsonb NOT NULL,
        config jsonb,
        status varchar(20) CHECK (status IN ('INSTALLING', 'INSTALLED', 'FAILED', 'UPDATING')) NOT NULL,
        "isActive" boolean DEFAULT false,
        "autoUpdate" boolean DEFAULT false,
        "installedBy" varchar(255) NOT NULL,
        "lastActivatedAt" timestamp,
        "errorMessage" varchar(500),
        "installedAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "installerId" uuid
      )
    `);

    // 8. CREATE DASHBOARD_BLOCKS TABLE
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS dashboard_blocks (
        id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        title varchar(255) NOT NULL,
        type varchar(20) CHECK (type IN ('table', 'chart', 'list', 'metric')) NOT NULL,
        "chartType" varchar(20) CHECK ("chartType" IN ('line', 'bar', 'pie', 'doughnut', 'area')),
        endpoint varchar(500) NOT NULL,
        columns integer DEFAULT 12,
        "order" integer DEFAULT 0,
        "isActive" boolean DEFAULT true,
        description text,
        config jsonb,
        "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 9. CREATE DASHBOARD_CARDS TABLE
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS dashboard_cards (
        id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        title varchar(255) NOT NULL,
        icon varchar(100),
        endpoint varchar(500) NOT NULL,
        "dataType" varchar(20) CHECK ("dataType" IN ('number', 'percentage', 'currency')) DEFAULT 'number',
        "secondaryTitle" varchar(255),
        "secondaryIcon" varchar(100),
        "secondaryEndpoint" varchar(500),
        "secondaryDataType" varchar(20) CHECK ("secondaryDataType" IN ('number', 'percentage', 'currency')),
        columns decimal(3,1) DEFAULT 3,
        "order" integer DEFAULT 0,
        "isActive" boolean DEFAULT true,
        description text,
        config jsonb,
        "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 10. CREATE EXTERNAL_API_CONNECTIONS TABLE
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS external_api_connections (
        id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        name varchar(255) NOT NULL,
        "displayName" varchar(255) NOT NULL,
        description text,
        type varchar(20) CHECK (type IN ('REST', 'GRAPHQL', 'SOAP', 'WEBHOOK')) NOT NULL,
        "baseUrl" varchar(500) NOT NULL,
        "authType" varchar(20) CHECK ("authType" IN ('NONE', 'API_KEY', 'BEARER_TOKEN', 'BASIC_AUTH', 'OAUTH2')) NOT NULL,
        "authConfig" text,
        "defaultHeaders" text,
        config text,
        "isActive" boolean DEFAULT true,
        "isGlobal" boolean DEFAULT false,
        "testEndpoint" varchar(500),
        "testMethod" varchar(10) DEFAULT 'GET',
        "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // CREATE ALL INDEXES
    console.log('📋 Creating indexes...');

    // Tenants indexes
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_tenants_slug" ON "tenants" ("slug")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_tenants_domain" ON "tenants" ("domain")');

    // Users indexes
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_users_email" ON "users" ("email")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_users_role" ON "users" ("role")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_users_tenant" ON "users" ("tenantId")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_users_active" ON "users" ("isActive")');

    // Permissions indexes
    // Drop old incorrect unique index if it exists
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_permissions_role_resource"');
    // Create correct unique index including pluginId
    await queryRunner.query('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_permissions_role_resource_plugin" ON "permissions" ("role", "resource", "pluginId")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_permissions_role" ON "permissions" ("role")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_permissions_resource" ON "permissions" ("resource")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_permissions_plugin" ON "permissions" ("pluginId")');

    // Settings indexes
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_settings_key" ON "settings" ("key")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_settings_category" ON "settings" ("category")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_settings_public" ON "settings" ("isPublic")');

    // Translations indexes
    await queryRunner.query('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_translations_key_language" ON "translations" ("key", "language")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_translations_category" ON "translations" ("category")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_translations_system" ON "translations" ("isSystem")');

    // Installed plugins indexes
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_installed_plugins_slug" ON "installed_plugins" ("slug")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_installed_plugins_status" ON "installed_plugins" ("status")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_installed_plugins_active" ON "installed_plugins" ("isActive")');

    // Dashboard indexes
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_dashboard_blocks_order" ON "dashboard_blocks" ("order")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_dashboard_blocks_active" ON "dashboard_blocks" ("isActive")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_dashboard_cards_order" ON "dashboard_cards" ("order")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_dashboard_cards_active" ON "dashboard_cards" ("isActive")');

    // External API indexes
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_external_api_name" ON "external_api_connections" ("name")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_external_api_active" ON "external_api_connections" ("isActive")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_external_api_global" ON "external_api_connections" ("isGlobal")');

    // ENSURE MISSING COLUMNS EXIST
    console.log('🔧 Ensuring all columns exist...');

    // Add missing columns to dashboard_cards if they don't exist
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'dashboard_cards' AND column_name = 'description'
        ) THEN
          ALTER TABLE dashboard_cards ADD COLUMN description text;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'dashboard_cards' AND column_name = 'config'
        ) THEN
          ALTER TABLE dashboard_cards ADD COLUMN config jsonb;
        END IF;
      END $$;
    `);

    // Add missing columns to dashboard_blocks if they don't exist
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'dashboard_blocks' AND column_name = 'endpoint'
        ) THEN
          ALTER TABLE dashboard_blocks ADD COLUMN endpoint varchar(500) NOT NULL DEFAULT '/api/placeholder';
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'dashboard_blocks' AND column_name = 'description'
        ) THEN
          ALTER TABLE dashboard_blocks ADD COLUMN description text;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'dashboard_blocks' AND column_name = 'columns'
        ) THEN
          ALTER TABLE dashboard_blocks ADD COLUMN columns integer DEFAULT 12;
        END IF;
      END $$;
    `);

    // Drop old columns from dashboard_blocks if they exist
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'dashboard_blocks' AND column_name = 'width'
        ) THEN
          ALTER TABLE dashboard_blocks DROP COLUMN width;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'dashboard_blocks' AND column_name = 'height'
        ) THEN
          ALTER TABLE dashboard_blocks DROP COLUMN height;
        END IF;
      END $$;
    `);

    // Add installerId column to installed_plugins if it doesn't exist
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'installed_plugins' AND column_name = 'installerId'
        ) THEN
          ALTER TABLE installed_plugins ADD COLUMN "installerId" uuid;
        END IF;
      END $$;
    `);

    // CREATE FOREIGN KEYS
    console.log('🔗 Creating foreign keys...');

    // Users -> Tenants
    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'fk_users_tenant'
        ) THEN
          ALTER TABLE users ADD CONSTRAINT fk_users_tenant 
          FOREIGN KEY ("tenantId") REFERENCES tenants(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // Installed plugins -> Users (only if installerId column exists)
    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'installed_plugins' AND column_name = 'installerId'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'fk_installed_plugins_installer'
        ) THEN
          ALTER TABLE installed_plugins ADD CONSTRAINT fk_installed_plugins_installer 
          FOREIGN KEY ("installerId") REFERENCES users(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // INSERT DEFAULT DATA
    console.log('📊 Inserting default data...');

    // Insert default tenant
    await queryRunner.query(`
      INSERT INTO tenants (slug, name, description, "isActive") 
      VALUES ('default', 'Default Organization', 'Default tenant for single-tenant mode', true)
      ON CONFLICT (slug) DO NOTHING
    `);

    // Insert system roles
    await queryRunner.query(`
      INSERT INTO roles (name, "displayName", description, "isSystem", "isDefault", "isActive") VALUES
      ('USER', 'Usuario', 'Usuario estándar del sistema', true, true, true),
      ('DEVELOPER', 'Desarrollador', 'Desarrollador con acceso a plugins', true, false, true),
      ('ADMIN', 'Administrador', 'Administrador con acceso completo - NO MODIFICABLE', true, false, true)
      ON CONFLICT (name) DO NOTHING
    `);

    // Insert basic settings
    await queryRunner.query(`
      INSERT INTO settings (key, value, category, description, "isPublic") VALUES
      ('siteName', 'Admin Panel', 'GENERAL', 'Site name displayed in header', true),
      ('siteLogo', '', 'GENERAL', 'Site logo URL', true),
      ('useLogoOnly', 'false', 'GENERAL', 'Show only logo without site name', true),
      ('language', 'en', 'GENERAL', 'Default system language', true),
      ('timezone', 'UTC', 'GENERAL', 'Default system timezone', true),
      ('multiTenancyEnabled', 'false', 'ADVANCED', 'Enable multi-tenancy support', true),
      ('debugMode', 'false', 'ADVANCED', 'Enable debug mode', false),
      ('sessionTimeout', '30', 'SECURITY', 'Session timeout in minutes', false),
      ('autoUpdate', 'true', 'PLUGINS', 'Auto-update plugins', false),
      ('hotReload', 'true', 'PLUGINS', 'Enable hot reload for plugins', false),
      ('allowExternal', 'false', 'PLUGINS', 'Allow external plugin sources', false),
      ('emailNotifications', 'true', 'NOTIFICATIONS', 'Enable email notifications', false),
      ('browserNotifications', 'true', 'NOTIFICATIONS', 'Enable browser notifications', false)
      ON CONFLICT (key) DO NOTHING
    `);

    // Insert basic permissions for system roles
    await queryRunner.query(`
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
      
      ON CONFLICT (role, resource, "pluginId") DO NOTHING
    `);

    console.log('✅ Initial schema created successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys first
    await queryRunner.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_tenant');
    await queryRunner.query('ALTER TABLE installed_plugins DROP CONSTRAINT IF EXISTS fk_installed_plugins_installer');
    
    // Drop tables in reverse order
    await queryRunner.query('DROP TABLE IF EXISTS external_api_connections');
    await queryRunner.query('DROP TABLE IF EXISTS dashboard_cards');
    await queryRunner.query('DROP TABLE IF EXISTS dashboard_blocks');
    await queryRunner.query('DROP TABLE IF EXISTS installed_plugins');
    await queryRunner.query('DROP TABLE IF EXISTS translations');
    await queryRunner.query('DROP TABLE IF EXISTS settings');
    await queryRunner.query('DROP TABLE IF EXISTS permissions');
    await queryRunner.query('DROP TABLE IF EXISTS users');
    await queryRunner.query('DROP TABLE IF EXISTS roles');
    await queryRunner.query('DROP TABLE IF EXISTS tenants');
    
    console.log('✅ Schema dropped');
  }
}