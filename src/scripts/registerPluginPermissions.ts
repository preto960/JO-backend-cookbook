import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { AppDataSource } from '../config/database';
import { pluginPermissionService } from '../services/pluginPermissionService';

async function registerPluginPermissions() {
  try {
    console.log('🔌 Connecting to database...');
    await AppDataSource.initialize();
    console.log('✅ Database connected');

    // Path to task-manager plugin
    const pluginPath = path.join(__dirname, '../../plugins-runtime/task-manager');
    const manifestPath = path.join(pluginPath, 'manifest.json');

    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Manifest not found at ${manifestPath}`);
    }

    console.log('📄 Reading manifest...');
    const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent);

    console.log(`📋 Plugin: ${manifest.name} v${manifest.version}`);
    console.log(`🔐 Permissions found: ${manifest.permissions?.length || 0}`);

    // Get plugin ID from database (from installed_plugins table)
    const { InstalledPlugin } = await import('../models/InstalledPlugin');
    const installedPluginRepo = AppDataSource.getRepository(InstalledPlugin);
    const plugin = await installedPluginRepo.findOne({ where: { slug: manifest.slug } });

    if (!plugin) {
      throw new Error(`Plugin "${manifest.slug}" not found in installed_plugins. Please install it first.`);
    }

    console.log(`🆔 Plugin ID: ${plugin.id}`);

    // Unregister old permissions
    console.log('🗑️  Removing old permissions...');
    await pluginPermissionService.unregisterPluginPermissions(plugin.id);

    // Register new permissions
    console.log('📝 Registering new permissions...');
    await pluginPermissionService.registerPluginPermissions(plugin.id, manifest);

    console.log('✅ Permissions registered successfully!');
    console.log('\n📊 Summary:');
    
    const permissions = await pluginPermissionService.getPluginPermissions(plugin.id);
    console.log(`   Total permissions: ${permissions.length}`);
    
    // Group by resource
    const byResource = permissions.reduce((acc: any, p: any) => {
      if (!acc[p.resource]) acc[p.resource] = [];
      acc[p.resource].push(p);
      return acc;
    }, {});

    for (const [resource, perms] of Object.entries(byResource)) {
      console.log(`   - ${resource}: ${(perms as any[]).length} roles configured`);
    }

    await AppDataSource.destroy();
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

registerPluginPermissions();

