import fs from 'fs/promises'
import path from 'path'
import { InstalledPlugin } from '../models/InstalledPlugin'
import { pluginLoaderService } from './pluginLoaderService'

interface PluginCSSConfig {
  id: string
  slug: string
  name: string
  version: string
  isActive: boolean
  hasCSS: boolean
  cssPath: string
  installedAt: string
}

export class PluginCSSManagerService {
  private frontendConfigPath: string
  private frontendPluginAssetsPath: string

  constructor() {
    this.frontendConfigPath = process.env.VERCEL || process.env.NODE_ENV === 'production'
      ? '/tmp/installed-plugins.json'
      : path.resolve(__dirname, '../../../frontend/src/config/installed-plugins.json')
      
    this.frontendPluginAssetsPath = process.env.VERCEL || process.env.NODE_ENV === 'production'
      ? '/tmp/plugin-assets'
      : path.resolve(__dirname, '../../../frontend/src/assets/plugins')
  }

  /**
   * Agrega CSS de plugin al frontend cuando se instala
   */
  async addPluginCSS(plugin: InstalledPlugin): Promise<void> {
    try {
      console.log(`📦 Adding CSS for plugin: ${plugin.name}`)

      // 1. Crear directorio de assets de plugins si no existe
      await this.ensurePluginAssetsDirectory()

      // 2. Copiar CSS del plugin al frontend
      const hasCSS = await this.copyPluginCSSToFrontend(plugin)

      // 3. Actualizar configuración de plugins instalados
      await this.updateInstalledPluginsConfig(plugin, 'add', hasCSS)

      console.log(`✅ CSS ${hasCSS ? 'added' : 'registered'} for plugin: ${plugin.name}`)
    } catch (error) {
      console.error(`❌ Failed to add CSS for plugin ${plugin.name}:`, error)
      throw error
    }
  }

  /**
   * Remueve CSS de plugin del frontend cuando se desinstala
   */
  async removePluginCSS(plugin: InstalledPlugin): Promise<void> {
    try {
      console.log(`🗑️ Removing CSS for plugin: ${plugin.name}`)

      // 1. Eliminar archivo CSS del frontend
      await this.removePluginCSSFromFrontend(plugin)

      // 2. Actualizar configuración de plugins instalados
      await this.updateInstalledPluginsConfig(plugin, 'remove', false)

      console.log(`✅ CSS removed for plugin: ${plugin.name}`)
    } catch (error) {
      console.error(`❌ Failed to remove CSS for plugin ${plugin.name}:`, error)
      throw error
    }
  }

  /**
   * Copia el CSS del plugin desde el directorio del plugin al frontend
   */
  private async copyPluginCSSToFrontend(plugin: InstalledPlugin): Promise<boolean> {
    const pluginDir = pluginLoaderService.getPluginDirectory(plugin.id)
    if (!pluginDir) {
      throw new Error(`Plugin directory not found for ${plugin.slug}`)
    }

    // Buscar archivo CSS específico del plugin en el directorio del plugin
    const possibleCSSPaths = [
      path.join(pluginDir, 'frontend', 'assets', `style-${plugin.slug}.css`),
      path.join(pluginDir, 'dist-frontend', `style-${plugin.slug}.css`),
      path.join(pluginDir, 'frontend', `style-${plugin.slug}.css`),
      path.join(pluginDir, `style-${plugin.slug}.css`)
    ]
    
    // Ruta de destino en el frontend
    const targetCSSPath = path.join(this.frontendPluginAssetsPath, `style-${plugin.slug}.css`)

    // Buscar el archivo CSS en las posibles ubicaciones
    for (const sourceCSSPath of possibleCSSPaths) {
      try {
        await fs.access(sourceCSSPath)
        
        // Leer y procesar el CSS
        let cssContent = await fs.readFile(sourceCSSPath, 'utf-8')
        
        // Asegurar que el CSS esté scoped correctamente
        cssContent = this.ensureCSSScoping(cssContent, plugin.slug)
        
        // Escribir CSS procesado al frontend
        await fs.writeFile(targetCSSPath, cssContent)
        
        console.log(`📄 CSS copied and scoped: ${sourceCSSPath} → ${targetCSSPath}`)
        return true
      } catch (error) {
        // Continuar buscando en la siguiente ubicación
        continue
      }
    }

    console.warn(`⚠️ CSS file not found for plugin ${plugin.slug} in any expected location`)
    
    // Crear archivo CSS vacío como placeholder
    const placeholderCSS = `/* CSS for ${plugin.name} plugin */
/* No specific styles found - using base styles */

.plugin-${plugin.slug} {
  /* Plugin-specific styles can be added here */
}
`
    await fs.writeFile(targetCSSPath, placeholderCSS)
    return false
  }

