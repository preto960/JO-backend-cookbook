import { Router } from 'express';
import { body } from 'express-validator';
import { UserController } from '../controllers/userController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
 
const router = Router();
const userController = new UserController();
 
const createUserValidation = [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('role').optional().isString().withMessage('Role must be a string'),
];
 
const updateUserValidation = [
  body('email').optional().isEmail().withMessage('Valid email required'),
  body('firstName').optional().notEmpty().withMessage('First name cannot be empty'),
  body('lastName').optional().notEmpty().withMessage('Last name cannot be empty'),
  body('role').optional().isString().withMessage('Role must be a string'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
];
 
const updatePasswordValidation = [
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];
 
router.use(authenticateToken);
router.use(requireAdmin);
 
router.get('/', userController.getAllUsers);
router.get('/roles', userController.getAvailableRoles);
router.get('/:id', userController.getUserById);
router.post('/', createUserValidation, userController.createUser);
router.post('/bulk-delete', userController.bulkDeleteUsers);
router.put('/:id', updateUserValidation, userController.updateUser);
router.put('/:id/password', updatePasswordValidation, userController.updateUserPassword);
router.patch('/:id/toggle-status', userController.toggleUserStatus);
router.delete('/:id', userController.deleteUser);
 
export { router as userRoutes };