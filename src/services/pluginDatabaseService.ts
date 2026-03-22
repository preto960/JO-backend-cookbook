import { AppDataSource } from '../config/database';
import { InstalledPlugin } from '../models/InstalledPlugin';
import path from 'path';
import fs from 'fs/promises';

/**
 * Servicio para manejar las operaciones de base de datos de los plugins
 */
export class PluginDatabaseService {
  /**
   * Crea las tablas necesarias para un plugin ejecutando su script SQL de migración
   */
  async createPluginTables(plugin: InstalledPlugin, pluginDir: string): Promise<void> {
    console.log(`🗄️  Creating database tables for plugin ${plugin.name}`);

    try {
      // Buscar el archivo de migración SQL del plugin
      const migrationPath = path.join(pluginDir, 'backend', 'migrations', 'install.sql');
      
      try {
        await fs.access(migrationPath);
      } catch {
        console.log(`   ⚠️  No install.sql found for ${plugin.name}, skipping table creation`);
        return;
      }

      console.log(`   ✓ Found migration file: ${migrationPath}`);

      // Leer el archivo SQL
      const sqlContent = await fs.readFile(migrationPath, 'utf-8');
      
      if (!sqlContent.trim()) {
        console.log(`   ⚠️  Migration file is empty`);
        return;
      }

      // Ejecutar el SQL
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();

      try {
        await queryRunner.query(sqlContent);
        console.log(`   ✅ Tables created successfully for ${plugin.name}`);
      } finally {
        await queryRunner.release();
      }
    } catch (error: any) {
      console.error(`   ❌ Failed to create tables for ${plugin.name}:`, error.message);
      throw error;
    }
  }

  /**
   * Elimina las tablas de un plugin ejecutando su script SQL de desinstalación
   */
  async dropPluginTables(plugin: InstalledPlugin, pluginDir?: string): Promise<void> {
    console.log(`🗑️  Dropping database tables for plugin ${plugin.name}`);

    if (!pluginDir) {
      console.log(`   ⚠️  Plugin directory not provided, cannot drop tables`);
      return;
    }

    try {
      // Buscar el archivo de desinstalación SQL del plugin
      const uninstallPath = path.join(pluginDir, 'backend', 'migrations', 'uninstall.sql');
      
      try {
        await fs.access(uninstallPath);
      } catch {
        console.log(`   ⚠️  No uninstall.sql found for ${plugin.name}, skipping table removal`);
        return;
      }

      console.log(`   ✓ Found uninstall file: ${uninstallPath}`);

      // Leer el archivo SQL
      const sqlContent = await fs.readFile(uninstallPath, 'utf-8');
      
      if (!sqlContent.trim()) {
        console.log(`   ⚠️  Uninstall file is empty`);
        return;
      }

      // Ejecutar el SQL
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();

      try {
        await queryRunner.query(sqlContent);
        console.log(`   ✅ Tables dropped successfully for ${plugin.name}`);
      } finally {
        await queryRunner.release();
      }
    } catch (error: any) {
      console.error(`   ❌ Failed to drop tables for ${plugin.name}:`, error.message);
      throw error;
    }
  }

  /**
   * Verifica si las tablas de un plugin existen
   * Busca tablas que empiecen con el prefijo del plugin
   */
  async pluginTablesExist(plugin: InstalledPlugin): Promise<boolean> {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Generar el prefijo esperado para las tablas del plugin
      // Ejemplo: task-manager -> plugin_task_manager_ o plugin_tasks, plugin_task_categories
      const pluginPrefix = `plugin_${plugin.slug.replace(/-/g, '_')}`;
      
      // Buscar tablas que empiecen con el prefijo del plugin
      const result = await queryRunner.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE '${pluginPrefix}%'
      `);

      return result.length > 0;
    } catch (error: any) {
      console.error(`Failed to check tables for ${plugin.name}:`, error.message);
      return false;
    } finally {
      await queryRunner.release();
    }
  }
}

export const pluginDatabaseService = new PluginDatabaseService();

