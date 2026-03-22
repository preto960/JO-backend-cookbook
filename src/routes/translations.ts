import { Router } from 'express';
import { body } from 'express-validator';
import { TranslationController } from '../controllers/translationController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();
const translationController = new TranslationController();

// Public routes
router.get('/languages', translationController.getSupportedLanguages);
router.get('/', translationController.getTranslations); // Get translations for specific language

// Admin-only routes
router.get('/all', authenticateToken, requireAdmin, translationController.getAllTranslations);
router.get('/export', authenticateToken, requireAdmin, translationController.exportTranslations);

router.put('/', 
  authenticateToken, 
  requireAdmin,
  [
    body('key').notEmpty().withMessage('Translation key is required'),
    body('language').isIn(['en', 'es']).withMessage('Language must be en or es'),
    body('value').notEmpty().withMessage('Translation value is required')
  ],
  translationController.updateTranslation
);

router.put('/bulk', 
  authenticateToken, 
  requireAdmin,
  [
    body('translations').isArray().withMessage('Translations must be an array')
  ],
  translationController.bulkUpdateTranslations
);

router.delete('/:key/:language', 
  authenticateToken, 
  requireAdmin, 
  translationController.deleteTranslation
);

router.post('/reset', 
  authenticateToken, 
  requireAdmin, 
  translationController.resetTranslations
);

export default router;
