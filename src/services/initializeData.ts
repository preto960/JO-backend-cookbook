import { AppDataSource } from '../config/database';
import { SettingCategory } from '../models/Setting';

export class DataInitializer {

  async initializeDefaultData(): Promise<void> {
    try {
      console.log('🔧 Initializing default data...');

      // Esperar un poco para asegurar que las entidades estén completamente cargadas
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 1. Crear tenant por defecto si no existe
      await this.createDefaultTenant();

      // 2. Crear setting de multi-tenancy si no existe
      await this.createMultiTenancySetting();

      // 3. Verificar y crear columna tenantId si es necesario
      await this.ensureTenantIdColumn();

      console.log('✅ Default data initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing default data:', error);
      // No lanzar el error para que el servidor pueda continuar
      console.log('⚠️ Continuing without default data initialization...');
    }
  }

  private async createDefaultTenant(): Promise<void> {
    try {
      // Usar query raw para evitar problemas de metadatos
      const existingTenant = await AppDataSource.query(
        'SELECT * FROM tenants WHERE slug = $1 LIMIT 1',
        ['default']
      );

      if (existingTenant.length === 0) {
        await AppDataSource.query(`
          INSERT INTO tenants (slug, name, description, "isActive") 
          VALUES ($1, $2, $3, $4)
        `, ['default', 'Default Organization', 'Default tenant for single-tenant mode', true]);
        
        console.log('✅ Default tenant created');
      } else {
        console.log('ℹ️ Default tenant already exists');
      }
    } catch (error) {
      console.log('⚠️ Could not create default tenant (table might not exist yet):', (error as Error).message);
    }
  }

  private async createMultiTenancySetting(): Promise<void> {
    try {
      // Usar query raw para evitar problemas de metadatos
      const existingSetting = await AppDataSource.query(
        'SELECT * FROM settings WHERE key = $1 LIMIT 1',
        ['multiTenancyEnabled']
      );

      if (existingSetting.length === 0) {
        await AppDataSource.query(`
          INSERT INTO settings (key, value, category, description, "isPublic") 
          VALUES ($1, $2, $3, $4, $5)
        `, ['multiTenancyEnabled', 'false', 'advanced', 'Enable multi-tenant mode for the application', false]);
        
        console.log('✅ Multi-tenancy setting created');
      } else {
        console.log('ℹ️ Multi-tenancy setting already exists');
      }
    } catch (error) {
      console.log('⚠️ Could not create multi-tenancy setting:', (error as Error).message);
    }
  }

  private async ensureTenantIdColumn(): Promise<void> {
    try {
      console.log('🔍 Checking if tenantId column exists in users table...');
      
      // Verificar si la columna tenantId existe
      const columnExists = await AppDataSource.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'tenantId'
      `);

      if (columnExists.length === 0) {
        console.log('❌ tenantId column not found. Creating it...');
        
        // Crear la columna tenantId
        await AppDataSource.query(`
          ALTER TABLE users ADD COLUMN "tenantId" uuid
        `);
        console.log('✅ tenantId column created');

        // Verificar si la tabla tenants existe antes de crear la foreign key
        const tenantsTableExists = await AppDataSource.query(`
          SELECT table_name FROM information_schema.tables 
          WHERE table_name = 'tenants' AND table_schema = 'public'
        `);

        if (tenantsTableExists.length > 0) {
          // Crear foreign key constraint
          try {
            await AppDataSource.query(`
              ALTER TABLE users 
              ADD CONSTRAINT fk_users_tenant 
              FOREIGN KEY ("tenantId") REFERENCES tenants(id) ON DELETE SET NULL
            `);
            console.log('✅ Foreign key constraint created');
          } catch (fkError) {
            console.log('⚠️ Foreign key constraint already exists or failed:', (fkError as Error).message);
          }

          // Crear índice para mejorar performance
          try {
            await AppDataSource.query(`
              CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users("tenantId")
            `);
            console.log('✅ Index on tenantId created');
          } catch (indexError) {
            console.log('⚠️ Index creation failed:', (indexError as Error).message);
          }
        } else {
          console.log('⚠️ Tenants table does not exist, skipping foreign key creation');
        }

      } else {
        console.log('✅ tenantId column already exists');
      }
    } catch (error) {
      console.log('⚠️ Could not ensure tenantId column:', (error as Error).message);
    }
  }

  // Método para asignar usuarios existentes al tenant por defecto
  async assignUsersToDefaultTenant(): Promise<void> {
    try {
      // Primero verificar si el multi-tenancy está habilitado
      const multiTenancySetting = await AppDataSource.query(
        'SELECT value FROM settings WHERE key = $1 LIMIT 1',
        ['multiTenancyEnabled']
      );

      // Si no existe el setting o está deshabilitado, no hacer nada
      if (multiTenancySetting.length === 0 || multiTenancySetting[0].value !== 'true') {
        console.log('ℹ️ Multi-tenancy is disabled, skipping user assignment to tenant');
        return;
      }

      // Verificar si la columna tenantId existe
      const columnExists = await AppDataSource.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'tenantId'
      `);

      if (columnExists.length === 0) {
        console.log('ℹ️ tenantId column does not exist, skipping user assignment');
        return;
      }

      // Buscar el tenant por defecto usando query raw
      const defaultTenantResult = await AppDataSource.query(
        'SELECT id FROM tenants WHERE slug = $1 LIMIT 1',
        ['default']
      );

      if (defaultTenantResult.length === 0) {
        console.log('⚠️ Default tenant not found, skipping user assignment');
        return;
      }

      const defaultTenantId = defaultTenantResult[0].id;

      // Actualizar usuarios que no tienen tenantId
      const result = await AppDataSource.query(`
        UPDATE users 
        SET "tenantId" = $1 
        WHERE "tenantId" IS NULL
      `, [defaultTenantId]);

      console.log(`✅ Assigned users to default tenant`);
    } catch (error) {
      console.log('⚠️ Could not assign users to default tenant:', (error as Error).message);
    }
  }
}

export const dataInitializer = new DataInitializer();