import { EventEmitter } from 'events';
import { AppDataSource } from '../config/database';
import { InstalledPlugin, InstallationStatus } from '../models/InstalledPlugin';
import { pluginLoaderService } from './pluginLoaderService';

export enum PluginLifecycleEvent {
  BEFORE_INSTALL = 'beforeInstall',
  AFTER_INSTALL = 'afterInstall',
  BEFORE_ACTIVATE = 'beforeActivate',
  AFTER_ACTIVATE = 'afterActivate',
  BEFORE_DEACTIVATE = 'beforeDeactivate',
  AFTER_DEACTIVATE = 'afterDeactivate',
  BEFORE_UPDATE = 'beforeUpdate',
  AFTER_UPDATE = 'afterUpdate',
  BEFORE_UNINSTALL = 'beforeUninstall',
  AFTER_UNINSTALL = 'afterUninstall',
  ERROR = 'error'
}

interface PluginContext {
  pluginId: string;
  pluginSlug: string;
  manifest: any;
  config?: any;
  previousVersion?: string;
}

export class PluginLifecycleService extends EventEmitter {
  private installedPluginRepo = AppDataSource.getRepository(InstalledPlugin);
  private loadedPlugins: Map<string, any> = new Map();
  private pluginBackups: Map<string, any> = new Map();

  /**
   * Ejecuta el hook onInstall de un plugin
   */
  async executeOnInstall(plugin: InstalledPlugin): Promise<void> {
    const context: PluginContext = {
      pluginId: plugin.id,
      pluginSlug: plugin.slug,
      manifest: plugin.manifest,
      config: plugin.config
    };

    try {
      this.emit(PluginLifecycleEvent.BEFORE_INSTALL, context);

      // Ejecutar hook del plugin si existe
      if (plugin.manifest?.hooks?.onInstall) {
        console.log(`🔧 Executing onInstall hook for ${plugin.name}`);
        await this.executeHook(plugin, 'onInstall', context);
      }

      this.emit(PluginLifecycleEvent.AFTER_INSTALL, context);
      console.log(`✅ Plugin ${plugin.name} installed successfully`);
    } catch (error: any) {
      this.emit(PluginLifecycleEvent.ERROR, { context, error });
      throw new Error(`onInstall hook failed: ${error.message}`);
    }
  }

  /**
   * Ejecuta el hook onActivate de un plugin
   */
  async executeOnActivate(plugin: InstalledPlugin): Promise<void> {
    const context: PluginContext = {
      pluginId: plugin.id,
      pluginSlug: plugin.slug,
      manifest: plugin.manifest,
      config: plugin.config
    };

    try {
      this.emit(PluginLifecycleEvent.BEFORE_ACTIVATE, context);

      // Ejecutar hook del plugin si existe
      if (plugin.manifest?.hooks?.onActivate) {
        console.log(`🔧 Executing onActivate hook for ${plugin.name}`);
        await this.executeHook(plugin, 'onActivate', context);
      }

      // Cargar el plugin en memoria
      await this.loadPlugin(plugin);

      this.emit(PluginLifecycleEvent.AFTER_ACTIVATE, context);
      console.log(`✅ Plugin ${plugin.name} activated successfully`);
    } catch (error: any) {
      this.emit(PluginLifecycleEvent.ERROR, { context, error });
      throw new Error(`onActivate hook failed: ${error.message}`);
    }
  }

  /**
   * Ejecuta el hook onDeactivate de un plugin
   */
  async executeOnDeactivate(plugin: InstalledPlugin): Promise<void> {
    const context: PluginContext = {
      pluginId: plugin.id,
      pluginSlug: plugin.slug,
      manifest: plugin.manifest,
      config: plugin.config
    };

    try {
      this.emit(PluginLifecycleEvent.BEFORE_DEACTIVATE, context);

      // Ejecutar hook del plugin si existe
      if (plugin.manifest?.hooks?.onDeactivate) {
        console.log(`🔧 Executing onDeactivate hook for ${plugin.name}`);
        await this.executeHook(plugin, 'onDeactivate', context);
      }

      // Descargar el plugin de memoria
      await this.unloadPlugin(plugin);

      this.emit(PluginLifecycleEvent.AFTER_DEACTIVATE, context);
      console.log(`✅ Plugin ${plugin.name} deactivated successfully`);
    } catch (error: any) {
      this.emit(PluginLifecycleEvent.ERROR, { context, error });
      throw new Error(`onDeactivate hook failed: ${error.message}`);
    }
  }

