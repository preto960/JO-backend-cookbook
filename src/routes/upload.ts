import { Router } from 'express';
import { UploadController } from '../controllers/uploadController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();
const uploadController = new UploadController();

// All upload routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// Upload logo
router.post('/logo', uploadController.uploadLogo);

// Delete logo
router.delete('/logo', uploadController.deleteLogo);

export default router;

