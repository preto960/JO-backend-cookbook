import { Router } from 'express';
import { installedPluginController } from '../controllers/installedPluginController';

const router = Router();

// Rutas públicas para explorar el marketplace (proxy a Publisher)
router.get('/plugins', installedPluginController.getMarketPlugins.bind(installedPluginController));
router.get('/plugins/:id', installedPluginController.getMarketPlugin.bind(installedPluginController));

export { router as marketRoutes };

