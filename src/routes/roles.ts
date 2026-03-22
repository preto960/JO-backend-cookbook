import { Router } from 'express';
import { RoleController } from '../controllers/roleController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();
const roleController = new RoleController();

// Todas las rutas requieren autenticación y permisos de admin
router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/roles - Obtener todos los roles
router.get('/', roleController.getAllRoles);

// GET /api/roles/stats - Obtener estadísticas de roles
router.get('/stats', roleController.getRoleStats);

// GET /api/roles/:id - Obtener rol por ID
router.get('/:id', roleController.getRoleById);

// POST /api/roles - Crear nuevo rol
router.post('/', roleController.createRole);

// PUT /api/roles/:id - Actualizar rol
router.put('/:id', roleController.updateRole);

// DELETE /api/roles/:id - Eliminar rol
router.delete('/:id', roleController.deleteRole);

// PATCH /api/roles/:id/toggle - Activar/Desactivar rol (solo roles personalizados)
router.patch('/:id/toggle', roleController.toggleRoleStatus);

export default router;

