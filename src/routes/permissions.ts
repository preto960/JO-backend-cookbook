import { Router } from 'express';
import { PermissionController } from '../controllers/permissionController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();
const permissionController = new PermissionController();

router.use(authenticateToken);

router.get('/my-permissions', permissionController.getMyPermissions);
router.get('/check', permissionController.checkPermission);

router.get('/', requireAdmin, permissionController.getAllPermissions);
router.get('/role/:role', requireAdmin, permissionController.getPermissionsByRole);
router.put('/', requireAdmin, permissionController.updatePermission);
router.put('/bulk', requireAdmin, permissionController.bulkUpdatePermissions);
router.post('/reset', requireAdmin, permissionController.resetPermissions);

export default router;
