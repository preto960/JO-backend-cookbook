import fs from 'fs/promises';
import path from 'path';
import { createWriteStream, createReadStream } from 'fs';
import AdmZip from 'adm-zip';
import axios from 'axios';
import { Router } from 'express';
import { InstalledPlugin } from '../models/InstalledPlugin';
import { AppDataSource } from '../config/database';
import { EntitySchema } from 'typeorm';

/**
 * Servicio para cargar y ejecutar plugins dinámicamente
 */
export class PluginLoaderService {
  private pluginsDir: string;
  private loadedPlugins: Map<string, any> = new Map();
  private pluginRouters: Map<string, Router> = new Map();

  constructor() {
    // En Vercel/serverless usar /tmp, en local usar plugins-runtime
    this.pluginsDir = process.env.VERCEL || process.env.NODE_ENV === 'production'
      ? '/tmp/plugins-runtime'
      : path.join(process.cwd(), 'plugins-runtime');
  }

  /**
   * Inicializa el directorio de plugins
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.pluginsDir, { recursive: true });
    console.log('✅ Plugin loader initialized');
  }

  /**
   * Carga todos los plugins activos al iniciar el servidor
   */
  async loadAllActivePlugins(): Promise<void> {
    try {
      const installedPluginRepo = AppDataSource.getRepository(InstalledPlugin);
      const activePlugins = await installedPluginRepo.find({
        where: { isActive: true }
      });

      if (activePlugins.length === 0) {
        console.log('📦 No active plugins to load');
        return;
      }

      console.log(`📦 Loading ${activePlugins.length} active plugin(s)...`);

      for (const plugin of activePlugins) {
        try {
          await this.loadPlugin(plugin);
        } catch (error: any) {
          console.error(`❌ Failed to load plugin ${plugin.name}:`, error.message);
          // Continuar con los demás plugins aunque uno falle
        }
      }

      console.log(`✅ Loaded ${this.loadedPlugins.size} plugin(s) successfully`);
    } catch (error: any) {
      console.error('❌ Failed to load active plugins:', error.message);
    }
  }

  /**
   * Descarga y extrae un plugin desde su packageUrl
   */
  async downloadAndExtractPlugin(plugin: InstalledPlugin): Promise<string> {
    const pluginDir = path.join(this.pluginsDir, plugin.slug);
    
    // Limpiar directorio si existe
    try {
      await fs.rm(pluginDir, { recursive: true, force: true });
    } catch (error) {
      // Directorio no existe, está bien
    }

    await fs.mkdir(pluginDir, { recursive: true });

    // Usar el endpoint de descarga del Publisher en lugar de la URL directa de Vercel Blob
    // Nota: PUBLISHER_API_URL ya incluye /api, así que solo agregamos /download
    const publisherBaseUrl = process.env.PUBLISHER_BASE_URL || 'http://localhost:4001';
    const downloadUrl = `${publisherBaseUrl}/api/download/${plugin.publisherPluginId}`;
    
    console.log(`📦 Downloading plugin ${plugin.name} from Publisher`);
    console.log(`   Publisher Plugin ID: ${plugin.publisherPluginId}`);
    console.log(`   Download URL: ${downloadUrl}`);

    try {
      // Descargar el ZIP desde el Publisher
      const response = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 60000 // 60 segundos
      });

      const zipPath = path.join(pluginDir, `${plugin.slug}.zip`);
      await fs.writeFile(zipPath, response.data);

      console.log(`📂 Extracting plugin ${plugin.name}`);

      // Extraer el ZIP
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(pluginDir, true);

      // Eliminar el ZIP después de extraer
      await fs.unlink(zipPath);

