import { Router } from 'express';
import { ExternalApiController } from '../controllers/externalApiController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();
const externalApiController = new ExternalApiController();

// Ruta especial para plugins (sin autenticación)
router.get('/connections', externalApiController.getConnectionsForPlugins);

// Todas las demás rutas requieren autenticación y permisos de admin
router.use(authenticateToken);
router.use(requireAdmin);

// Rutas para gestión de conexiones API externas
router.get('/', externalApiController.getAllConnections);
router.get('/stats', externalApiController.getConnectionStats);
router.get('/:id', externalApiController.getConnection);
router.post('/', externalApiController.createConnection);
router.put('/:id', externalApiController.updateConnection);
router.delete('/:id', externalApiController.deleteConnection);
router.post('/:id/test', externalApiController.testConnection);
router.post('/:id/toggle', externalApiController.toggleConnection);
router.post('/:id/reload', externalApiController.reloadConnection);

export default router;