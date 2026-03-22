import dotenv from 'dotenv';
dotenv.config();

import { AppDataSource } from '../config/database';

async function resetDatabase() {
  try {
    console.log('🗑️ Resetting database...');
    
    // Initialize without synchronize to avoid conflicts
    const dataSource = AppDataSource.setOptions({ synchronize: false });
    await dataSource.initialize();
    console.log('📊 Database connected');

    // 1. Drop all tables with CASCADE to handle foreign keys
    console.log('🔥 Dropping all tables...');
    
    const tables = [
      'external_api_connections',
      'dashboard_cards', 
      'dashboard_blocks',
      'installed_plugins',
      'translations',
      'settings',
      'permissions',
      'users',
      'roles',
      'tenants',
      'migrations' // Important: also drop the migrations table
    ];

    for (const table of tables) {
      try {
        await dataSource.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
        console.log(`✅ Dropped table: ${table}`);
      } catch (error) {
        console.log(`⚠️ Could not drop table ${table}:`, (error as Error).message);
      }
    }

    // 2. Drop any remaining sequences, indexes, or constraints
    console.log('🧹 Cleaning up remaining database objects...');
    
    // Drop any remaining sequences
    await dataSource.query(`
      DO $$ 
      DECLARE 
        r RECORD;
      BEGIN
        FOR r IN (SELECT schemaname, sequencename FROM pg_sequences WHERE schemaname = 'public') 
        LOOP
          EXECUTE 'DROP SEQUENCE IF EXISTS ' || quote_ident(r.schemaname) || '.' || quote_ident(r.sequencename) || ' CASCADE';
        END LOOP;
      END $$;
    `);

    // Drop any remaining functions (except system functions)
    await dataSource.query(`
      DO $$ 
      DECLARE 
        r RECORD;
      BEGIN
        FOR r IN (
          SELECT proname, pronargs 
          FROM pg_proc 
          WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
          AND proname NOT IN ('uuid_generate_v4', 'gen_random_uuid')
        ) 
        LOOP
          BEGIN
            EXECUTE 'DROP FUNCTION IF EXISTS ' || quote_ident(r.proname) || ' CASCADE';
          EXCEPTION WHEN OTHERS THEN
            -- Ignore errors for system functions
          END;
        END LOOP;
      END $$;
    `);

    // Drop any remaining types/enums
    await dataSource.query(`
      DO $$ 
      DECLARE 
        r RECORD;
      BEGIN
        FOR r IN (SELECT typname FROM pg_type WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND typtype = 'e') 
        LOOP
          EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
        END LOOP;
      END $$;
    `);

    // Drop any remaining views
    await dataSource.query(`
      DO $$ 
      DECLARE 
        r RECORD;
      BEGIN
        FOR r IN (SELECT viewname FROM pg_views WHERE schemaname = 'public') 
        LOOP
          EXECUTE 'DROP VIEW IF EXISTS ' || quote_ident(r.viewname) || ' CASCADE';
        END LOOP;
      END $$;
    `);

    console.log('✅ Database completely reset');
    console.log('');
    console.log('🚀 Next steps:');
    console.log('   1. Run: npm run migration:run');
    console.log('   2. Run: npm run seed');
    console.log('');

  } catch (error) {
    console.error('❌ Error during database reset:', error);
    throw error;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

// Execute if called directly
if (require.main === module) {
  resetDatabase()
    .then(() => {
      console.log('✅ Database reset completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Database reset failed:', error);
      process.exit(1);
    });
}

export default resetDatabase;