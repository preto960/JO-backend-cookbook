import { User } from '../models/User';
import { BaseRepository } from './BaseRepository';

export class UserRepository extends BaseRepository<User> {
  constructor() {
    super(User);
  }

  // Métodos específicos para User
  async findByEmail(email: string, tenantId?: string): Promise<User | null> {
    return this.findOneBy({ email } as any, tenantId);
  }

  async findActiveUsers(tenantId?: string): Promise<User[]> {
    return this.findBy({ isActive: true } as any, tenantId);
  }

  async findByRole(role: string, tenantId?: string): Promise<User[]> {
    return this.findBy({ role } as any, tenantId);
  }

  async updateLastLogin(userId: string, tenantId?: string): Promise<void> {
    await this.update(
      { id: userId } as any,
      { lastLoginAt: new Date() },
      tenantId
    );
  }
}