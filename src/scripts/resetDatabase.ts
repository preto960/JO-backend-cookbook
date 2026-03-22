import dotenv from 'dotenv';
dotenv.config();
 
import { AppDataSource, initializeDatabase } from '../config/database';
 
async function resetDatabase() {
  try {
    console.log('🗑️  Resetting database...');
 
    await initializeDatabase();
    console.log('📊 Database connected');
 
    const tables = [
      'translations',
      'settings',
      'permissions',
      'users',
      'roles',
      'migrations'
    ];
 
    console.log('🔥 Dropping all tables...');
    for (const table of tables) {
      try {
        await AppDataSource.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
        console.log(`✅ Dropped: ${table}`);
      } catch (error) {
        console.log(`⚠️  Could not drop ${table}:`, (error as Error).message);
      }
    }
 
    // Drop enums
    await AppDataSource.query(`
      DO $$
      DECLARE r RECORD;
      BEGIN
        FOR r IN (SELECT typname FROM pg_type WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND typtype = 'e')
        LOOP
          EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
        END LOOP;
      END $$;
    `);
 
    console.log('✅ Database completely reset');
    console.log('');
    console.log('🚀 Next steps:');
    console.log('   1. npm run migration:run');
    console.log('   2. npm run seed');
 
  } catch (error) {
    console.error('❌ Error during database reset:', error);
    throw error;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}
 
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