import { AppDataSource } from '../config/database';
import { Setting } from '../models/Setting';
import { pusherService } from './pusherService';

type SettingChangeCallback = (newValue: string, oldValue?: string) => void;

class SettingsCache {
  private cache = new Map<string, string>();
  private listeners = new Map<string, SettingChangeCallback[]>();
  private settingRepository = AppDataSource.getRepository(Setting);
  private initialized = false;

  // Inicializar cache con valores de la base de datos
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const settings = await this.settingRepository.find();
      settings.forEach(setting => {
        this.cache.set(setting.key, setting.value);
      });
      this.initialized = true;
      console.log('✅ Settings cache initialized with', settings.length, 'settings');
    } catch (error) {
      console.error('❌ Error initializing settings cache:', error);
    }
  }

  // Obtener valor del cache (con fallback a DB)
  async get(key: string): Promise<string | null> {
    // Si no está en cache, buscar en DB
    if (!this.cache.has(key)) {
      try {
        const setting = await this.settingRepository.findOne({ where: { key } });
        const value = setting?.value || null;
        if (value) {
          this.cache.set(key, value);
        }
        return value;
      } catch (error) {
        console.error(`Error fetching setting ${key}:`, error);
        return null;
      }
    }
    
    return this.cache.get(key) || null;
  }

  // Obtener valor síncrono (solo del cache)
  getSync(key: string): string | null {
    return this.cache.get(key) || null;
  }

  // Establecer valor y notificar cambios
  async set(key: string, value: string): Promise<void> {
    const oldValue = this.cache.get(key);
    this.cache.set(key, value);
    
    // Notificar cambios locales
    if (oldValue !== value) {
      await this.notifyChange(key, value, oldValue);
    }
  }

  // Actualizar múltiples settings
  async setMultiple(settings: Record<string, string>): Promise<void> {
    const changes: Array<{ key: string; newValue: string; oldValue?: string }> = [];
    
    Object.entries(settings).forEach(([key, value]) => {
      const oldValue = this.cache.get(key);
      this.cache.set(key, value);
      
      if (oldValue !== value) {
        changes.push({ key, newValue: value, oldValue });
      }
    });

    // Notificar todos los cambios
    for (const change of changes) {
      await this.notifyChange(change.key, change.newValue, change.oldValue);
    }
  }

  // Suscribirse a cambios de un setting específico
  onChange(key: string, callback: SettingChangeCallback): void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key)!.push(callback);
  }

  // Remover listener
  removeListener(key: string, callback: SettingChangeCallback): void {
    const callbacks = this.listeners.get(key);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // Notificar cambios
  private async notifyChange(key: string, newValue: string, oldValue?: string): Promise<void> {
    // Notificar listeners locales
    const callbacks = this.listeners.get(key) || [];
    callbacks.forEach(callback => {
      try {
        callback(newValue, oldValue);
      } catch (error) {
        console.error(`Error in settings change callback for ${key}:`, error);
      }
    });

    // Notificar a clientes via Pusher para cambios críticos
    if (this.isCriticalSetting(key)) {
      try {
        await pusherService.notify('system', 'setting-changed', {
          key,
          value: newValue,
          oldValue
        });
        console.log(`📡 Broadcasted setting change: ${key} = ${newValue}`);
      } catch (error) {
        console.error(`Error broadcasting setting change for ${key}:`, error);
      }
    }
  }

  // Verificar si es un setting crítico que requiere notificación
  private isCriticalSetting(key: string): boolean {
    const criticalSettings = [
      'multiTenancyEnabled',
      'debugMode',
      'maintenanceMode'
    ];
    return criticalSettings.includes(key);
  }

  // Limpiar cache
  clear(): void {
    this.cache.clear();
    this.listeners.clear();
    this.initialized = false;
  }

  // Recargar cache desde DB
  async reload(): Promise<void> {
    this.clear();
    await this.initialize();
  }

  // Obtener todos los settings del cache
  getAll(): Record<string, string> {
    const result: Record<string, string> = {};
    this.cache.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  // Verificar si multi-tenancy está habilitado (método de conveniencia)
  async isMultiTenancyEnabled(): Promise<boolean> {
    const value = await this.get('multiTenancyEnabled');
    return value === 'true';
  }

  // Verificar si multi-tenancy está habilitado (síncrono)
  isMultiTenancyEnabledSync(): boolean {
    const value = this.getSync('multiTenancyEnabled');
    return value === 'true';
  }
}

// Instancia singleton
export const settingsCache = new SettingsCache();

// El cache se inicializa explícitamente en index.ts después de que AppDataSource esté listo