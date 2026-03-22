import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { Setting, SettingCategory } from '../models/Setting';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { settingsCache } from '../services/settingsCache';
import { TenantResolver } from '../middleware/tenantResolver';

export class SettingController {
  private settingRepository = AppDataSource.getRepository(Setting);

  // Get all settings
  getAllSettings = async (req: AuthRequest, res: Response) => {
    try {
      const settings = await this.settingRepository.find({
        order: {
          category: 'ASC',
          key: 'ASC'
        }
      });

      // Convert array to object grouped by category
      const grouped = settings.reduce((acc, setting) => {
        if (!acc[setting.category]) {
          acc[setting.category] = {};
        }
        acc[setting.category][setting.key] = setting.value;
        return acc;
      }, {} as Record<string, Record<string, string>>);

      res.json({ settings: grouped });
    } catch (error) {
      console.error('Error fetching settings:', error);
      res.status(500).json({ message: 'Failed to fetch settings' });
    }
  };

  // Get settings by category
  getSettingsByCategory = async (req: AuthRequest, res: Response) => {
    try {
      const { category } = req.params;

      if (!Object.values(SettingCategory).includes(category as SettingCategory)) {
        throw createError('Invalid category', 400);
      }

      const settings = await this.settingRepository.find({
        where: { category: category as SettingCategory },
        order: { key: 'ASC' }
      });

      // Convert to key-value object
      const settingsObj = settings.reduce((acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {} as Record<string, string>);

      res.json({ settings: settingsObj });
    } catch (error) {
      console.error('Error fetching settings by category:', error);
      res.status(500).json({ message: 'Failed to fetch settings' });
    }
  };

  // Get single setting by key
  getSetting = async (req: AuthRequest, res: Response) => {
    try {
      const { key } = req.params;

      const setting = await this.settingRepository.findOne({
        where: { key }
      });

      if (!setting) {
        throw createError('Setting not found', 404);
      }

      res.json({ setting });
    } catch (error) {
      console.error('Error fetching setting:', error);
      res.status(500).json({ message: 'Failed to fetch setting' });
    }
  };

  // Update setting
  updateSetting = async (req: AuthRequest, res: Response) => {
    try {
      const { key, value } = req.body;

      if (!key || value === undefined) {
        throw createError('Key and value are required', 400);
      }

      let setting = await this.settingRepository.findOne({ where: { key } });

      if (setting) {
        const oldValue = setting.value;
        setting.value = value;
        await this.settingRepository.save(setting);

        // Actualizar cache y notificar cambios
        await settingsCache.set(key, value);

        // Limpiar caches relacionados si es necesario
        if (key === 'multiTenancyEnabled') {
          TenantResolver.clearCache();
          console.log(`🔄 Multi-tenancy mode ${value === 'true' ? 'enabled' : 'disabled'} dynamically`);
        }

        res.json({
          message: 'Setting updated successfully',
          setting,
          dynamicUpdate: true // Indica que el cambio es inmediato
        });
      } else {
        throw createError('Setting not found', 404);
      }
    } catch (error) {
      console.error('Error updating setting:', error);
      res.status(500).json({ message: 'Failed to update setting' });
    }
  };

  // Bulk update settings
  bulkUpdateSettings = async (req: AuthRequest, res: Response) => {
    try {
      const { settings } = req.body;

      if (!settings || typeof settings !== 'object') {
        throw createError('Settings object is required', 400);
      }

      const results = [];
      const cacheUpdates: Record<string, string> = {};
      let multiTenancyChanged = false;

      for (const [key, value] of Object.entries(settings)) {
        let setting = await this.settingRepository.findOne({ where: { key } });

        if (setting) {
          const oldValue = setting.value;
          setting.value = value as string;
          await this.settingRepository.save(setting);
          results.push(setting);

          // Preparar actualización de cache
          cacheUpdates[key] = value as string;

          // Detectar cambio en multi-tenancy
          if (key === 'multiTenancyEnabled' && oldValue !== value) {
            multiTenancyChanged = true;
          }
        }
      }

      // Actualizar cache en lote
      await settingsCache.setMultiple(cacheUpdates);

      // Limpiar caches relacionados si es necesario
      if (multiTenancyChanged) {
        TenantResolver.clearCache();
        const isEnabled = cacheUpdates['multiTenancyEnabled'] === 'true';
        console.log(`🔄 Multi-tenancy mode ${isEnabled ? 'enabled' : 'disabled'} dynamically`);
      }

      res.json({
        message: 'Settings updated successfully',
        count: results.length,
        dynamicUpdate: true,
        multiTenancyChanged
      });
    } catch (error) {
      console.error('Error bulk updating settings:', error);
      res.status(500).json({ message: 'Failed to update settings' });
    }
  };

  // Get public settings (no auth required)
  getPublicSettings = async (req: AuthRequest, res: Response) => {
    try {
      const settings = await this.settingRepository.find({
        where: { isPublic: true },
        order: {
          category: 'ASC',
          key: 'ASC'
        }
      });

      // Convert array to object grouped by category (same format as getAllSettings)
      const grouped = settings.reduce((acc, setting) => {
        if (!acc[setting.category]) {
          acc[setting.category] = {};
        }
        acc[setting.category][setting.key] = setting.value;
        return acc;
      }, {} as Record<string, Record<string, string>>);

      res.json({ settings: grouped });
    } catch (error) {
      console.error('Error fetching public settings:', error);
      res.status(500).json({ message: 'Failed to fetch public settings' });
    }
  };

  // Reset settings to default
  resetSettings = async (req: AuthRequest, res: Response) => {
    try {
      // Delete all existing settings
      await this.settingRepository.clear();

      // Create default settings
      const defaultSettings = this.getDefaultSettings();
      await this.settingRepository.save(defaultSettings);

      const settings = await this.settingRepository.find({
        order: {
          category: 'ASC',
          key: 'ASC'
        }
      });

      // Convert to grouped object
      const grouped = settings.reduce((acc, setting) => {
        if (!acc[setting.category]) {
          acc[setting.category] = {};
        }
        acc[setting.category][setting.key] = setting.value;
        return acc;
      }, {} as Record<string, Record<string, string>>);

      res.json({
        message: 'Settings reset to default successfully',
        settings: grouped
      });
    } catch (error) {
      console.error('Error resetting settings:', error);
      res.status(500).json({ message: 'Failed to reset settings' });
    }
  };

  // Helper method to get default settings
  private getDefaultSettings(): Partial<Setting>[] {
    return [
      // General Settings
      { key: 'siteName', value: 'Admin Panel', category: SettingCategory.GENERAL, description: 'Site name displayed in the application', isPublic: true },
      { key: 'siteLogo', value: '', category: SettingCategory.GENERAL, description: 'Site logo URL', isPublic: true },
      { key: 'useLogoOnly', value: 'false', category: SettingCategory.GENERAL, description: 'Show only logo without name', isPublic: true },
      { key: 'language', value: 'en', category: SettingCategory.GENERAL, description: 'Default system language', isPublic: true },
      { key: 'timezone', value: 'UTC', category: SettingCategory.GENERAL, description: 'System timezone', isPublic: false },

      // Plugin Settings
      { key: 'autoUpdate', value: 'true', category: SettingCategory.PLUGINS, description: 'Automatically update plugins', isPublic: false },
      { key: 'hotReload', value: 'true', category: SettingCategory.PLUGINS, description: 'Enable hot reload for plugins', isPublic: false },
      { key: 'allowExternal', value: 'false', category: SettingCategory.PLUGINS, description: 'Allow external plugin sources', isPublic: false },

      // Security Settings
      { key: 'twoFactor', value: 'false', category: SettingCategory.SECURITY, description: 'Require two-factor authentication', isPublic: false },
      { key: 'sessionTimeout', value: '30', category: SettingCategory.SECURITY, description: 'Session timeout in minutes', isPublic: false },
      { key: 'passwordExpiration', value: 'false', category: SettingCategory.SECURITY, description: 'Force password change every 90 days', isPublic: false },

      // Notification Settings
      { key: 'emailNotifications', value: 'true', category: SettingCategory.NOTIFICATIONS, description: 'Enable email notifications', isPublic: false },
      { key: 'browserNotifications', value: 'true', category: SettingCategory.NOTIFICATIONS, description: 'Enable browser notifications', isPublic: false },
      { key: 'pluginUpdateNotifications', value: 'true', category: SettingCategory.NOTIFICATIONS, description: 'Notify on plugin updates', isPublic: false },

      // Advanced Settings
      { key: 'debugMode', value: 'false', category: SettingCategory.ADVANCED, description: 'Enable debug mode', isPublic: false },
      { key: 'cacheDuration', value: '3600', category: SettingCategory.ADVANCED, description: 'Cache duration in seconds', isPublic: false },
      { key: 'multiTenancyEnabled', value: 'false', category: SettingCategory.ADVANCED, description: 'Enable multi-tenant mode for the application', isPublic: false },

      // Dashboard Settings
      { key: 'maxCards', value: '8', category: SettingCategory.DASHBOARD, description: 'Maximum number of dashboard cards', isPublic: false },
      { key: 'maxBlocks', value: '10', category: SettingCategory.DASHBOARD, description: 'Maximum number of dashboard blocks', isPublic: false },
      { key: 'refreshInterval', value: '30', category: SettingCategory.DASHBOARD, description: 'Dashboard refresh interval in seconds', isPublic: false },
      { key: 'enableDragDrop', value: 'true', category: SettingCategory.DASHBOARD, description: 'Enable drag and drop reordering', isPublic: false }
    ];
  }
}

