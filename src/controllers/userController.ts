import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { AppDataSource } from '../config/database';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { AuthRequest } from '../middleware/auth';

export class UserController {
  private userRepository = AppDataSource.getRepository(User);
  private roleRepository = AppDataSource.getRepository(Role);

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

      const whereConditions: any = {};

      if (role && role !== 'all') {
        whereConditions.role = role;
      }

      if (status && status !== 'all') {
        whereConditions.isActive = status === 'active';
      }

      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
      const offset = (pageNum - 1) * limitNum;

      const validSortFields = ['createdAt', 'updatedAt', 'firstName', 'lastName', 'email', 'role'];
      const sortField = validSortFields.includes(sortBy as string) ? sortBy as string : 'createdAt';
      const order = (sortOrder as string).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      if (search) {
        const queryBuilder = this.userRepository.createQueryBuilder('user');

        if (Object.keys(whereConditions).length > 0) {
          Object.entries(whereConditions).forEach(([key, value], index) => {
            if (index === 0) {
              queryBuilder.where(`user.${key} = :${key}`, { [key]: value });
            } else {
              queryBuilder.andWhere(`user.${key} = :${key}`, { [key]: value });
            }
          });
        }

        const searchCondition = '(LOWER(user.firstName) LIKE LOWER(:search) OR LOWER(user.lastName) LIKE LOWER(:search) OR LOWER(user.email) LIKE LOWER(:search))';
        if (Object.keys(whereConditions).length > 0) {
          queryBuilder.andWhere(searchCondition, { search: `%${search}%` });
        } else {
          queryBuilder.where(searchCondition, { search: `%${search}%` });
        }

        queryBuilder.orderBy(`user.${sortField}`, order).skip(offset).take(limitNum);

        const [allUsers, total] = await queryBuilder.getManyAndCount();

        const users = allUsers.map(user => ({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          lastLoginAt: user.lastLoginAt
        }));

        const totalPages = Math.ceil(total / limitNum);

        return res.json({
          users,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages,
            hasNextPage: pageNum < totalPages,
            hasPrevPage: pageNum > 1
          }
        });
      }

      const [allUsers, total] = await this.userRepository.findAndCount({
        where: whereConditions,
        order: { [sortField]: order },
        skip: offset,
        take: limitNum
      });

      const users = allUsers.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt
      }));

      const totalPages = Math.ceil(total / limitNum);

      res.json({
        users,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1
        }
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };

  getUserById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const user = await this.userRepository.findOne({
        where: { id },
        select: ['id', 'email', 'firstName', 'lastName', 'role', 'isActive', 'bio', 'website', 'github', 'twitter', 'avatar', 'createdAt', 'updatedAt', 'lastLoginAt']
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

  createUser = async (req: AuthRequest, res: Response) => {
    try {
      const { email, password, firstName, lastName, role = 'USER', bio, website, github, twitter } = req.body;

      const existingUser = await this.userRepository.findOne({ where: { email } });
      if (existingUser) {
        return res.status(409).json({ message: 'User already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

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
        isActive: true
      });

      await this.userRepository.save(user);

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

  updateUser = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { email, firstName, lastName, role, bio, website, github, twitter, isActive } = req.body;

      const user = await this.userRepository.findOne({ where: { id } });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (email && email !== user.email) {
        const existingUser = await this.userRepository.findOne({ where: { email } });
        if (existingUser) {
          return res.status(409).json({ message: 'Email already exists' });
        }
        user.email = email;
      }

      if (firstName !== undefined) user.firstName = firstName;
      if (lastName !== undefined) user.lastName = lastName;
      if (role !== undefined) user.role = role;
      if (bio !== undefined) user.bio = bio;
      if (website !== undefined) user.website = website;
      if (github !== undefined) user.github = github;
      if (twitter !== undefined) user.twitter = twitter;
      if (isActive !== undefined) user.isActive = isActive;

      await this.userRepository.save(user);

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

      user.password = await bcrypt.hash(password, 12);
      await this.userRepository.save(user);

      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Error updating password:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };

  deleteUser = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const user = await this.userRepository.findOne({ where: { id } });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (user.role === 'ADMIN') {
        const adminCount = await this.userRepository.count({ where: { role: 'ADMIN' } });
        if (adminCount <= 1) {
          return res.status(400).json({ message: 'Cannot delete the last admin user' });
        }
      }

      await this.userRepository.remove(user);

      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };

  bulkDeleteUsers = async (req: Request, res: Response) => {
    try {
      const { userIds } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ message: 'User IDs array is required' });
      }

      const usersToDelete = await this.userRepository.findByIds(userIds);

      if (usersToDelete.length === 0) {
        return res.status(404).json({ message: 'No users found to delete' });
      }

      const adminUsersToDelete = usersToDelete.filter(user => user.role === 'ADMIN');
      if (adminUsersToDelete.length > 0) {
        const totalAdminCount = await this.userRepository.count({ where: { role: 'ADMIN' } });
        if (totalAdminCount <= adminUsersToDelete.length) {
          return res.status(400).json({ message: 'Cannot delete all admin users' });
        }
      }

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

  toggleUserStatus = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const user = await this.userRepository.findOne({ where: { id } });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

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
