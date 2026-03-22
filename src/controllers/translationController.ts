import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Translation, SupportedLanguage } from '../models/Translation';
import { AuthRequest } from '../middleware/auth';
import { UserRole } from '../models/User';
import { pusher } from '../config/pusher';

export class TranslationController {
  private translationRepository = AppDataSource.getRepository(Translation);

  // Get all translations for a specific language
  getTranslations = async (req: Request, res: Response) => {
    try {
      const { language = 'en' } = req.query;
      
      if (!Object.values(SupportedLanguage).includes(language as SupportedLanguage)) {
        return res.status(400).json({ message: 'Unsupported language' });
      }

      const translations = await this.translationRepository.find({
        where: { language: language as SupportedLanguage },
        order: { category: 'ASC', key: 'ASC' }
      });

      // Convert to key-value object for frontend consumption
      const translationMap: Record<string, string> = {};
      translations.forEach(t => {
        translationMap[t.key] = t.value;
      });

      res.json({ 
        language,
        translations: translationMap,
        count: translations.length,
        version: Date.now().toString() // Simple version based on timestamp
      });
    } catch (error) {
      console.error('Error fetching translations:', error);
      res.status(500).json({ message: 'Failed to fetch translations' });
    }
  };

  // Get all translations (admin only) - for management interface
  getAllTranslations = async (req: AuthRequest, res: Response) => {
    try {
      const translations = await this.translationRepository.find({
        order: { category: 'ASC', key: 'ASC', language: 'ASC' }
      });

      // Group by key for easier management
      const grouped: Record<string, Record<string, any>> = {};
      translations.forEach(t => {
        if (!grouped[t.key]) {
          grouped[t.key] = {
            key: t.key,
            category: t.category,
            description: t.description,
            isSystem: t.isSystem,
            translations: {}
          };
        }
        grouped[t.key].translations[t.language] = {
          id: t.id,
          value: t.value,
          updatedAt: t.updatedAt
        };
      });

      res.json({ 
        translations: Object.values(grouped),
        supportedLanguages: Object.values(SupportedLanguage)
      });
    } catch (error) {
      console.error('Error fetching all translations:', error);
      res.status(500).json({ message: 'Failed to fetch translations' });
    }
  };

  // Update translation (admin only)
  updateTranslation = async (req: AuthRequest, res: Response) => {
    try {
      const { key, language, value, category, description } = req.body;

      if (!key || !language || !value) {
        return res.status(400).json({ message: 'Key, language, and value are required' });
      }

      if (!Object.values(SupportedLanguage).includes(language)) {
        return res.status(400).json({ message: 'Unsupported language' });
      }

      let translation = await this.translationRepository.findOne({
        where: { key, language }
      });

      if (translation) {
        // Update existing translation
        translation.value = value;
        if (category !== undefined) translation.category = category;
        if (description !== undefined) translation.description = description;
      } else {
        // Create new translation
        translation = this.translationRepository.create({
          key,
          language,
          value,
          category: category || null,
          description: description || null,
          isSystem: false
        });
      }

      await this.translationRepository.save(translation);

      // Send Pusher event for real-time updates
      try {
        await pusher.trigger('translations', 'translation:updated', {
          key: translation.key,
          language: translation.language,
          value: translation.value,
          action: 'updated'
        });
        console.log(`📡 Pusher event sent for translation update: ${translation.key} (${translation.language})`);
      } catch (pusherError) {
        console.error('Error sending Pusher event:', pusherError);
      }

      res.json({ 
        message: 'Translation updated successfully',
        translation 
      });
    } catch (error) {
      console.error('Error updating translation:', error);
      res.status(500).json({ message: 'Failed to update translation' });
    }
  };

