import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { AppDataSource } from '../config/database';
import { Permission } from '../models/Permission';

async function testPermissionCleanup() {
  try {
    console.log('🔌 Connecting to database...');
    await AppDataSource.initialize();
    console.log('✅ Database connected\n');

    const permissionRepo = AppDataSource.getRepository(Permission);

    // 1. Check current plugin permissions
    console.log('📊 Current Plugin Permissions:');
    console.log('═'.repeat(60));
    
    const pluginPermissions = await permissionRepo.find({
      where: { isDynamic: true },
      order: { pluginId: 'ASC', role: 'ASC', resource: 'ASC' }
    });

    if (pluginPermissions.length === 0) {
      console.log('   No plugin permissions found in database');
    } else {
      // Group by plugin
      const byPlugin: Record<string, Permission[]> = {};
      for (const perm of pluginPermissions) {
        const pluginId = perm.pluginId || 'unknown';
        if (!byPlugin[pluginId]) byPlugin[pluginId] = [];
        byPlugin[pluginId].push(perm);
      }

      for (const [pluginId, perms] of Object.entries(byPlugin)) {
        console.log(`\n   Plugin ID: ${pluginId}`);
        console.log(`   Total Permissions: ${perms.length}`);
        
        // Group by resource
        const byResource: Record<string, Permission[]> = {};
        for (const perm of perms) {
          if (!byResource[perm.resource]) byResource[perm.resource] = [];
          byResource[perm.resource].push(perm);
        }

        for (const [resource, resourcePerms] of Object.entries(byResource)) {
          const label = resourcePerms[0].resourceLabel || resource;
          console.log(`   - ${label} (${resource}): ${resourcePerms.length} roles`);
          
          for (const perm of resourcePerms) {
            const actions = [];
            if (perm.canView) actions.push('View');
            if (perm.canCreate) actions.push('Create');
            if (perm.canEdit) actions.push('Edit');
            if (perm.canDelete) actions.push('Delete');
            console.log(`     • ${perm.role}: ${actions.join(', ')}`);
          }
        }
      }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('\n💡 To test permission cleanup:');
    console.log('   1. Note the Plugin ID above');
    console.log('   2. Uninstall the plugin from the frontend');
    console.log('   3. Run this script again to verify permissions were deleted');
    console.log('\n   OR run the uninstall command:');
    console.log('   DELETE FROM installed_plugins WHERE id = \'<plugin-id>\';');
    console.log('   (This will trigger the cascade delete)\n');

    await AppDataSource.destroy();
    console.log('✅ Done!\n');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testPermissionCleanup();

