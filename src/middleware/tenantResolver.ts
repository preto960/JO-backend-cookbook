import { Request, Response, NextFunction } from 'express';
import { AppDataSource } from '../config/database';
import { Tenant } from '../models/Tenant';
import { Setting } from '../models/Setting';
import { settingsCache } from '../services/settingsCache';

// Extender Request para incluir tenant info
declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      tenant?: Tenant;
      isMultiTenantMode?: boolean;
    }
  }
}

export class TenantResolver {
  private static tenantRepo = AppDataSource.getRepository(Tenant);
  private static defaultTenant: Tenant | null = null;

  // Cache del tenant por defecto
  private static async getDefaultTenant(): Promise<Tenant | null> {
    if (!this.defaultTenant) {
      this.defaultTenant = await this.tenantRepo.findOne({ 
        where: { slug: 'default', isActive: true } 
      });
    }
    return this.defaultTenant;
  }

  // Verificar multi-tenancy usando el cache dinámico
  private static async isMultiTenancyEnabled(): Promise<boolean> {
    return await settingsCache.isMultiTenancyEnabled();
  }

  // Limpiar cache cuando se actualicen settings
  public static clearCache(): void {
    this.defaultTenant = null;
  }

  // Resolver tenant desde subdomain
  private static async resolveTenantFromSubdomain(hostname: string): Promise<Tenant | null> {
    // Extraer subdomain (ej: tenant1.example.com -> tenant1)
    const parts = hostname.split('.');
    if (parts.length < 3) return null; // No hay subdomain
    
    const subdomain = parts[0];
    if (subdomain === 'www' || subdomain === 'api') return null;

    return await this.tenantRepo.findOne({ 
      where: { slug: subdomain, isActive: true } 
    });
  }

  // Resolver tenant desde domain personalizado
  private static async resolveTenantFromDomain(hostname: string): Promise<Tenant | null> {
    return await this.tenantRepo.findOne({ 
      where: { domain: hostname, isActive: true } 
    });
  }

  // Resolver tenant desde header X-Tenant-ID
  private static async resolveTenantFromHeader(tenantId: string): Promise<Tenant | null> {
    if (!tenantId) return null;
    
    return await this.tenantRepo.findOne({ 
      where: { id: tenantId, isActive: true } 
    });
  }

  // Middleware principal
  public static async middleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isMultiTenant = await TenantResolver.isMultiTenancyEnabled();
      req.isMultiTenantMode = isMultiTenant;

      if (!isMultiTenant) {
        // Modo single-tenant: usar tenant por defecto
        const defaultTenant = await TenantResolver.getDefaultTenant();
        req.tenantId = defaultTenant?.id || undefined;
        req.tenant = defaultTenant || undefined;
        return next();
      }

      // Modo multi-tenant: resolver tenant
      let tenant: Tenant | null = null;
      const hostname = req.hostname || req.get('host') || '';
      const tenantHeader = req.get('X-Tenant-ID');

      // Prioridad 1: Header X-Tenant-ID (para APIs)
      if (tenantHeader) {
        tenant = await TenantResolver.resolveTenantFromHeader(tenantHeader);
      }

      // Prioridad 2: Domain personalizado
      if (!tenant) {
        tenant = await TenantResolver.resolveTenantFromDomain(hostname);
      }

      // Prioridad 3: Subdomain
      if (!tenant) {
        tenant = await TenantResolver.resolveTenantFromSubdomain(hostname);
      }

      if (!tenant) {
        res.status(404).json({ 
          error: 'Tenant not found',
          message: 'No valid tenant found for this request',
          hostname,
          tenantHeader 
        });
        return;
      }

      req.tenantId = tenant.id;
      req.tenant = tenant;
      next();
    } catch (error) {
      console.error('Error in tenant resolver:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: 'Failed to resolve tenant' 
      });
      return;
    }
  }

  // Middleware para rutas que requieren tenant
  public static requireTenant(req: Request, res: Response, next: NextFunction): void {
    if (!req.tenantId) {
      res.status(400).json({ 
        error: 'Tenant required',
        message: 'This endpoint requires a valid tenant context' 
      });
      return;
    }
    next();
  }

  // Middleware para rutas de admin que pueden funcionar sin tenant
  public static optionalTenant(req: Request, res: Response, next: NextFunction): void {
    // Siempre continúa, incluso sin tenant
    next();
  }
}