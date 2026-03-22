import { Router } from 'express';
import { installedPluginController } from '../controllers/installedPluginController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Rutas para plugins instalados (requieren autenticación)
router.get('/', authenticateToken, installedPluginController.getInstalledPlugins.bind(installedPluginController));
router.get('/loaded', authenticateToken, installedPluginController.getLoadedPlugins.bind(installedPluginController));
router.get('/:id', authenticateToken, installedPluginController.getInstalledPlugin.bind(installedPluginController));
router.post('/install', authenticateToken, installedPluginController.installPlugin.bind(installedPluginController));
router.delete('/:id', authenticateToken, installedPluginController.uninstallPlugin.bind(installedPluginController));
router.patch('/:id/toggle', authenticateToken, installedPluginController.togglePlugin.bind(installedPluginController));
router.post('/:id/update', authenticateToken, installedPluginController.updatePlugin.bind(installedPluginController));
router.patch('/:id/config', authenticateToken, installedPluginController.updatePluginConfig.bind(installedPluginController));
router.post('/notify-refresh', authenticateToken, installedPluginController.notifyGlobalRefresh.bind(installedPluginController));

export { router as installedPluginRoutes };

