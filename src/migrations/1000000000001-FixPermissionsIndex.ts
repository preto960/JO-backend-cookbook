import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixPermissionsIndex1000000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🔧 Fixing permissions unique index...');

    // Drop the old incorrect unique index if it exists
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_permissions_role_resource"');
    
    // Remove any duplicate permissions that might exist due to the incorrect index
    await queryRunner.query(`
      DELETE FROM permissions 
      WHERE id NOT IN (
        SELECT DISTINCT ON (role, resource, COALESCE("pluginId", '')) id
        FROM permissions 
        ORDER BY role, resource, COALESCE("pluginId", ''), "createdAt" ASC
      )
    `);

    // Create the correct unique index including pluginId
    await queryRunner.query('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_permissions_role_resource_plugin" ON "permissions" ("role", "resource", "pluginId")');

    console.log('✅ Permissions index fixed successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('🔧 Reverting permissions index fix...');
    
    // Drop the correct index
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_permissions_role_resource_plugin"');
    
    // Recreate the old incorrect index
    await queryRunner.query('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_permissions_role_resource" ON "permissions" ("role", "resource")');
    
    console.log('✅ Permissions index reverted');
  }
}