      console.log(`✅ Plugin ${plugin.name} extracted to ${pluginDir}`);
      return pluginDir;
    } catch (error: any) {
      console.error(`❌ Failed to download/extract plugin ${plugin.name}:`, error.message);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Data:`, error.response.data);
      }
      throw new Error(`Failed to download plugin: ${error.message}`);
    }
  }

  /**
   * Carga las entidades (modelos) del plugin en TypeORM
   * NOTA: No cargamos las entidades dinámicamente en TypeORM porque los decoradores
   * se pierden en la compilación. En su lugar, usamos pluginDatabaseService para
   * crear las tablas directamente con SQL.
   */
  async loadPluginEntities(plugin: InstalledPlugin, pluginDir: string): Promise<void> {
    if (!plugin.manifest?.backend?.models) {
      console.log(`Plugin ${plugin.name} has no backend models`);
      return;
    }

    console.log(`📊 Plugin ${plugin.name} has ${plugin.manifest.backend.models.length} model(s)`);
    console.log(`   Tables will be created by pluginDatabaseService`);
    
    // Las tablas se crean en pluginInstallationService usando pluginDatabaseService
    // No intentamos cargar las entidades en TypeORM porque los decoradores no están
    // disponibles en tiempo de ejecución después de la compilación a JavaScript
  }

  /**
   * Registra las entidades del plugin en el AppDataSource
   */
  async registerPluginEntities(plugin: InstalledPlugin, pluginDir: string): Promise<void> {
    try {
      if (!plugin.manifest?.backend?.models) {
        return;
      }

      const { AppDataSource } = await import('../config/database');
      
      // Store entity classes for this plugin
      const pluginEntities: any[] = [];
      
      for (const modelPath of plugin.manifest.backend.models) {
        try {
          const fullPath = path.join(pluginDir, modelPath.replace('.ts', '.js'));
          const entityModule = await import(fullPath);
          
          // Get all exported entities from the module
          const entities = Object.values(entityModule).filter((exp: any) => 
            typeof exp === 'function' && exp.prototype && exp.name
          );
          
          for (const entity of entities) {
            pluginEntities.push(entity);
            console.log(`   ✓ Loaded entity: ${(entity as any).name}`);
          }
        } catch (error: any) {
          console.warn(`   ⚠️  Failed to load entity ${modelPath}:`, error.message);
        }
      }
      
      // Store entities globally for the plugin to access
      if (!(global as any).pluginEntities) {
        (global as any).pluginEntities = new Map();
      }
      (global as any).pluginEntities.set(plugin.slug, pluginEntities);
      
      console.log(`   ✓ Registered ${pluginEntities.length} entity(ies) for ${plugin.name}`);
    } catch (error: any) {
      console.error(`Failed to register plugin entities:`, error.message);
    }
  }

  /**
   * Ejecuta un hook del plugin
   */
  async executePluginHook(
    plugin: InstalledPlugin, 
    hookName: string, 
    context: any
  ): Promise<void> {
    const pluginDir = path.join(this.pluginsDir, plugin.slug);
    
    if (!plugin.manifest?.hooks?.[hookName]) {
      console.log(`Plugin ${plugin.name} has no ${hookName} hook`);
      return;
    }

    const hookPath = plugin.manifest.hooks[hookName];
    const fullPath = path.join(pluginDir, hookPath.replace('.ts', '.js'));

    try {
      // Verificar que el archivo existe
      await fs.access(fullPath);

      console.log(`🔧 Executing ${hookName} hook for ${plugin.name}`);

      // Importar y ejecutar el hook
      const hookModule = await import(fullPath);
      const hookFunction = hookModule.default || hookModule[hookName];

      if (typeof hookFunction === 'function') {
        await hookFunction(context);
        console.log(`  ✓ ${hookName} hook executed successfully`);
      } else {
        console.warn(`  ⚠️  ${hookName} hook is not a function`);
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.warn(`  ⚠️  Hook file not found: ${fullPath}`);
      } else {
        console.error(`  ✗ Failed to execute ${hookName} hook:`, error.message);
        throw error;
      }
    }
  }

  /**
   * Crea las tablas del plugin manualmente
   * Nota: Esta función está deshabilitada porque TypeORM no permite
   * crear tablas dinámicamente de esta manera. Las tablas se crean
   * mediante pluginDatabaseService.
   */
  async createPluginTables(plugin: InstalledPlugin, pluginDir: string): Promise<void> {
    if (!plugin.manifest?.backend?.models) {
      return;
    }

    console.log(`🗄️  Plugin ${plugin.name} has models defined in manifest`);
    console.log(`    Tables will be created by pluginDatabaseService`);
    
    // Las tablas se crean en pluginDatabaseService usando SQL directo
    // porque TypeORM no permite agregar entidades dinámicamente después
    // de inicializar la conexión
  }

  /**
   * Carga el router del backend del plugin dinámicamente
   */
  async loadPluginRouter(plugin: InstalledPlugin, pluginDir: string): Promise<Router | null> {
    try {
      // Verificar si el plugin tiene backend
      if (!plugin.manifest?.backend) {
        console.log(`   Plugin ${plugin.name} has no backend`);
        return null;
      }

      // Buscar el archivo de entrada del backend
      const backendIndexPath = path.join(pluginDir, 'backend', 'index.js');
      
      try {
        await fs.access(backendIndexPath);
      } catch {
        console.log(`   Plugin ${plugin.name} has no backend/index.js`);
        return null;
      }

      console.log(`   Loading backend router from ${backendIndexPath}`);

      // Importar el módulo del backend del plugin
      const backendModule = await import(backendIndexPath);
      const router = backendModule.default || backendModule.router;

      if (!router) {
        console.warn(`   ⚠️  Plugin ${plugin.name} backend does not export a router`);
        return null;
      }

      console.log(`   ✓ Backend router loaded for ${plugin.name}`);
      return router;
    } catch (error: any) {
      console.error(`   ✗ Failed to load backend router:`, error.message);
      return null;
    }
  }

  /**
   * Carga un plugin completamente
   */
  async loadPlugin(plugin: InstalledPlugin): Promise<void> {
    // Verificar si ya está cargado Y si el directorio existe
    if (this.loadedPlugins.has(plugin.id)) {
      const loadedPlugin = this.loadedPlugins.get(plugin.id);
      try {
        await fs.access(loadedPlugin.directory);
        console.log(`Plugin ${plugin.name} already loaded`);
        return;
      } catch {
        console.log(`Plugin ${plugin.name} was loaded but directory is missing, reloading...`);
        this.loadedPlugins.delete(plugin.id);
        this.pluginRouters.delete(plugin.id);
      }
    }

    try {
      console.log(`\n🚀 Loading plugin: ${plugin.name}`);

      // 1. Descargar y extraer el plugin
      const pluginDir = await this.downloadAndExtractPlugin(plugin);

      // 2. Cargar entidades del backend si existen
      if (plugin.manifest?.backend?.models) {
        await this.loadPluginEntities(plugin, pluginDir);
        // Register plugin entities in AppDataSource
        await this.registerPluginEntities(plugin, pluginDir);
      }

      // 3. Cargar el router del backend del plugin
      const router = await this.loadPluginRouter(plugin, pluginDir);
      if (router) {
        this.pluginRouters.set(plugin.id, router);
        console.log(`   ✓ Plugin router registered for /api/plugins/${plugin.slug}`);
      }

      // 4. Guardar referencia del plugin cargado
      this.loadedPlugins.set(plugin.id, {
        id: plugin.id,
        slug: plugin.slug,
        name: plugin.name,
        directory: pluginDir,
        manifest: plugin.manifest,
        hasRouter: !!router,
        loadedAt: new Date()
      });

      console.log(`✅ Plugin ${plugin.name} loaded successfully\n`);
    } catch (error: any) {
      console.error(`❌ Failed to load plugin ${plugin.name}:`, error.message);
      throw error;
    }
  }

  /**
   * Descarga un plugin
   */
  async unloadPlugin(plugin: InstalledPlugin): Promise<void> {
    if (!this.loadedPlugins.has(plugin.id)) {
      console.log(`Plugin ${plugin.name} is not loaded`);
      return;
    }

    console.log(`📤 Unloading plugin: ${plugin.name}`);

    const loadedPlugin = this.loadedPlugins.get(plugin.id);
    
    // Limpiar directorio del plugin
    try {
      await fs.rm(loadedPlugin.directory, { recursive: true, force: true });
    } catch (error: any) {
      console.warn(`⚠️  Failed to remove plugin directory: ${error.message}`);
    }

    // Limpiar router
    this.pluginRouters.delete(plugin.id);
    this.loadedPlugins.delete(plugin.id);
    console.log(`✅ Plugin ${plugin.name} unloaded`);
  }

  /**
   * Obtiene el directorio de un plugin cargado
   */
  getPluginDirectory(pluginId: string): string | null {
    const plugin = this.loadedPlugins.get(pluginId);
    return plugin ? plugin.directory : null;
  }

  /**
   * Verifica si un plugin está cargado
   */
  isPluginLoaded(pluginId: string): boolean {
    return this.loadedPlugins.has(pluginId);
  }

  /**
   * Obtiene todos los plugins cargados
   */
  getLoadedPlugins(): Map<string, any> {
    return this.loadedPlugins;
  }

  /**
   * Obtiene el router de un plugin por su ID
   */
  getPluginRouter(pluginId: string): Router | null {
    return this.pluginRouters.get(pluginId) || null;
  }

  /**
   * Obtiene el router de un plugin por su slug
   */
  getPluginRouterBySlug(slug: string): Router | null {
    for (const [pluginId, loadedPlugin] of this.loadedPlugins.entries()) {
      if (loadedPlugin.slug === slug) {
        return this.pluginRouters.get(pluginId) || null;
      }
    }
    return null;
  }

  /**
   * Obtiene todos los routers de plugins cargados
   */
  getAllPluginRouters(): Map<string, { slug: string; router: Router }> {
    const routers = new Map<string, { slug: string; router: Router }>();
    
    for (const [pluginId, router] of this.pluginRouters.entries()) {
      const loadedPlugin = this.loadedPlugins.get(pluginId);
      if (loadedPlugin) {
        routers.set(pluginId, {
          slug: loadedPlugin.slug,
          router
        });
      }
    }
    
    return routers;
  }
}

export const pluginLoaderService = new PluginLoaderService();

