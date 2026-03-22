import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { Setting, SettingCategory } from '../models/Setting';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

export class SettingController {
  private settingRepository = AppDataSource.getRepository(Setting);

  getAllSettings = async (req: AuthRequest, res: Response) => {
    try {
      const settings = await this.settingRepository.find({
        order: { category: 'ASC', key: 'ASC' }
      });

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

  getSetting = async (req: AuthRequest, res: Response) => {
    try {
      const { key } = req.params;

      const setting = await this.settingRepository.findOne({ where: { key } });

      if (!setting) {
        throw createError('Setting not found', 404);
      }

      res.json({ setting });
    } catch (error) {
      console.error('Error fetching setting:', error);
      res.status(500).json({ message: 'Failed to fetch setting' });
    }
  };

  updateSetting = async (req: AuthRequest, res: Response) => {
    try {
      const { key, value } = req.body;

      if (!key || value === undefined) {
        throw createError('Key and value are required', 400);
      }

      const setting = await this.settingRepository.findOne({ where: { key } });

      if (!setting) {
        throw createError('Setting not found', 404);
      }

      setting.value = value;
      await this.settingRepository.save(setting);

      res.json({ message: 'Setting updated successfully', setting });
    } catch (error) {
      console.error('Error updating setting:', error);
      res.status(500).json({ message: 'Failed to update setting' });
    }
  };

  bulkUpdateSettings = async (req: AuthRequest, res: Response) => {
    try {
      const { settings } = req.body;

      if (!settings || typeof settings !== 'object') {
        throw createError('Settings object is required', 400);
      }

      const results = [];

      for (const [key, value] of Object.entries(settings)) {
        const setting = await this.settingRepository.findOne({ where: { key } });

        if (setting) {
          setting.value = value as string;
          await this.settingRepository.save(setting);
          results.push(setting);
        }
      }

      res.json({ message: 'Settings updated successfully', count: results.length });
    } catch (error) {
      console.error('Error bulk updating settings:', error);
      res.status(500).json({ message: 'Failed to update settings' });
    }
  };

  getPublicSettings = async (req: AuthRequest, res: Response) => {
    try {
      const settings = await this.settingRepository.find({
        where: { isPublic: true },
        order: { category: 'ASC', key: 'ASC' }
      });

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

  resetSettings = async (req: AuthRequest, res: Response) => {
    try {
      await this.settingRepository.clear();

      const defaultSettings = this.getDefaultSettings();
      await this.settingRepository.save(defaultSettings);

      const settings = await this.settingRepository.find({
        order: { category: 'ASC', key: 'ASC' }
      });

      const grouped = settings.reduce((acc, setting) => {
        if (!acc[setting.category]) {
          acc[setting.category] = {};
        }
        acc[setting.category][setting.key] = setting.value;
        return acc;
      }, {} as Record<string, Record<string, string>>);

      res.json({ message: 'Settings reset to default successfully', settings: grouped });
    } catch (error) {
      console.error('Error resetting settings:', error);
      res.status(500).json({ message: 'Failed to reset settings' });
    }
  };

  private getDefaultSettings(): Partial<Setting>[] {
    return [
      { key: 'siteName', value: 'App Backend', category: SettingCategory.GENERAL, description: 'Application name', isPublic: true },
      { key: 'language', value: 'en', category: SettingCategory.GENERAL, description: 'Default language', isPublic: true },
      { key: 'sessionTimeout', value: '30', category: SettingCategory.SECURITY, description: 'Session timeout in minutes', isPublic: false },
      { key: 'emailNotifications', value: 'true', category: SettingCategory.NOTIFICATIONS, description: 'Enable email notifications', isPublic: false },
      { key: 'debugMode', value: 'false', category: SettingCategory.ADVANCED, description: 'Enable debug mode', isPublic: false },
    ];
  }
}
