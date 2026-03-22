import { Router } from 'express';
import { RoleController } from '../controllers/roleController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
 
const router = Router();
const roleController = new RoleController();
 
router.use(authenticateToken);
router.use(requireAdmin);
 
router.get('/', roleController.getAllRoles);
router.get('/stats', roleController.getRoleStats);
router.get('/:id', roleController.getRoleById);
router.post('/', roleController.createRole);
router.put('/:id', roleController.updateRole);
router.delete('/:id', roleController.deleteRole);
router.patch('/:id/toggle', roleController.toggleRoleStatus);
 
export default router;