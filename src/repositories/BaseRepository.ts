import { Repository, FindManyOptions, FindOneOptions, DeepPartial, FindOptionsWhere } from 'typeorm';
import { AppDataSource } from '../config/database';
import { settingsCache } from '../services/settingsCache';

export abstract class BaseRepository<T extends { tenantId?: string | null }> {
  protected repository: Repository<T>;

  constructor(entity: new () => T) {
    this.repository = AppDataSource.getRepository(entity);
  }

  // Verificar multi-tenancy usando el cache dinámico
  protected async isMultiTenancyEnabled(): Promise<boolean> {
    return await settingsCache.isMultiTenancyEnabled();
  }

  // Método estático para compatibilidad (ya no necesario)
  public static clearCache(): void {
    // El cache ahora es manejado por settingsCache
  }

  // Agregar filtro de tenant a las condiciones where
  protected async addTenantFilter(
    where: FindOptionsWhere<T> | FindOptionsWhere<T>[] | undefined,
    tenantId?: string
  ): Promise<FindOptionsWhere<T> | FindOptionsWhere<T>[] | undefined> {
    const isMultiTenant = await this.isMultiTenancyEnabled();
    
    if (!isMultiTenant || !tenantId) {
      return where;
    }

    if (Array.isArray(where)) {
      return where.map(condition => ({ ...condition, tenantId } as FindOptionsWhere<T>));
    } else if (where) {
      return { ...where, tenantId } as FindOptionsWhere<T>;
    } else {
      return { tenantId } as FindOptionsWhere<T>;
    }
  }

  // Find methods con filtro de tenant
  async find(options?: FindManyOptions<T>, tenantId?: string): Promise<T[]> {
    if (options?.where) {
      options.where = await this.addTenantFilter(options.where, tenantId);
    } else if (tenantId && await this.isMultiTenancyEnabled()) {
      options = { ...options, where: { tenantId } as FindOptionsWhere<T> };
    }
    
    return this.repository.find(options);
  }

  async findOne(options?: FindOneOptions<T>, tenantId?: string): Promise<T | null> {
    if (options?.where) {
      options.where = await this.addTenantFilter(options.where, tenantId);
    } else if (tenantId && await this.isMultiTenancyEnabled()) {
      options = { ...options, where: { tenantId } as FindOptionsWhere<T> };
    }
    
    return this.repository.findOne(options || {});
  }

  async findOneBy(where: FindOptionsWhere<T>, tenantId?: string): Promise<T | null> {
    const filteredWhere = await this.addTenantFilter(where, tenantId);
    return this.repository.findOneBy(filteredWhere as FindOptionsWhere<T>);
  }

  async findBy(where: FindOptionsWhere<T>, tenantId?: string): Promise<T[]> {
    const filteredWhere = await this.addTenantFilter(where, tenantId);
    return this.repository.findBy(filteredWhere as FindOptionsWhere<T>);
  }

  // Count con filtro de tenant
  async count(options?: FindManyOptions<T>, tenantId?: string): Promise<number> {
    if (options?.where) {
      options.where = await this.addTenantFilter(options.where, tenantId);
    } else if (tenantId && await this.isMultiTenancyEnabled()) {
      options = { ...options, where: { tenantId } as FindOptionsWhere<T> };
    }
    
    return this.repository.count(options);
  }

  // Save methods que asignan tenantId automáticamente
  async save(entity: DeepPartial<T>, tenantId?: string): Promise<T> {
    const isMultiTenant = await this.isMultiTenancyEnabled();
    
    if (isMultiTenant && tenantId && !entity.tenantId) {
      entity.tenantId = tenantId;
    }
    
    return this.repository.save(entity);
  }

  async saveMultiple(entities: DeepPartial<T>[], tenantId?: string): Promise<T[]> {
    const isMultiTenant = await this.isMultiTenancyEnabled();
    
    if (isMultiTenant && tenantId) {
      entities = entities.map(entity => ({
        ...entity,
        tenantId: entity.tenantId || tenantId
      }));
    }
    
    return this.repository.save(entities);
  }

  // Create methods
  create(entityLike: DeepPartial<T>, tenantId?: string): T {
    const entity = this.repository.create(entityLike);
    
    if (tenantId && !entity.tenantId) {
      entity.tenantId = tenantId;
    }
    
    return entity;
  }

  // Delete methods con filtro de tenant
  async delete(criteria: FindOptionsWhere<T>, tenantId?: string): Promise<void> {
    const filteredCriteria = await this.addTenantFilter(criteria, tenantId);
    await this.repository.delete(filteredCriteria as FindOptionsWhere<T>);
  }

  async remove(entity: T): Promise<T> {
    return this.repository.remove(entity);
  }

  async removeMultiple(entities: T[]): Promise<T[]> {
    return this.repository.remove(entities);
  }

  // Update methods con filtro de tenant
  async update(criteria: FindOptionsWhere<T>, partialEntity: any, tenantId?: string): Promise<void> {
    const filteredCriteria = await this.addTenantFilter(criteria, tenantId);
    await this.repository.update(filteredCriteria as FindOptionsWhere<T>, partialEntity);
  }

  // Método para obtener el repository nativo (para casos especiales)
  getRepository(): Repository<T> {
    return this.repository;
  }

  // Método para verificar si una entidad pertenece al tenant
  async verifyTenantOwnership(entityId: string, tenantId?: string): Promise<boolean> {
    if (!tenantId || !await this.isMultiTenancyEnabled()) {
      return true; // En modo single-tenant, siempre permitir
    }

    const entity = await this.repository.findOne({
      where: { id: entityId } as unknown as FindOptionsWhere<T>
    });

    return entity?.tenantId === tenantId;
  }
}