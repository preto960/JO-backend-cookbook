import { Router } from 'express';
import { PermissionController } from '../controllers/permissionController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();
const permissionController = new PermissionController();

// All permission routes require authentication
router.use(authenticateToken);

// Routes accessible by all authenticated users
router.get('/my-permissions', permissionController.getMyPermissions);
router.get('/check', permissionController.checkPermission);

// Admin-only routes - Base System Permissions
router.get('/', requireAdmin, permissionController.getAllPermissions);
router.get('/base', requireAdmin, permissionController.getBasePermissions);
router.get('/role/:role', requireAdmin, permissionController.getPermissionsByRole);
router.put('/', requireAdmin, permissionController.updatePermission);
router.put('/bulk', requireAdmin, permissionController.bulkUpdatePermissions);
router.post('/reset', requireAdmin, permissionController.resetPermissions);

// Admin-only routes - Plugin Permissions
router.get('/plugins', requireAdmin, permissionController.getPluginPermissions);
router.get('/plugins/grouped', requireAdmin, permissionController.getPermissionsGrouped);
router.get('/plugin/:pluginId', requireAdmin, permissionController.getPermissionsByPlugin);
router.put('/plugin', requireAdmin, permissionController.updatePluginPermission);
router.put('/plugin/bulk', requireAdmin, permissionController.bulkUpdatePluginPermissions);

export default router;

