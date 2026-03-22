import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { User, UserRole } from '../models/User';
import { Setting, SettingCategory } from '../models/Setting';
import { Tenant } from '../models/Tenant';
import { createError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { notificationService } from '../services/notificationService';

export class AuthController {
  private userRepository = AppDataSource.getRepository(User);
  private settingRepository = AppDataSource.getRepository(Setting);
  private tenantRepository = AppDataSource.getRepository(Tenant);

  register = async (req: Request, res: Response) => {
    try {
      const { email, password, firstName, lastName, role = 'USER' } = req.body;

      // Get tenant context
      const tenantId = req.tenantId;
      
      // Check if user already exists in this tenant
      const whereCondition = req.isMultiTenantMode 
        ? { email, tenantId }
        : { email };
      
      const existingUser = await this.userRepository.findOne({ where: whereCondition });
      if (existingUser) {
        throw createError('User already exists', 409);
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
        tenantId
      });

      await this.userRepository.save(user);

      // Generate tokens
      const accessToken = await this.generateAccessToken(user.id, user.tenantId || undefined);
      const refreshToken = await this.generateRefreshToken(user.id, user.tenantId || undefined);

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;

      res.status(201).json({
        message: 'User created successfully',
        user: userWithoutPassword,
        accessToken,
        refreshToken
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(500).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  };

  login = async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      // Find user with tenant context
      const whereCondition = req.isMultiTenantMode 
        ? { email, tenantId: req.tenantId, isActive: true }
        : { email, isActive: true };

      const user = await this.userRepository.findOne({ 
        where: whereCondition
        // relations: ['tenant'] // Commented out until relations are restored
      });
      if (!user) {
        throw createError('Invalid credentials', 401);
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw createError('Invalid credentials', 401);
      }

      // Update last login
      user.lastLoginAt = new Date();
      await this.userRepository.save(user);

      // 📧 SEND LOGIN NOTIFICATION (optional - you can enable/disable this)
      try {
        const userAgent = req.get('User-Agent') || 'Unknown Device';
        const ip = req.ip || req.connection.remoteAddress || 'Unknown IP';
        
        // Extract basic device info
        const device = userAgent.includes('Mobile') ? 'Mobile Device' : 
                     userAgent.includes('Chrome') ? 'Chrome Browser' :
                     userAgent.includes('Firefox') ? 'Firefox Browser' :
                     userAgent.includes('Safari') ? 'Safari Browser' : 'Unknown Browser';
        
        // You can implement IP geolocation here if needed
        const location = 'Unknown Location'; // For now, you'd need a geolocation service
        
        await notificationService.notifyNewLogin(
          user.id,
          location,
          device,
          ip
        );
      } catch (notificationError) {
        console.error('Error sending login notification:', notificationError);
        // Don't fail login if notification fails
      }

      // Generate tokens
      const accessToken = await this.generateAccessToken(user.id, user.tenantId || undefined);
      const refreshToken = await this.generateRefreshToken(user.id, user.tenantId || undefined);

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;

      res.json({
        message: 'Login successful',
        user: userWithoutPassword,
        accessToken,
        refreshToken
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(error.message.includes('Invalid') ? 401 : 500).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  };

  refreshToken = async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        throw createError('Refresh token required', 401);
      }

      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { userId: string; tenantId?: string };
      
      const whereCondition = req.isMultiTenantMode 
        ? { id: decoded.userId, tenantId: decoded.tenantId, isActive: true }
        : { id: decoded.userId, isActive: true };

      const user = await this.userRepository.findOne({ where: whereCondition });
      if (!user) {
        throw createError('Invalid refresh token', 401);
      }

      const accessToken = await this.generateAccessToken(user.id, user.tenantId || undefined);
      const newRefreshToken = await this.generateRefreshToken(user.id, user.tenantId || undefined);

      res.json({
        accessToken,
        refreshToken: newRefreshToken
      });
    } catch (error) {
      res.status(401).json({ message: 'Invalid refresh token' });
    }
  };

  getProfile = async (req: AuthRequest, res: Response) => {
    try {
      const { password: _, ...userWithoutPassword } = req.user!;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  };

  updateProfile = async (req: AuthRequest, res: Response) => {
    try {
      const { firstName, lastName, bio, website, github, twitter, avatar } = req.body;
      
      const user = req.user!;
      user.firstName = firstName || user.firstName;
      user.lastName = lastName || user.lastName;
      user.bio = bio || user.bio;
      user.website = website || user.website;
      user.github = github || user.github;
      user.twitter = twitter || user.twitter;
      user.avatar = avatar || user.avatar;

      await this.userRepository.save(user);

      const { password: _, ...userWithoutPassword } = user;
      res.json({
        message: 'Profile updated successfully',
        user: userWithoutPassword
      });
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  };

  // Temporary endpoint to test session timeout configuration
  testSessionTimeout = async (req: AuthRequest, res: Response) => {
    try {
      const sessionTimeoutSetting = await this.settingRepository.findOne({
        where: { key: 'sessionTimeout', category: SettingCategory.SECURITY }
      });
      
      const sessionTimeoutMinutes = sessionTimeoutSetting ? parseInt(sessionTimeoutSetting.value) : 30;
      const sessionTimeoutHours = sessionTimeoutMinutes / 60;
      
      // Generate a test token to show the actual expiration
      const testToken = await this.generateAccessToken(req.user!.id, req.user!.tenantId || undefined);
      
      res.json({
        message: 'Session timeout configuration',
        sessionTimeoutMinutes,
        sessionTimeoutHours,
        settingValue: sessionTimeoutSetting?.value || 'not found',
        testTokenGenerated: true,
        note: 'The access token has been generated with the configured timeout'
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Internal server error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  };

  private async generateAccessToken(userId: string, tenantId?: string): Promise<string> {
    // Get session timeout from settings
    const sessionTimeoutSetting = await this.settingRepository.findOne({
      where: { key: 'sessionTimeout', category: SettingCategory.SECURITY }
    });
    
    const sessionTimeoutMinutes = sessionTimeoutSetting ? parseInt(sessionTimeoutSetting.value) : 30;
    const expiresIn = `${sessionTimeoutMinutes}m`;
    
    // Check if multi-tenancy is enabled
    const multiTenancySetting = await this.settingRepository.findOne({
      where: { key: 'multiTenancyEnabled', category: SettingCategory.ADVANCED }
    });
    
    const isMultiTenant = multiTenancySetting?.value === 'true';
    
    const payload = isMultiTenant && tenantId 
      ? { userId, tenantId }
      : { userId };
    
    const options: SignOptions = { expiresIn: expiresIn as any };
    return jwt.sign(
      payload,
      process.env.JWT_SECRET!,
      options
    );
  }

  private async generateRefreshToken(userId: string, tenantId?: string): Promise<string> {
    // Refresh token should be longer than access token
    // Use 7 days or 4x the session timeout, whichever is longer
    const sessionTimeoutSetting = await this.settingRepository.findOne({
      where: { key: 'sessionTimeout', category: SettingCategory.SECURITY }
    });
    
    const sessionTimeoutMinutes = sessionTimeoutSetting ? parseInt(sessionTimeoutSetting.value) : 30;
    const refreshTimeoutMinutes = Math.max(sessionTimeoutMinutes * 4, 7 * 24 * 60); // 4x session timeout or 7 days minimum
    const expiresIn = `${refreshTimeoutMinutes}m`;
    
    // Check if multi-tenancy is enabled
    const multiTenancySetting = await this.settingRepository.findOne({
      where: { key: 'multiTenancyEnabled', category: SettingCategory.ADVANCED }
    });
    
    const isMultiTenant = multiTenancySetting?.value === 'true';
    
    const payload = isMultiTenant && tenantId 
      ? { userId, tenantId }
      : { userId };
    
    const options: SignOptions = { expiresIn: expiresIn as any };
    return jwt.sign(
      payload,
      process.env.JWT_REFRESH_SECRET!,
      options
    );
  }
}