  // Bulk update translations (admin only)
  bulkUpdateTranslations = async (req: AuthRequest, res: Response) => {
    try {
      const { translations } = req.body;

      if (!Array.isArray(translations)) {
        return res.status(400).json({ message: 'Translations must be an array' });
      }

      const results = [];
      
      for (const item of translations) {
        const { key, language, value, category, description } = item;
        
        if (!key || !language || value === undefined) {
          continue; // Skip invalid entries
        }

        let translation = await this.translationRepository.findOne({
          where: { key, language }
        });

        if (translation) {
          translation.value = value;
          if (category !== undefined) translation.category = category;
          if (description !== undefined) translation.description = description;
        } else {
          translation = this.translationRepository.create({
            key,
            language,
            value,
            category: category || null,
            description: description || null,
            isSystem: false
          });
        }

        await this.translationRepository.save(translation);
        results.push(translation);
      }

      // Send Pusher event for bulk update
      if (results.length > 0) {
        try {
          // Group by language for more efficient updates
          const languageGroups = results.reduce((acc, t) => {
            if (!acc[t.language]) acc[t.language] = [];
            acc[t.language].push(t);
            return acc;
          }, {} as Record<string, any[]>);

          // Send event for each language
          for (const [language, translations] of Object.entries(languageGroups)) {
            await pusher.trigger('translations', 'translations:bulk_updated', {
              language,
              count: translations.length,
              action: 'bulk_updated'
            });
          }
          
          console.log(`📡 Pusher events sent for bulk translation update: ${results.length} translations`);
        } catch (pusherError) {
          console.error('Error sending Pusher event for bulk update:', pusherError);
        }
      }

      res.json({ 
        message: `${results.length} translations updated successfully`,
        count: results.length
      });
    } catch (error) {
      console.error('Error bulk updating translations:', error);
      res.status(500).json({ message: 'Failed to bulk update translations' });
    }
  };

  // Delete translation (admin only)
  deleteTranslation = async (req: AuthRequest, res: Response) => {
    try {
      const { key, language } = req.params;

      const translation = await this.translationRepository.findOne({
        where: { key, language: language as SupportedLanguage }
      });

      if (!translation) {
        return res.status(404).json({ message: 'Translation not found' });
      }

      if (translation.isSystem) {
        return res.status(400).json({ message: 'Cannot delete system translations' });
      }

      await this.translationRepository.remove(translation);

      // Send Pusher event for deletion
      try {
        await pusher.trigger('translations', 'translation:deleted', {
          key: translation.key,
          language: translation.language,
          action: 'deleted'
        });
        console.log(`📡 Pusher event sent for translation deletion: ${translation.key} (${translation.language})`);
      } catch (pusherError) {
        console.error('Error sending Pusher event for deletion:', pusherError);
      }

      res.json({ message: 'Translation deleted successfully' });
    } catch (error) {
      console.error('Error deleting translation:', error);
      res.status(500).json({ message: 'Failed to delete translation' });
    }
  };

  // Get supported languages
  getSupportedLanguages = async (req: Request, res: Response) => {
    try {
      res.json({ 
        languages: Object.values(SupportedLanguage),
        default: SupportedLanguage.EN
      });
    } catch (error) {
      console.error('Error fetching supported languages:', error);
      res.status(500).json({ message: 'Failed to fetch supported languages' });
    }
  };

  // Reset translations to default (admin only)
  resetTranslations = async (req: AuthRequest, res: Response) => {
    try {
      // Only reset non-system translations
      await this.translationRepository.delete({ isSystem: false });

      res.json({ message: 'User translations reset successfully' });
    } catch (error) {
      console.error('Error resetting translations:', error);
      res.status(500).json({ message: 'Failed to reset translations' });
    }
  };

  // Export translations (admin only)
  exportTranslations = async (req: AuthRequest, res: Response) => {
    try {
      const { language } = req.query;
      
      let whereCondition = {};
      if (language && Object.values(SupportedLanguage).includes(language as SupportedLanguage)) {
        whereCondition = { language: language as SupportedLanguage };
      }

      const translations = await this.translationRepository.find({
        where: whereCondition,
        order: { language: 'ASC', category: 'ASC', key: 'ASC' }
      });

      res.json({ 
        translations,
        exportedAt: new Date().toISOString(),
        count: translations.length
      });
    } catch (error) {
      console.error('Error exporting translations:', error);
      res.status(500).json({ message: 'Failed to export translations' });
    }
  };
}
