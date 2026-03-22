import { Router } from 'express';
import { DashboardController } from '../controllers/dashboardController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();
const dashboardController = new DashboardController();

// Get dashboard configuration (cards + blocks) - accessible by all authenticated users
router.get('/config', authenticateToken, dashboardController.getDashboardConfig);

// CARDS ROUTES
// Get all cards - accessible by all authenticated users
router.get('/cards', authenticateToken, dashboardController.getAllCards);

// Admin-only card management routes
router.post('/cards', authenticateToken, requireAdmin, dashboardController.createCard);
router.put('/cards/:id', authenticateToken, requireAdmin, dashboardController.updateCard);
router.delete('/cards/:id', authenticateToken, requireAdmin, dashboardController.deleteCard);
router.put('/cards/reorder', authenticateToken, requireAdmin, dashboardController.reorderCards);

// BLOCKS ROUTES
// Get all blocks - accessible by all authenticated users
router.get('/blocks', authenticateToken, dashboardController.getAllBlocks);

// Admin-only block management routes
router.post('/blocks', authenticateToken, requireAdmin, dashboardController.createBlock);
router.put('/blocks/:id', authenticateToken, requireAdmin, dashboardController.updateBlock);
router.delete('/blocks/:id', authenticateToken, requireAdmin, dashboardController.deleteBlock);
router.put('/blocks/reorder', authenticateToken, requireAdmin, dashboardController.reorderBlocks);

export default router;