  /**
   * Asegura que el CSS esté correctamente scoped al plugin
   */
  private ensureCSSScoping(cssContent: string, pluginSlug: string): string {
    // Si el CSS ya está scoped, devolverlo tal como está
    if (cssContent.includes(`.plugin-${pluginSlug}`)) {
      console.log(`✓ CSS already scoped for plugin: ${pluginSlug}`)
      return cssContent
    }

    console.log(`🔧 Applying automatic scoping for plugin: ${pluginSlug}`)
    
    // Aplicar scoping automático a todas las reglas CSS
    const scopedCSS = cssContent.replace(
      /([^{}@]+)\s*{/g,
      (match, selector) => {
        // No aplicar scoping a at-rules como @media, @keyframes, etc.
        if (selector.trim().startsWith('@')) {
          return match
        }
        
        // No aplicar scoping a selectores que ya tienen scoping
        if (selector.includes('.plugin-')) {
          return match
        }
        
        // Aplicar scoping al selector
        const trimmedSelector = selector.trim()
        return `.plugin-${pluginSlug} ${trimmedSelector} {`
      }
    )

    return `/* Auto-scoped CSS for ${pluginSlug} plugin */\n${scopedCSS}`
  }

  /**
   * Elimina el CSS del plugin del frontend
   */
  private async removePluginCSSFromFrontend(plugin: InstalledPlugin): Promise<void> {
    const targetCSSPath = path.join(this.frontendPluginAssetsPath, `style-${plugin.slug}.css`)

    try {
      await fs.unlink(targetCSSPath)
      console.log(`🗑️ CSS file removed: ${targetCSSPath}`)
    } catch (error) {
      console.warn(`⚠️ CSS file not found for removal: ${targetCSSPath}`)
    }
  }

  /**
   * Actualiza el archivo de configuración de plugins instalados
   */
  private async updateInstalledPluginsConfig(
    plugin: InstalledPlugin, 
    action: 'add' | 'remove', 
    hasCSS: boolean
  ): Promise<void> {
    let installedPlugins: PluginCSSConfig[] = []

    // Leer configuración existente
    try {
      const configContent = await fs.readFile(this.frontendConfigPath, 'utf-8')
      installedPlugins = JSON.parse(configContent)
    } catch (error) {
      console.log('📝 Creating new installed plugins config file')
      installedPlugins = []
    }

    if (action === 'add') {
      // Agregar o actualizar plugin
      const existingIndex = installedPlugins.findIndex(p => p.slug === plugin.slug)
      
      const pluginConfig: PluginCSSConfig = {
        id: plugin.id,
        slug: plugin.slug,
        name: plugin.name,
        version: plugin.version,
        isActive: plugin.isActive,
        hasCSS: hasCSS,
        cssPath: `src/assets/plugins/style-${plugin.slug}.css`,
        installedAt: plugin.installedAt?.toISOString() || new Date().toISOString()
      }

      if (existingIndex >= 0) {
        installedPlugins[existingIndex] = pluginConfig
      } else {
        installedPlugins.push(pluginConfig)
      }
    } else {
      // Remover plugin
      installedPlugins = installedPlugins.filter(p => p.slug !== plugin.slug)
    }

    // Escribir configuración actualizada
    await fs.writeFile(this.frontendConfigPath, JSON.stringify(installedPlugins, null, 2))
    console.log(`📝 Updated installed plugins config (${installedPlugins.length} plugins)`)
  }

  /**
   * Asegura que el directorio de assets de plugins existe
   */
  private async ensurePluginAssetsDirectory(): Promise<void> {
    try {
      await fs.access(this.frontendPluginAssetsPath)
    } catch {
      await fs.mkdir(this.frontendPluginAssetsPath, { recursive: true })
      console.log(`📁 Created plugin assets directory: ${this.frontendPluginAssetsPath}`)
    }

    // Asegurar que el directorio de configuración también existe
    const configDir = path.dirname(this.frontendConfigPath)
    try {
      await fs.access(configDir)
    } catch {
      await fs.mkdir(configDir, { recursive: true })
      console.log(`📁 Created config directory: ${configDir}`)
    }
  }

  /**
   * Sincroniza todos los plugins instalados con el frontend
   */
  async syncAllPlugins(installedPlugins: InstalledPlugin[]): Promise<void> {
    console.log(`🔄 Syncing ${installedPlugins.length} plugins with frontend`)

    // Asegurar directorios
    await this.ensurePluginAssetsDirectory()

    // Limpiar configuración existente
    await fs.writeFile(this.frontendConfigPath, '[]')

    // Agregar cada plugin activo
    for (const plugin of installedPlugins) {
      if (plugin.isActive) {
        await this.addPluginCSS(plugin)
      }
    }

    console.log(`✅ All plugins synced with frontend`)
  }

  /**
   * Actualiza el estado de un plugin (activar/desactivar)
   */
  async updatePluginStatus(plugin: InstalledPlugin): Promise<void> {
    if (plugin.isActive) {
      await this.addPluginCSS(plugin)
    } else {
      await this.removePluginCSS(plugin)
    }
  }
}

export const pluginCSSManagerService = new PluginCSSManagerService()