  /**
   * Ejecuta el hook onUpdate de un plugin
   */
  async executeOnUpdate(plugin: InstalledPlugin, previousVersion: string): Promise<void> {
    const context: PluginContext = {
      pluginId: plugin.id,
      pluginSlug: plugin.slug,
      manifest: plugin.manifest,
      config: plugin.config,
      previousVersion
    };

    try {
      this.emit(PluginLifecycleEvent.BEFORE_UPDATE, context);

      // Crear backup antes de actualizar
      await this.createBackup(plugin);

      // Ejecutar hook del plugin si existe
      if (plugin.manifest?.hooks?.onUpdate) {
        console.log(`🔧 Executing onUpdate hook for ${plugin.name}`);
        await this.executeHook(plugin, 'onUpdate', context);
      }

      // Recargar el plugin
      await this.reloadPlugin(plugin);

      this.emit(PluginLifecycleEvent.AFTER_UPDATE, context);
      console.log(`✅ Plugin ${plugin.name} updated successfully`);
    } catch (error: any) {
      this.emit(PluginLifecycleEvent.ERROR, { context, error });
      
      // Intentar rollback
      await this.rollback(plugin);
      
      throw new Error(`onUpdate hook failed: ${error.message}`);
    }
  }

  /**
   * Ejecuta el hook onUninstall de un plugin
   */
  async executeOnUninstall(plugin: InstalledPlugin): Promise<void> {
    const context: PluginContext = {
      pluginId: plugin.id,
      pluginSlug: plugin.slug,
      manifest: plugin.manifest,
      config: plugin.config
    };

    try {
      this.emit(PluginLifecycleEvent.BEFORE_UNINSTALL, context);

      // Ejecutar hook del plugin si existe
      if (plugin.manifest?.hooks?.onUninstall) {
        console.log(`🔧 Executing onUninstall hook for ${plugin.name}`);
        await this.executeHook(plugin, 'onUninstall', context);
      }

      // Limpiar completamente el plugin
      await this.cleanupPlugin(plugin);

      this.emit(PluginLifecycleEvent.AFTER_UNINSTALL, context);
      console.log(`✅ Plugin ${plugin.name} uninstalled successfully`);
    } catch (error: any) {
      this.emit(PluginLifecycleEvent.ERROR, { context, error });
      throw new Error(`onUninstall hook failed: ${error.message}`);
    }
  }

  /**
   * Ejecuta un hook específico del plugin
   */
  private async executeHook(plugin: InstalledPlugin, hookName: string, context: PluginContext): Promise<void> {
    try {
      // Asegurarse de que el plugin esté cargado
      if (!pluginLoaderService.isPluginLoaded(plugin.id)) {
        await pluginLoaderService.loadPlugin(plugin);
      }

      // Ejecutar el hook del plugin
      await pluginLoaderService.executePluginHook(plugin, hookName, context);
    } catch (error: any) {
      console.error(`Failed to execute ${hookName} hook:`, error.message);
      throw error;
    }
  }

  /**
   * Carga un plugin en memoria
   */
  private async loadPlugin(plugin: InstalledPlugin): Promise<void> {
    if (this.loadedPlugins.has(plugin.id)) {
      console.log(`Plugin ${plugin.name} already loaded`);
      return;
    }

    console.log(`📦 Loading plugin ${plugin.name} into memory`);
    
    // Cargar el plugin usando el pluginLoaderService
    await pluginLoaderService.loadPlugin(plugin);
    
    // Guardar referencia local
    this.loadedPlugins.set(plugin.id, {
      id: plugin.id,
      slug: plugin.slug,
      manifest: plugin.manifest,
      loadedAt: new Date()
    });

    // Emitir evento para que el frontend se entere
    this.emit('pluginLoaded', { pluginId: plugin.id, slug: plugin.slug });
  }

