import { AppDataSource } from '../config/database';

async function checkTenantIdColumn() {
  try {
    await AppDataSource.initialize();
    console.log('Database connected successfully');

    // Check if tenantId column exists
    const queryRunner = AppDataSource.createQueryRunner();
    
    const result = await queryRunner.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'tenantId'
    `);
    
    console.log('TenantId column info:', result);
    
    if (result.length === 0) {
      console.log('❌ tenantId column does not exist in users table');
      
      // Show all columns in users table
      const allColumns = await queryRunner.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'users'
        ORDER BY ordinal_position
      `);
      
      console.log('All columns in users table:', allColumns);
    } else {
      console.log('✅ tenantId column exists');
    }
    
    await queryRunner.release();
    await AppDataSource.destroy();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkTenantIdColumn();