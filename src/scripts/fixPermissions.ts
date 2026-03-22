import dotenv from 'dotenv';
dotenv.config();

import { AppDataSource } from '../config/database';
import { Permission, ResourceType } from '../models/Permission';
import { UserRole } from '../models/User';

async function fixPermissions() {
  try {
    // Initialize WITHOUT synchronize to avoid conflicts
    const tempDataSource = new (await import('typeorm')).DataSource({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      synchronize: false, // IMPORTANT: Don't auto-sync
      logging: false
    });
    
    await tempDataSource.initialize();
    console.log('✅ Database connected');

    // Drop and recreate permissions table
    await tempDataSource.query(`DROP TABLE IF EXISTS "permissions" CASCADE`);
    console.log('✅ Dropped permissions table');

    // Drop old enums if they exist
    await tempDataSource.query(`DROP TYPE IF EXISTS "public"."permissions_role_enum" CASCADE`);
    await tempDataSource.query(`DROP TYPE IF EXISTS "public"."permissions_resource_enum" CASCADE`);
    console.log('✅ Dropped old enum types');

    // Create role enum (TypeORM expects this)
    await tempDataSource.query(`
      CREATE TYPE "public"."permissions_role_enum" AS ENUM ('USER', 'DEVELOPER', 'ADMIN')
    `);
    console.log('✅ Created role enum');

    // Create the new table with the correct schema
    await tempDataSource.query(`
      CREATE TABLE "permissions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "role" "public"."permissions_role_enum" NOT NULL,
        "resource" character varying(255) NOT NULL,
        "pluginId" character varying,
        "isDynamic" boolean NOT NULL DEFAULT false,
        "resourceLabel" character varying,
        "resourceDescription" text,
        "canView" boolean NOT NULL DEFAULT false,
        "canCreate" boolean NOT NULL DEFAULT false,
        "canEdit" boolean NOT NULL DEFAULT false,
        "canDelete" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_permissions_role_resource" UNIQUE ("role", "resource")
      )
    `);
    console.log('✅ Created permissions table with new schema');

    // Create indexes
    await tempDataSource.query(`CREATE INDEX "IDX_permissions_pluginId" ON "permissions" ("pluginId")`);
    console.log('✅ Created indexes');

    // Seed default permissions using the temp connection
    const permissions: any[] = [];

    // USER role
    permissions.push(
      { role: 'USER', resource: ResourceType.DASHBOARD, canView: true, canCreate: false, canEdit: false, canDelete: false, pluginId: null, isDynamic: false },
      { role: 'USER', resource: ResourceType.MARKET, canView: false, canCreate: false, canEdit: false, canDelete: false, pluginId: null, isDynamic: false },
      { role: 'USER', resource: ResourceType.PLUGINS, canView: false, canCreate: false, canEdit: false, canDelete: false, pluginId: null, isDynamic: false },
      { role: 'USER', resource: ResourceType.USERS, canView: false, canCreate: false, canEdit: false, canDelete: false, pluginId: null, isDynamic: false },
      { role: 'USER', resource: ResourceType.SETTINGS, canView: false, canCreate: false, canEdit: false, canDelete: false, pluginId: null, isDynamic: false },
      { role: 'USER', resource: ResourceType.PROFILE, canView: true, canCreate: false, canEdit: true, canDelete: false, pluginId: null, isDynamic: false }
    );

    // DEVELOPER role
    permissions.push(
      { role: 'DEVELOPER', resource: ResourceType.DASHBOARD, canView: true, canCreate: false, canEdit: false, canDelete: false, pluginId: null, isDynamic: false },
      { role: 'DEVELOPER', resource: ResourceType.MARKET, canView: true, canCreate: true, canEdit: true, canDelete: false, pluginId: null, isDynamic: false },
      { role: 'DEVELOPER', resource: ResourceType.PLUGINS, canView: true, canCreate: true, canEdit: true, canDelete: true, pluginId: null, isDynamic: false },
      { role: 'DEVELOPER', resource: ResourceType.USERS, canView: false, canCreate: false, canEdit: false, canDelete: false, pluginId: null, isDynamic: false },
      { role: 'DEVELOPER', resource: ResourceType.SETTINGS, canView: false, canCreate: false, canEdit: false, canDelete: false, pluginId: null, isDynamic: false },
      { role: 'DEVELOPER', resource: ResourceType.PROFILE, canView: true, canCreate: false, canEdit: true, canDelete: false, pluginId: null, isDynamic: false }
    );

    // ADMIN role
    permissions.push(
      { role: 'ADMIN', resource: ResourceType.DASHBOARD, canView: true, canCreate: true, canEdit: true, canDelete: true, pluginId: null, isDynamic: false },
      { role: 'ADMIN', resource: ResourceType.MARKET, canView: true, canCreate: true, canEdit: true, canDelete: true, pluginId: null, isDynamic: false },
      { role: 'ADMIN', resource: ResourceType.PLUGINS, canView: true, canCreate: true, canEdit: true, canDelete: true, pluginId: null, isDynamic: false },
      { role: 'ADMIN', resource: ResourceType.USERS, canView: true, canCreate: true, canEdit: true, canDelete: true, pluginId: null, isDynamic: false },
      { role: 'ADMIN', resource: ResourceType.SETTINGS, canView: true, canCreate: true, canEdit: true, canDelete: true, pluginId: null, isDynamic: false },
      { role: 'ADMIN', resource: ResourceType.PROFILE, canView: true, canCreate: false, canEdit: true, canDelete: false, pluginId: null, isDynamic: false }
    );

    // Insert permissions using raw SQL
    for (const perm of permissions) {
      await tempDataSource.query(`
        INSERT INTO "permissions" ("role", "resource", "pluginId", "isDynamic", "canView", "canCreate", "canEdit", "canDelete")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [perm.role, perm.resource, perm.pluginId, perm.isDynamic, perm.canView, perm.canCreate, perm.canEdit, perm.canDelete]);
    }
    console.log(`✅ Seeded ${permissions.length} default permissions`);

    await tempDataSource.destroy();
    console.log('✅ Done!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixPermissions();