  /**
   * Descarga un plugin de memoria
   */
  private async unloadPlugin(plugin: InstalledPlugin): Promise<void> {
    if (!this.loadedPlugins.has(plugin.id)) {
      console.log(`Plugin ${plugin.name} not loaded`);
      return;
    }

    console.log(`📤 Unloading plugin ${plugin.name} from memory`);
    
    // Descargar el plugin usando el pluginLoaderService
    await pluginLoaderService.unloadPlugin(plugin);
    
    // Limpiar referencia local
    this.loadedPlugins.delete(plugin.id);

    // Emitir evento para que el frontend se entere
    this.emit('pluginUnloaded', { pluginId: plugin.id, slug: plugin.slug });
  }

  /**
   * Recarga un plugin (útil para actualizaciones)
   */
  private async reloadPlugin(plugin: InstalledPlugin): Promise<void> {
    console.log(`🔄 Reloading plugin ${plugin.name}`);
    
    await this.unloadPlugin(plugin);
    await this.loadPlugin(plugin);

    // Emitir evento para que el frontend se entere
    this.emit('pluginReloaded', { pluginId: plugin.id, slug: plugin.slug });
  }

  /**
   * Crea un backup del plugin antes de actualizar
   */
  private async createBackup(plugin: InstalledPlugin): Promise<void> {
    console.log(`💾 Creating backup for ${plugin.name}`);
    
    const backup = {
      id: plugin.id,
      version: plugin.version,
      manifest: JSON.parse(JSON.stringify(plugin.manifest)),
      config: JSON.parse(JSON.stringify(plugin.config)),
      packageUrl: plugin.packageUrl,
      backedUpAt: new Date()
    };

    this.pluginBackups.set(plugin.id, backup);
  }

  /**
   * Realiza rollback de un plugin
   */
  private async rollback(plugin: InstalledPlugin): Promise<void> {
    const backup = this.pluginBackups.get(plugin.id);
    
    if (!backup) {
      console.error(`❌ No backup found for ${plugin.name}`);
      return;
    }

    console.log(`⏮️  Rolling back ${plugin.name} to version ${backup.version}`);

    try {
      // Restaurar datos del backup
      plugin.version = backup.version;
      plugin.manifest = backup.manifest;
      plugin.config = backup.config;
      plugin.packageUrl = backup.packageUrl;
      plugin.status = InstallationStatus.INSTALLED;

      await this.installedPluginRepo.save(plugin);

      // Recargar el plugin con la versión anterior
      await this.reloadPlugin(plugin);

      console.log(`✅ Rollback successful for ${plugin.name}`);
    } catch (error: any) {
      console.error(`❌ Rollback failed for ${plugin.name}:`, error.message);
      throw error;
    }
  }

  /**
   * Limpia completamente un plugin del sistema
   */
  private async cleanupPlugin(plugin: InstalledPlugin): Promise<void> {
    console.log(`🧹 Cleaning up plugin ${plugin.name}`);
    
    // Descargar de memoria si está cargado
    if (this.loadedPlugins.has(plugin.id)) {
      await this.unloadPlugin(plugin);
    }

    // Limpiar backup si existe
    if (this.pluginBackups.has(plugin.id)) {
      this.pluginBackups.delete(plugin.id);
    }

    // Aquí se podría agregar lógica adicional para:
    // - Limpiar archivos temporales
    // - Limpiar datos del plugin en la base de datos
    // - Limpiar caché
    // etc.
  }

  /**
   * Obtiene todos los plugins cargados en memoria
   */
  getLoadedPlugins(): Map<string, any> {
    return this.loadedPlugins;
  }

  /**
   * Verifica si un plugin está cargado
   */
  isPluginLoaded(pluginId: string): boolean {
    return this.loadedPlugins.has(pluginId);
  }

  /**
   * Obtiene información de un plugin cargado
   */
  getLoadedPlugin(pluginId: string): any {
    return this.loadedPlugins.get(pluginId);
  }
}

export const pluginLifecycleService = new PluginLifecycleService();

