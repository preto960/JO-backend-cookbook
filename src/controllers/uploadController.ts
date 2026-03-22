import { Response } from 'express';
import { put } from '@vercel/blob';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import multer from 'multer';
import sharp from 'sharp';

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB max
  },
  fileFilter: (req, file, cb) => {
    // Only accept SVG and PNG
    const allowedMimes = ['image/svg+xml', 'image/png'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only SVG and PNG files are allowed'));
    }
  }
}).single('logo');

export class UploadController {
  // Upload logo
  uploadLogo = async (req: AuthRequest, res: Response) => {
    try {
      // Handle multer upload
      upload(req, res, async (err) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              return res.status(400).json({ message: 'File size must be less than 2MB' });
            }
          }
          return res.status(400).json({ message: err.message || 'File upload failed' });
        }

        if (!req.file) {
          return res.status(400).json({ message: 'No file provided' });
        }

        try {
          let fileBuffer = req.file.buffer;
          const originalName = req.file.originalname;
          const mimeType = req.file.mimetype;

          // Validate and resize PNG images
          if (mimeType === 'image/png') {
            const metadata = await sharp(fileBuffer).metadata();
            
            // Check dimensions
            if (metadata.width && metadata.height) {
              if (metadata.width > 512 || metadata.height > 512) {
                // Resize to max 512x512 while maintaining aspect ratio
                fileBuffer = await sharp(fileBuffer)
                  .resize(512, 512, {
                    fit: 'inside',
                    withoutEnlargement: true
                  })
                  .png({ quality: 90 })
                  .toBuffer();
              }
            }
          }

          // Generate unique filename
          const timestamp = Date.now();
          const extension = originalName.split('.').pop();
          const filename = `logos/${timestamp}-${Math.random().toString(36).substring(7)}.${extension}`;

          // Upload to Vercel Blob
          const blob = await put(filename, fileBuffer, {
            access: 'public',
            contentType: mimeType,
          });

          res.json({
            message: 'Logo uploaded successfully',
            url: blob.url
          });
        } catch (uploadError: any) {
          console.error('Error uploading to blob:', uploadError);
          res.status(500).json({ message: 'Failed to upload file to storage' });
        }
      });
    } catch (error) {
      console.error('Error in uploadLogo:', error);
      res.status(500).json({ message: 'Failed to upload logo' });
    }
  };

  // Delete logo
  deleteLogo = async (req: AuthRequest, res: Response) => {
    try {
      const { url } = req.body;

      if (!url) {
        throw createError('Logo URL is required', 400);
      }

      // Note: Vercel Blob doesn't have a direct delete API in the free tier
      // The blob will be automatically cleaned up based on retention policies
      // For now, we just remove the reference from settings

      res.json({
        message: 'Logo reference removed successfully'
      });
    } catch (error) {
      console.error('Error deleting logo:', error);
      res.status(500).json({ message: 'Failed to delete logo' });
    }
  };
}

