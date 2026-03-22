import 'dotenv/config';
import { AppDataSource } from '../config/database';

async function fixPermissionIndex() {
  try {
    console.log('🔧 Checking DATABASE_URL...');
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL is not defined in .env file');
      process.exit(1);
    }
    console.log('✅ DATABASE_URL found');
    
    console.log('🔧 Connecting to database...');
    await AppDataSource.initialize();
    console.log('✅ Database connected');

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    console.log('🔧 Dropping old unique index...');
    try {
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_a4218e188848e332be62ef5a91"`);
      console.log('✅ Old index dropped');
    } catch (error) {
      console.log('⚠️  Old index might not exist, continuing...');
    }

    console.log('🔧 Creating new unique index on (role, resource, pluginId)...');
    try {
      await queryRunner.query(`CREATE UNIQUE INDEX "IDX_permission_role_resource_plugin" ON "permissions" ("role", "resource", "pluginId")`);
      console.log('✅ New index created successfully');
    } catch (error: any) {
      if (error.code === '23505' || error.message.includes('already exists')) {
        console.log('⚠️  Index already exists, skipping...');
      } else {
        throw error;
      }
    }

    await queryRunner.release();
    await AppDataSource.destroy();

    console.log('✅ Permission index fixed successfully!');
    console.log('\nYou can now:');
    console.log('  1. Restart the backend');
    console.log('  2. Uninstall Task Manager (if installed)');
    console.log('  3. Install Task Manager again');
    console.log('  4. Check sidebar and permissions!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing permission index:', error);
    process.exit(1);
  }
}

fixPermissionIndex();

