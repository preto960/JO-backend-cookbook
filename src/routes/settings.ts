import { Router } from 'express';
import { SettingController } from '../controllers/settingController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();
const settingController = new SettingController();

// Public route - no auth required
router.get('/public', settingController.getPublicSettings);

// Routes accessible by all authenticated users (read-only)
router.get('/', authenticateToken, settingController.getAllSettings);
router.get('/category/:category', authenticateToken, settingController.getSettingsByCategory);
router.get('/:key', authenticateToken, settingController.getSetting);

// Admin-only routes (write operations)
router.put('/', authenticateToken, requireAdmin, settingController.updateSetting);
router.put('/bulk', authenticateToken, requireAdmin, settingController.bulkUpdateSettings);
router.post('/reset', authenticateToken, requireAdmin, settingController.resetSettings);

export default router;

