import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { In } from 'typeorm';
import { AppDataSource } from '../config/database';
import { User, UserRole } from '../models/User';
import { Role } from '../models/Role';
import { createError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { notificationService } from '../services/notificationService';

export class UserController {
  private userRepository = AppDataSource.getRepository(User);
  private roleRepository = AppDataSource.getRepository(Role);

  // Get all users (admin only)
  getAllUsers = async (req: AuthRequest, res: Response) => {
    try {
      const { 
        role, 
        status, 
        search, 
        page = 1, 
        limit = 50,
        sortBy = 'createdAt',
        sortOrder = 'DESC'
      } = req.query;

      // Build where conditions
      const whereConditions: any = {};
      
      if (role && role !== 'all') {
        whereConditions.role = role;
      }

      if (status && status !== 'all') {
        whereConditions.isActive = status === 'active';
      }

      // Calculate pagination
      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
      const offset = (pageNum - 1) * limitNum;

      // Apply sorting
      const validSortFields = ['createdAt', 'updatedAt', 'firstName', 'lastName', 'email', 'role'];
      const sortField = validSortFields.includes(sortBy as string) ? sortBy as string : 'createdAt';
      const order = (sortOrder as string).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      // Use find with options instead of QueryBuilder to avoid SQL issues
      const findOptions: any = {
        where: whereConditions,
        order: { [sortField]: order },
        skip: offset,
        take: limitNum
      };

      // Handle search separately if needed
      if (search) {
        // For search, we need to use QueryBuilder but without select issues
        const queryBuilder = this.userRepository.createQueryBuilder('user');
        
        // Apply where conditions
        if (Object.keys(whereConditions).length > 0) {
          Object.entries(whereConditions).forEach(([key, value], index) => {
            if (index === 0) {
              queryBuilder.where(`user.${key} = :${key}`, { [key]: value });
            } else {
              queryBuilder.andWhere(`user.${key} = :${key}`, { [key]: value });
            }
          });
        }

        // Apply search filter
        const searchCondition = '(LOWER(user.firstName) LIKE LOWER(:search) OR LOWER(user.lastName) LIKE LOWER(:search) OR LOWER(user.email) LIKE LOWER(:search))';
        if (Object.keys(whereConditions).length > 0) {
          queryBuilder.andWhere(searchCondition, { search: `%${search}%` });
        } else {
          queryBuilder.where(searchCondition, { search: `%${search}%` });
        }

        // Apply sorting and pagination - DON'T use select to avoid the bug
        queryBuilder
          .orderBy(`user.${sortField}`, order)
          .skip(offset)
          .take(limitNum);

        // Execute query and manually select fields
        const [allUsers, total] = await queryBuilder.getManyAndCount();
        
        // Manually select only the fields we want
        const users = allUsers.map(user => ({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tenantId: user.tenantId, // This will come from the full entity
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          lastLoginAt: user.lastLoginAt
        }));

        // Calculate pagination info
        const totalPages = Math.ceil(total / limitNum);
        const hasNextPage = pageNum < totalPages;
        const hasPrevPage = pageNum > 1;

        return res.json({ 
          users,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages,
            hasNextPage,
            hasPrevPage
          }
        });
      }

      // For non-search queries, use the simpler find method
      const [allUsers, total] = await this.userRepository.findAndCount(findOptions);
      
      // Manually select only the fields we want to avoid password exposure
      const users = allUsers.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt
      }));

      // Calculate pagination info
      const totalPages = Math.ceil(total / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      res.json({ 
        users,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
          hasNextPage,
          hasPrevPage
        }
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };

  // Get user by ID (admin only)
  getUserById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const user = await this.userRepository.findOne({
        where: { id },
        select: ['id', 'email', 'firstName', 'lastName', 'role', 'tenantId', 'isActive', 'bio', 'website', 'github', 'twitter', 'avatar', 'createdAt', 'updatedAt', 'lastLoginAt']
      });

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({ user });
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };

  // Create new user (admin only)
  createUser = async (req: AuthRequest, res: Response) => {
    try {
      const { email, password, firstName, lastName, role = 'USER', bio, website, github, twitter, tenantId } = req.body;

      // Check if user already exists
      const existingUser = await this.userRepository.findOne({ where: { email } });
      if (existingUser) {
        return res.status(409).json({ message: 'User already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const user = this.userRepository.create({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role,
        bio,
        website,
        github,
        twitter,
        tenantId: tenantId && tenantId.trim() !== '' ? tenantId : null,
        isActive: true
      });

      await this.userRepository.save(user);

      // 📧 SEND NOTIFICATION TO OTHER ADMINS
      try {
        const adminUsers = await this.userRepository.find({ 
          where: { role: In(['ADMIN', 'DEVELOPER']) },
          select: ['id']
        });
        const adminUserIds = adminUsers.map(u => u.id);
        
        await notificationService.notifyUserCreated(
          `${firstName} ${lastName}`,
          req.user!.id,
          adminUserIds
        );
      } catch (notificationError) {
        console.error('Error sending user creation notification:', notificationError);
        // Don't fail the request if notification fails
      }

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;

      res.status(201).json({
        message: 'User created successfully',
        user: userWithoutPassword
      });
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };

  // Update user (admin only)
  updateUser = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { email, firstName, lastName, role, bio, website, github, twitter, isActive, tenantId } = req.body;

      console.log('🔍 UPDATE USER DEBUG:');
      console.log('User ID:', id);
      console.log('Request body tenantId:', tenantId);
      console.log('tenantId type:', typeof tenantId);

      // Let's check if the column exists in the database
      const queryRunner = this.userRepository.manager.connection.createQueryRunner();
      const columnCheck = await queryRunner.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'tenantId'
      `);
      console.log('🔍 tenantId column exists in DB:', columnCheck.length > 0 ? 'YES' : 'NO');
      if (columnCheck.length > 0) {
        console.log('Column info:', columnCheck[0]);
      }
      await queryRunner.release();

      const user = await this.userRepository.findOne({ where: { id } });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      console.log('Current user tenantId:', user.tenantId);
      console.log('User object keys:', Object.keys(user));
      
      // Check TypeORM metadata
      const userMetadata = this.userRepository.metadata;
      console.log('🔍 TypeORM User entity columns:');
      userMetadata.columns.forEach(column => {
        console.log(`  - ${column.propertyName} (${column.databaseName})`);
      });

      // Track changes for notifications
      const changes: string[] = [];
      const oldRole = user.role;

      // Check if email is being changed and if it already exists
      if (email && email !== user.email) {
        const existingUser = await this.userRepository.findOne({ where: { email } });
        if (existingUser) {
          return res.status(409).json({ message: 'Email already exists' });
        }
        user.email = email;
        changes.push('email');
      }

      // Update fields and track changes
      if (firstName !== undefined && firstName !== user.firstName) {
        user.firstName = firstName;
        changes.push('firstName');
      }
      if (lastName !== undefined && lastName !== user.lastName) {
        user.lastName = lastName;
        changes.push('lastName');
      }
      if (role !== undefined && role !== user.role) {
        user.role = role;
        changes.push('role');
      }
      if (bio !== undefined && bio !== user.bio) {
        user.bio = bio;
        changes.push('bio');
      }
      if (website !== undefined && website !== user.website) {
        user.website = website;
        changes.push('website');
      }
      if (github !== undefined && github !== user.github) {
        user.github = github;
        changes.push('github');
      }
      if (twitter !== undefined && twitter !== user.twitter) {
        user.twitter = twitter;
        changes.push('twitter');
      }
      if (isActive !== undefined && isActive !== user.isActive) {
        user.isActive = isActive;
        changes.push('status');
      }
      if (tenantId !== undefined && tenantId !== user.tenantId) {
        console.log('🔄 Updating tenantId from:', user.tenantId, 'to:', tenantId);
        user.tenantId = tenantId;
        changes.push('tenant');
      }

      console.log('💾 Saving user with tenantId:', user.tenantId);
      await this.userRepository.save(user);
      console.log('✅ User saved successfully');

      // 📧 SEND NOTIFICATIONS
      try {
        // Notify the affected user if changes were made by someone else
        if (changes.length > 0) {
          await notificationService.notifyUserUpdated(
            `${user.firstName} ${user.lastName}`,
            user.id,
            req.user!.id,
            changes
          );

          // If role changed, send specific role change notification
          if (role !== undefined && role !== oldRole) {
            await notificationService.notifyRoleChanged(
              user.id,
              role,
              req.user!.id
            );
          }
        }
      } catch (notificationError) {
        console.error('Error sending user update notification:', notificationError);
        // Don't fail the request if notification fails
      }

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;

      res.json({
        message: 'User updated successfully',
        user: userWithoutPassword
      });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };

  // Update user password (admin only)
  updateUserPassword = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { password } = req.body;

      if (!password || password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }

      const user = await this.userRepository.findOne({ where: { id } });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(password, 12);
      user.password = hashedPassword;

      await this.userRepository.save(user);

      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Error updating password:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };

  // Delete user (admin only)
  deleteUser = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const user = await this.userRepository.findOne({ 
        where: { id }
      });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Don't allow deleting the last admin
      if (user.role === 'ADMIN') {
        const adminCount = await this.userRepository.count({ where: { role: 'ADMIN' } });
        if (adminCount <= 1) {
          return res.status(400).json({ message: 'Cannot delete the last admin user' });
        }
      }

      const deletedUserName = `${user.firstName} ${user.lastName}`;
      await this.userRepository.remove(user);

      // 📧 SEND NOTIFICATION TO OTHER ADMINS
      try {
        const adminUsers = await this.userRepository.find({ 
          where: { role: In(['ADMIN', 'DEVELOPER']) },
          select: ['id']
        });
        const adminUserIds = adminUsers.map(u => u.id);
        
        await notificationService.notifyUserDeleted(
          deletedUserName,
          req.user!.id,
          adminUserIds
        );
      } catch (notificationError) {
        console.error('Error sending user deletion notification:', notificationError);
        // Don't fail the request if notification fails
      }

      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };

  // Bulk delete users (admin only)
  bulkDeleteUsers = async (req: Request, res: Response) => {
    try {
      const { userIds } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ message: 'User IDs array is required' });
      }

      // Find users to delete
      const usersToDelete = await this.userRepository.findByIds(userIds);
      
      if (usersToDelete.length === 0) {
        return res.status(404).json({ message: 'No users found to delete' });
      }

      // Check if we're trying to delete all admins
      const adminUsersToDelete = usersToDelete.filter(user => user.role === 'ADMIN');
      if (adminUsersToDelete.length > 0) {
        const totalAdminCount = await this.userRepository.count({ where: { role: 'ADMIN' } });
        if (totalAdminCount <= adminUsersToDelete.length) {
          return res.status(400).json({ message: 'Cannot delete all admin users' });
        }
      }

      // Delete users
      await this.userRepository.remove(usersToDelete);

      res.json({ 
        message: `${usersToDelete.length} user${usersToDelete.length === 1 ? '' : 's'} deleted successfully`,
        deletedCount: usersToDelete.length
      });
    } catch (error) {
      console.error('Error bulk deleting users:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };

  // Toggle user status (admin only)
  toggleUserStatus = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const user = await this.userRepository.findOne({ where: { id } });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Don't allow deactivating the last admin
      if (user.role === 'ADMIN' && user.isActive) {
        const activeAdminCount = await this.userRepository.count({ 
          where: { role: 'ADMIN', isActive: true } 
        });
        if (activeAdminCount <= 1) {
          return res.status(400).json({ message: 'Cannot deactivate the last active admin user' });
        }
      }

      user.isActive = !user.isActive;
      await this.userRepository.save(user);

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;

      res.json({
        message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
        user: userWithoutPassword
      });
    } catch (error) {
      console.error('Error toggling user status:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };

  // Get available roles for user creation/editing
  getAvailableRoles = async (req: AuthRequest, res: Response) => {
    try {
      const roles = await this.roleRepository.find({
        where: { isActive: true },
        select: ['id', 'name', 'displayName', 'description', 'isSystem'],
        order: { isSystem: 'DESC', name: 'ASC' }
      });

      res.json({ roles });
    } catch (error) {
      console.error('Error fetching available roles:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };
}
