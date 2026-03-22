import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { User } from '../models/User';
import { Setting, SettingCategory } from '../models/Setting';
import { createError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

export class AuthController {
  private userRepository = AppDataSource.getRepository(User);
  private settingRepository = AppDataSource.getRepository(Setting);

  register = async (req: Request, res: Response) => {
    try {
      const { email, password, firstName, lastName, role = 'USER' } = req.body;

      const existingUser = await this.userRepository.findOne({ where: { email } });
      if (existingUser) {
        throw createError('User already exists', 409);
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const user = this.userRepository.create({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role,
      });

      await this.userRepository.save(user);

      const accessToken = await this.generateAccessToken(user.id);
      const refreshToken = await this.generateRefreshToken(user.id);

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

      const user = await this.userRepository.findOne({
        where: { email, isActive: true }
      });

      if (!user) {
        throw createError('Invalid credentials', 401);
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw createError('Invalid credentials', 401);
      }

      user.lastLoginAt = new Date();
      await this.userRepository.save(user);

      const accessToken = await this.generateAccessToken(user.id);
      const refreshToken = await this.generateRefreshToken(user.id);

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

      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { userId: string };

      const user = await this.userRepository.findOne({
        where: { id: decoded.userId, isActive: true }
      });

      if (!user) {
        throw createError('Invalid refresh token', 401);
      }

      const accessToken = await this.generateAccessToken(user.id);
      const newRefreshToken = await this.generateRefreshToken(user.id);

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

  private async generateAccessToken(userId: string): Promise<string> {
    const sessionTimeoutSetting = await this.settingRepository.findOne({
      where: { key: 'sessionTimeout', category: SettingCategory.SECURITY }
    });

    const sessionTimeoutMinutes = sessionTimeoutSetting ? parseInt(sessionTimeoutSetting.value) : 30;
    const expiresIn = `${sessionTimeoutMinutes}m`;

    const options: SignOptions = { expiresIn: expiresIn as any };
    return jwt.sign({ userId }, process.env.JWT_SECRET!, options);
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    const sessionTimeoutSetting = await this.settingRepository.findOne({
      where: { key: 'sessionTimeout', category: SettingCategory.SECURITY }
    });

    const sessionTimeoutMinutes = sessionTimeoutSetting ? parseInt(sessionTimeoutSetting.value) : 30;
    const refreshTimeoutMinutes = Math.max(sessionTimeoutMinutes * 4, 7 * 24 * 60);
    const expiresIn = `${refreshTimeoutMinutes}m`;

    const options: SignOptions = { expiresIn: expiresIn as any };
    return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET!, options);
  }
}
