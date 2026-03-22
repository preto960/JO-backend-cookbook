import { Router } from 'express';
import { TenantController } from '../controllers/tenantController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { TenantResolver } from '../middleware/tenantResolver';

const router = Router();
const tenantController = new TenantController();

// Public routes (no auth required)
// None for now - tenant management is admin-only

// Protected routes (require authentication)
router.use(authenticateToken);

// Get current user's tenant info
router.get('/current', tenantController.getCurrentTenant);

// Admin-only routes
router.use(requireAdmin);

// Tenant CRUD operations
router.get('/', tenantController.getAllTenants);
router.get('/:id', tenantController.getTenant);
router.post('/', tenantController.createTenant);
router.put('/:id', tenantController.updateTenant);
router.delete('/:id', tenantController.deleteTenant);

// Tenant user management
router.get('/:id/users', tenantController.getTenantUsers);
router.post('/:id/users', tenantController.assignUserToTenant);
router.delete('/:id/users/:userId', tenantController.removeUserFromTenant);

export { router as tenantRoutes };