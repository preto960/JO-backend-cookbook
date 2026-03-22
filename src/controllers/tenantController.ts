import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Tenant } from '../models/Tenant';
import { User } from '../models/User';
import { createError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { TenantResolver } from '../middleware/tenantResolver';

export class TenantController {
  private tenantRepository = AppDataSource.getRepository(Tenant);
  private userRepository = AppDataSource.getRepository(User);

  // Get all tenants (Admin only)
  getAllTenants = async (req: AuthRequest, res: Response) => {
    try {
      // Use raw query as fallback if repository fails
      const query = `
        SELECT 
          t.*,
          COALESCE(u.user_count, 0) as "userCount"
        FROM tenants t
        LEFT JOIN (
          SELECT "tenantId", COUNT(*) as user_count 
          FROM users 
          WHERE "tenantId" IS NOT NULL 
          GROUP BY "tenantId"
        ) u ON t.id = u."tenantId"
        ORDER BY t."createdAt" DESC
      `;
      
      const tenants = await AppDataSource.query(query);
      
      res.json({ tenants });
    } catch (error) {
      console.error('Error fetching tenants:', error);
      res.status(500).json({ message: 'Failed to fetch tenants' });
    }
  };

  // Get single tenant
  getTenant = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Use raw query as fallback
      const query = `
        SELECT 
          t.*,
          COALESCE(u.user_count, 0) as "userCount"
        FROM tenants t
        LEFT JOIN (
          SELECT "tenantId", COUNT(*) as user_count 
          FROM users 
          WHERE "tenantId" = $1
          GROUP BY "tenantId"
        ) u ON t.id = u."tenantId"
        WHERE t.id = $1
      `;
      
      const result = await AppDataSource.query(query, [id]);
      
      if (!result || result.length === 0) {
        throw createError('Tenant not found', 404);
      }

      res.json({ tenant: result[0] });
    } catch (error) {
      if (error instanceof Error) {
        res.status(error.message.includes('not found') ? 404 : 500).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  };

  // Create new tenant
  createTenant = async (req: AuthRequest, res: Response) => {
    try {
      const { slug, name, domain, description, features } = req.body;

      // Validate required fields
      if (!slug || !name) {
        throw createError('Slug and name are required', 400);
      }

      // Check if slug already exists using raw query
      const existingSlug = await AppDataSource.query(
        'SELECT id FROM tenants WHERE slug = $1 LIMIT 1',
        [slug]
      );
      if (existingSlug.length > 0) {
        throw createError('Tenant with this slug already exists', 409);
      }

      // Check if domain already exists (if provided)
      if (domain) {
        const existingDomain = await AppDataSource.query(
          'SELECT id FROM tenants WHERE domain = $1 LIMIT 1',
          [domain]
        );
        if (existingDomain.length > 0) {
          throw createError('Tenant with this domain already exists', 409);
        }
      }

      // Create tenant using raw query
      const insertQuery = `
        INSERT INTO tenants (id, slug, name, domain, description, features, "isActive", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING *
      `;
      
      const result = await AppDataSource.query(insertQuery, [
        slug,
        name,
        domain || null,
        description || null,
        JSON.stringify(features || []),
        true
      ]);

      res.status(201).json({
        message: 'Tenant created successfully',
        tenant: result[0]
      });
    } catch (error) {
      if (error instanceof Error) {
        const statusCode = error.message.includes('required') ? 400 :
                          error.message.includes('already exists') ? 409 : 500;
        res.status(statusCode).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  };

  // Update tenant
  updateTenant = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { slug, name, domain, description, features, isActive, settings } = req.body;

      const tenant = await this.tenantRepository.findOne({ where: { id } });
      if (!tenant) {
        throw createError('Tenant not found', 404);
      }

      // Check if new slug conflicts (if changed)
      if (slug && slug !== tenant.slug) {
        const existingTenant = await this.tenantRepository.findOne({ where: { slug } });
        if (existingTenant) {
          throw createError('Tenant with this slug already exists', 409);
        }
        tenant.slug = slug;
      }

      // Check if new domain conflicts (if changed)
      if (domain && domain !== tenant.domain) {
        const existingDomain = await this.tenantRepository.findOne({ where: { domain } });
        if (existingDomain) {
          throw createError('Tenant with this domain already exists', 409);
        }
        tenant.domain = domain;
      }

      // Update fields
      if (name) tenant.name = name;
      if (description !== undefined) tenant.description = description;
      if (features) tenant.features = features;
      if (isActive !== undefined) tenant.isActive = isActive;
      if (settings) tenant.settings = { ...tenant.settings, ...settings };

      await this.tenantRepository.save(tenant);

      // Clear tenant resolver cache
      TenantResolver.clearCache();

      res.json({
        message: 'Tenant updated successfully',
        tenant
      });
    } catch (error) {
      if (error instanceof Error) {
        const statusCode = error.message.includes('not found') ? 404 :
                          error.message.includes('already exists') ? 409 : 500;
        res.status(statusCode).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  };

  // Delete tenant
  deleteTenant = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const tenant = await this.tenantRepository.findOne({ 
        where: { id }
      });

      if (!tenant) {
        throw createError('Tenant not found', 404);
      }

      // Prevent deletion of default tenant
      if (tenant.slug === 'default') {
        throw createError('Cannot delete default tenant', 403);
      }

      // Check if tenant has users using raw query
      const userCountResult = await AppDataSource.query(
        'SELECT COUNT(*) as count FROM users WHERE "tenantId" = $1',
        [tenant.id]
      );
      const userCount = parseInt(userCountResult[0].count);

      if (userCount > 0) {
        throw createError('Cannot delete tenant with existing users. Please reassign users first.', 400);
      }

      await this.tenantRepository.remove(tenant);

      // Clear tenant resolver cache
      TenantResolver.clearCache();

      res.json({ message: 'Tenant deleted successfully' });
    } catch (error) {
      if (error instanceof Error) {
        const statusCode = error.message.includes('not found') ? 404 :
                          error.message.includes('Cannot delete') ? 403 :
                          error.message.includes('existing users') ? 400 : 500;
        res.status(statusCode).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  };

  // Get tenant users
  getTenantUsers = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const tenant = await this.tenantRepository.findOne({ where: { id } });
      if (!tenant) {
        throw createError('Tenant not found', 404);
      }

      // Use raw query for getting tenant users
      const users = await AppDataSource.query(`
        SELECT id, email, "firstName", "lastName", role, "isActive", "createdAt", "lastLoginAt"
        FROM users 
        WHERE "tenantId" = $1
      `, [id]);

      res.json({ users });
    } catch (error) {
      if (error instanceof Error) {
        res.status(error.message.includes('not found') ? 404 : 500).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  };

  // Assign user to tenant
  assignUserToTenant = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params; // tenant id
      const { userId } = req.body;

      const tenant = await this.tenantRepository.findOne({ where: { id } });
      if (!tenant) {
        throw createError('Tenant not found', 404);
      }

      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw createError('User not found', 404);
      }

      // Update user tenant using raw query
      await AppDataSource.query(
        'UPDATE users SET "tenantId" = $1 WHERE id = $2',
        [tenant.id, user.id]
      );

      res.json({ 
        message: 'User assigned to tenant successfully',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          tenantId: tenant.id
        }
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(error.message.includes('not found') ? 404 : 500).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  };

  // Remove user from tenant
  removeUserFromTenant = async (req: AuthRequest, res: Response) => {
    try {
      const { id, userId } = req.params;

      const tenant = await this.tenantRepository.findOne({ where: { id } });
      if (!tenant) {
        throw createError('Tenant not found', 404);
      }

      // Check if user exists in this tenant using raw query
      const userResult = await AppDataSource.query(
        'SELECT id FROM users WHERE id = $1 AND "tenantId" = $2',
        [userId, id]
      );
      
      if (userResult.length === 0) {
        throw createError('User not found in this tenant', 404);
      }

      // Assign to default tenant instead of removing completely
      const defaultTenantResult = await AppDataSource.query(
        'SELECT id FROM tenants WHERE slug = $1',
        ['default']
      );
      
      const defaultTenantId = defaultTenantResult[0]?.id || null;
      
      await AppDataSource.query(
        'UPDATE users SET "tenantId" = $1 WHERE id = $2',
        [defaultTenantId, userId]
      );

      res.json({ message: 'User removed from tenant successfully' });
    } catch (error) {
      if (error instanceof Error) {
        res.status(error.message.includes('not found') ? 404 : 500).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  };

  // Get current tenant info (for authenticated users)
  getCurrentTenant = async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      if (!user.tenantId) {
        return res.json({ tenant: null });
      }

      // Get tenant using raw query
      const tenantResult = await AppDataSource.query(`
        SELECT id, slug, name, domain, description, "isActive", features
        FROM tenants 
        WHERE id = $1
      `, [user.tenantId]);
      
      const tenant = tenantResult[0] || null;

      res.json({ tenant });
    } catch (error) {
      console.error('Error fetching current tenant:', error);
      res.status(500).json({ message: 'Failed to fetch tenant information' });
    }
  };
}