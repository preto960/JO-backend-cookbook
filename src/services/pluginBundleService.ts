import fs from 'fs/promises';
import path from 'path';
import { InstalledPlugin } from '../models/InstalledPlugin';
import { pluginLoaderService } from './pluginLoaderService';

/**
 * Servicio para crear bundles de plugins que pueden ser cargados en el frontend
 */
export class PluginBundleService {
  /**
   * Genera un bundle JavaScript para un plugin que puede ser cargado en el frontend
   */
  async generatePluginBundle(plugin: InstalledPlugin): Promise<string> {
    console.log(`🔧 Generating bundle for plugin: ${plugin.slug}`);
    
    const pluginDir = pluginLoaderService.getPluginDirectory(plugin.id);
    
    if (!pluginDir) {
      console.error(`❌ Plugin ${plugin.slug} not loaded - no directory found`);
      throw new Error('Plugin not loaded');
    }

    console.log(`   Plugin directory: ${pluginDir}`);

    // Intentar usar el bundle pre-compilado por Vite si existe
    return this.generateViteBundle(plugin, pluginDir);
  }

  /**
   * Genera el bundle usando el bundle pre-compilado por Vite (genérico para cualquier plugin)
   */
  private async generateViteBundle(plugin: InstalledPlugin, pluginDir: string): Promise<string> {
    const manifest = plugin.manifest;

    // Verificar si existe el bundle compilado por Vite
    const viteBundlePath = path.join(pluginDir, 'dist-frontend', 'index.js');
    const viteCssPath = path.join(pluginDir, 'dist-frontend', 'style.css');
    
    try {
      await fs.access(viteBundlePath);
      console.log(`   ✓ Using pre-compiled Vite bundle`);
      
      // Leer el bundle compilado
      let viteBundle = await fs.readFile(viteBundlePath, 'utf-8');
      
      // Intentar leer el CSS si existe
      let cssContent = '';
      try {
        await fs.access(viteCssPath);
        cssContent = await fs.readFile(viteCssPath, 'utf-8');
        console.log(`   ✓ Found CSS file, including in bundle`);
      } catch (cssError) {
        console.log(`   ⚠️  No CSS file found, continuing without styles`);
      }
      
      // TEMPORAL: Renombrar la variable del IIFE si todavía usa el nombre antiguo
      // Esto permite compatibilidad con bundles antiguos mientras se actualiza el plugin
      const iifeVarMatch = viteBundle.match(/^var\s+(\w+)\s*=/);
      if (iifeVarMatch && iifeVarMatch[1] !== '__PLUGIN_MODULE__') {
        const oldVarName = iifeVarMatch[1];
        console.log(`   ⚠️  Bundle uses old variable name: ${oldVarName}, renaming to __PLUGIN_MODULE__`);
        // Reemplazar solo la primera ocurrencia (la declaración)
        viteBundle = viteBundle.replace(/^var\s+\w+\s*=/, 'var __PLUGIN_MODULE__ =');
      }
      
      // El bundle de Vite usa __PLUGIN_MODULE__ como nombre genérico (configurado en vite.config.mjs)
      // Esto permite que todos los plugins usen la misma convención sin necesidad de renombrado
      
      // Extraer las propiedades exportadas del bundle automáticamente
      // Sistema 100% genérico y escalable
      const moduleKeys = this.extractModuleKeys(viteBundle);
      
      // Filtrar 'default' ya que se exporta por separado
      const filteredKeys = moduleKeys.filter(key => key !== 'default');
      const moduleExports = filteredKeys.map(key => `export const ${key} = __PLUGIN_MODULE__.${key};`);
      
      console.log(`   ✓ Auto-detected ${filteredKeys.length} exports:`, filteredKeys.join(', '));
      
      // CSS será cargado por separado via <link> tag
      // No inyectar CSS en el bundle JS
      console.log(`   ✓ CSS will be loaded separately for ${plugin.name}`);

      const bundle = `
// ${plugin.name} Plugin Bundle v${plugin.version}
// Compiled with Vite (IIFE format)
// Plugin ID: ${plugin.id}

// Metadata del plugin
window.__PLUGIN_METADATA__ = window.__PLUGIN_METADATA__ || {};
window.__PLUGIN_METADATA__['${plugin.slug}'] = {
  id: '${plugin.id}',
  slug: '${plugin.slug}',
  name: '${plugin.name}',
  version: '${plugin.version}',
  description: '${plugin.description || ''}',
  manifest: ${JSON.stringify(manifest, null, 2)}
};

// ============================================
// BUNDLE COMPILADO POR VITE (IIFE)
// ============================================
// CSS is loaded separately via /api/plugin-bundles/${plugin.slug}/styles.css

${viteBundle}

// ============================================
// EXPORTS COMO ES MODULES (ESTÁTICOS)
// ============================================

// Verificar que el módulo se haya cargado correctamente
if (typeof __PLUGIN_MODULE__ === 'undefined') {
  console.error('❌ Plugin module not found. IIFE did not execute correctly.');
  throw new Error('Plugin module not loaded');
}

// Exportar todas las propiedades del módulo (generado dinámicamente)
${moduleExports.join('\n')}

// Export default con el objeto completo
export default __PLUGIN_MODULE__;

// Función de inicialización
export async function initialize() {
  console.log('📋 Task Manager Plugin v${plugin.version} initialized');
  return true;
}

// Función de limpieza
export async function destroy() {
  console.log('📋 Task Manager Plugin destroyed');
  return true;
}
`;

      console.log(`   Bundle generated for ${plugin.name} (Vite)`);
      return bundle;
      
    } catch (error) {
      // Si no existe el bundle de Vite, usar bundle genérico
      console.warn(`   ⚠️  Vite bundle not found, using generic bundle`);
      return this.generateGenericBundle(plugin, pluginDir);
    }
  }

  /**
   * Genera un bundle con placeholders (fallback)
   */
  private async generatePlaceholderBundle(plugin: InstalledPlugin, pluginDir: string, manifest: any): Promise<string> {
    const componentsCode = await this.loadVueComponentsAsText(plugin, pluginDir, manifest);
    const storeCode = await this.loadPluginStoreAsText(pluginDir, manifest);

    const bundle = `
// Task Manager Plugin Bundle
// Placeholder mode

export const pluginInfo = {
  id: '${plugin.id}',
  slug: '${plugin.slug}',
  name: '${plugin.name}',
  version: '${plugin.version}',
  description: '${plugin.description || ''}',
  manifest: ${JSON.stringify(manifest, null, 2)}
};

export const routes = ${JSON.stringify(manifest.frontend?.routes || [], null, 2)};

${componentsCode}

${storeCode}

export async function initialize() {
  console.log('📋 Task Manager Plugin initialized (placeholder mode)');
  return true;
}

export async function destroy() {
  console.log('📋 Task Manager Plugin destroyed');
  return true;
}

export default {
  pluginInfo,
  routes,
  components,
  store: useTaskStore,
  initialize,
  destroy
};
`;

    return bundle;
  }

  /**
   * Genera un bundle genérico para cualquier plugin
   */
  private async generateGenericBundle(plugin: InstalledPlugin, pluginDir: string): Promise<string> {
    const manifest = plugin.manifest;

    const bundle = `
// ${plugin.name} Plugin Bundle
// Auto-generated by PluginBundleService

export const pluginInfo = {
  id: '${plugin.id}',
  slug: '${plugin.slug}',
  name: '${plugin.name}',
  version: '${plugin.version}',
  description: '${plugin.description || ''}',
  manifest: ${JSON.stringify(manifest, null, 2)}
};

export const routes = ${JSON.stringify(manifest.frontend?.routes || [], null, 2)};

export const components = {};

export async function initialize() {
  console.log('📦 ${plugin.name} Plugin initialized');
  return true;
}

export async function destroy() {
  console.log('📦 ${plugin.name} Plugin destroyed');
  return true;
}

export default {
  pluginInfo,
  routes,
  components,
  initialize,
  destroy
};
`;

    return bundle;
  }

  /**
   * Carga y concatena todos los componentes del plugin
   */
  private async loadPluginComponents(pluginDir: string, manifest: any): Promise<{ code: string, names: string[] }> {
    console.log(`   Loading components from: ${pluginDir}`);
    const componentsExports: string[] = [];
    const componentNames: string[] = [];
    
    // Cargar views - usar placeholders por ahora
    if (manifest.frontend?.routes) {
      console.log(`   Found ${manifest.frontend.routes.length} routes in manifest`);
      for (const route of manifest.frontend.routes) {
        const componentPath = route.component;
        if (componentPath) {
          const componentName = path.basename(componentPath, '.vue');
          componentsExports.push(`export const ${componentName} = createPlaceholderComponentAlt('${componentName}');`);
          componentNames.push(componentName);
          console.log(`   ✓ Created placeholder for: ${componentName}`);
        }
      }
    }

    // Cargar components adicionales - usar placeholders
    if (manifest.frontend?.components) {
      for (const [name, componentPath] of Object.entries(manifest.frontend.components)) {
        componentsExports.push(`export const ${name} = createPlaceholderComponentAlt('${name}');`);
        componentNames.push(name);
        console.log(`   ✓ Created placeholder for: ${name}`);
      }
    }

    console.log(`   Total components exported: ${componentNames.length}`);
    return {
      code: componentsExports.join('\n'),
      names: componentNames
    };
  }

  /**
   * Extrae los nombres de componentes del código generado
   */
  private extractComponentNames(code: string): string[] {
    const names: string[] = [];
    const exportRegex = /export const (\w+) =/g;
    let match;
    while ((match = exportRegex.exec(code)) !== null) {
      names.push(match[1]);
    }
    return names;
  }

  /**
   * Carga el store del plugin
   */
  private async loadPluginStore(pluginDir: string, manifest: any): Promise<string> {
    // Por ahora, deshabilitar stores hasta que tengamos un sistema de build completo
    // Los stores requieren pinia que no está disponible en el bundle
    return '// Store disabled - requires proper build system\nexport const useTaskStore = null;';
  }

  /**
   * Carga componentes Vue compilados (.js) y genera código para importarlos dinámicamente
   * Por ahora, usa placeholders hasta que tengamos un sistema de build completo
   */
  private async loadVueComponentsAsText(plugin: InstalledPlugin, pluginDir: string, manifest: any): Promise<string> {
    console.log(`   Loading Vue components (placeholder mode)`);
    const componentExports: string[] = [];
    const componentsList: string[] = [];
    
    // Función helper para crear placeholders
    const placeholderFunction = `
// Función para crear componentes placeholder
function createPluginPlaceholder(componentName, pluginName) {
  return {
    name: componentName,
    data() {
      return {
        componentName,
        pluginName
      }
    },
    template: \`
      <div class="flex items-center justify-center min-h-[400px] bg-gray-800/50 rounded-lg border border-gray-700">
        <div class="text-center p-8 max-w-2xl">
          <div class="text-6xl mb-4">🚧</div>
          <h2 class="text-2xl font-bold text-white mb-4">Plugin Component</h2>
          <p class="text-gray-400 mb-6">
            Dynamic Vue component loading is currently in development.
            This is a placeholder for the actual component.
          </p>
          <div class="bg-gray-700/50 p-4 rounded text-left space-y-2">
            <p class="text-sm text-gray-300"><span class="font-semibold">Component:</span> {{ componentName }}</p>
            <p class="text-sm text-gray-300"><span class="font-semibold">Plugin:</span> {{ pluginName }}</p>
          </div>
          <p class="text-gray-500 text-sm mt-6">
            The plugin is installed and active. Full UI support coming soon.
          </p>
        </div>
      </div>
    \`
  };
}
`;
    
    componentExports.push(placeholderFunction);
    
    // Cargar views desde las rutas
    if (manifest.frontend?.routes) {
      console.log(`   Found ${manifest.frontend.routes.length} routes in manifest`);
      for (const route of manifest.frontend.routes) {
        const componentPath = route.component;
        if (componentPath) {
          const componentName = path.basename(componentPath, '.vue');
          
          componentExports.push(`
// ${componentName} Component (Placeholder)
export const ${componentName} = createPluginPlaceholder('${componentName}', '${plugin.name}');
`);
          componentsList.push(componentName);
          console.log(`   ✓ Created placeholder: ${componentName}`);
        }
      }
    }
    
    // Cargar componentes adicionales
    if (manifest.frontend?.components) {
      for (const [name, componentPath] of Object.entries(manifest.frontend.components)) {
        componentExports.push(`
// ${name} Component (Placeholder)
export const ${name} = createPluginPlaceholder('${name}', '${plugin.name}');
`);
        componentsList.push(name);
        console.log(`   ✓ Created placeholder: ${name}`);
      }
    }
    
    // Generar objeto de componentes
    const componentsObject = componentsList.length > 0 
      ? `export const components = { ${componentsList.join(', ')} };`
      : 'export const components = {};';
    
    console.log(`   Total components: ${componentsList.length}`);
    return componentExports.join('\n') + '\n\n' + componentsObject;
  }

  /**
   * Carga el store del plugin como texto
   */
  private async loadPluginStoreAsText(pluginDir: string, manifest: any): Promise<string> {
    // Por ahora, deshabilitar stores completamente hasta que tengamos un sistema de build robusto
    // Los stores de Pinia requieren un manejo especial de dependencias y estado
    console.log(`   ⚠️  Store disabled (requires proper build system)`);
    return '// Store disabled - requires proper build system\nexport const useTaskStore = null;';
  }

  /**
   * Extrae las claves exportadas del módulo IIFE de forma robusta
   * Analiza el código del bundle usando múltiples estrategias
   */
  private extractModuleKeys(viteBundle: string): string[] {
    const keys = new Set<string>();
    
    // Estrategia 1: Buscar todas las asignaciones a exports
    // Patrón: exports.propertyName = ...
    const exportsPattern = /exports\.(\w+)\s*=/g;
    let match;
    while ((match = exportsPattern.exec(viteBundle)) !== null) {
      keys.add(match[1]);
    }
    
    // Estrategia 2: Buscar Object.defineProperty(exports, "name", ...)
    const definePropertyPattern = /Object\.defineProperty\(exports,\s*["'](\w+)["']/g;
    while ((match = definePropertyPattern.exec(viteBundle)) !== null) {
      keys.add(match[1]);
    }
    
    // Estrategia 3: Buscar el return statement del IIFE
    // Patrón: return exports; o return { prop1, prop2, ... };
    const returnMatch = viteBundle.match(/return\s+({[^}]+}|exports)\s*;?\s*}\)\(/);
    if (returnMatch) {
      const returnValue = returnMatch[1];
      
      // Si retorna un objeto literal, extraer las claves
      if (returnValue.startsWith('{')) {
        const objKeys = returnValue.match(/(\w+)(?=\s*[,}])/g);
        if (objKeys) {
          objKeys.forEach(k => keys.add(k));
        }
      }
    }
    
    // Estrategia 4: Buscar exports["name"] = ...
    const bracketPattern = /exports\["(\w+)"\]\s*=/g;
    while ((match = bracketPattern.exec(viteBundle)) !== null) {
      keys.add(match[1]);
    }
    
    // Estrategia 5: Buscar __exports(exports, { name: () => value })
    const exportsHelperPattern = /__exports\(exports,\s*{([^}]+)}/g;
    while ((match = exportsHelperPattern.exec(viteBundle)) !== null) {
      const propsStr = match[1];
      const propNames = propsStr.match(/(\w+):/g);
      if (propNames) {
        propNames.forEach(p => keys.add(p.replace(':', '')));
      }
    }
    
    const result = Array.from(keys);
    
    if (result.length === 0) {
      console.warn('   ⚠️  Could not detect any exports from bundle');
      throw new Error('No exports detected in bundle');
    }
    
    return result;
  }

  /**
   * Obtiene solo el CSS de un plugin
   */
  async getPluginCSS(plugin: InstalledPlugin): Promise<string> {
    const pluginDir = pluginLoaderService.getPluginDirectory(plugin.id);
    
    if (!pluginDir) {
      console.log(`⚠️ Plugin ${plugin.slug} not loaded - no directory found`);
      return '/* Plugin not loaded - no CSS available */';
    }
    
    // PRIORIDAD 1: Buscar archivo CSS específico del plugin
    const pluginSpecificCssPath = path.join(pluginDir, 'frontend', 'assets', `style-${plugin.slug}.css`);
    
    try {
      let cssContent = await fs.readFile(pluginSpecificCssPath, 'utf-8');
      
      console.log(`✓ Plugin-specific CSS loaded: style-${plugin.slug}.css`);
      
      // Verificar que el CSS ya esté scoped
      if (!cssContent.includes(`.plugin-${plugin.slug}`)) {
        console.warn(`⚠️ CSS for ${plugin.name} is not scoped! Please scope CSS in development.`);
        
        // Aplicar scoping automático como fallback
        const scopedCSS = cssContent.replace(
          /([^{}]+)\s*{/g, 
          `.plugin-${plugin.slug} $1 {`
        );
        
        return scopedCSS;
      }
      
      return cssContent;
    } catch (error) {
      console.log(`⚠️ Plugin-specific CSS file not found: style-${plugin.slug}.css`);
      
      // FALLBACK: Buscar archivo genérico y filtrar
      return this.getFallbackCSS(plugin, pluginDir);
    }
  }

  /**
   * Fallback: Obtiene CSS genérico y filtra estilos globales problemáticos
   */
  private async getFallbackCSS(plugin: InstalledPlugin, pluginDir: string): Promise<string> {
    const viteCssPath = path.join(pluginDir, 'dist-frontend', 'style.css');
    
    try {
      let cssContent = await fs.readFile(viteCssPath, 'utf-8');
      
      // Filtrar estilos globales problemáticos de Tailwind
      cssContent = this.filterGlobalCSS(cssContent);
      
      // Aplicar scoping solo a estilos que no sean globales
      const scopedCSS = cssContent.replace(
        /([^{}]+)\s*{/g, 
        (match, selector) => {
          // No scopear selectores que ya son globales o muy específicos
          if (this.shouldSkipScoping(selector)) {
            return match;
          }
          return `.plugin-${plugin.slug} ${selector.trim()} {`;
        }
      );
      
      console.log(`✓ Fallback CSS processed for plugin ${plugin.name}`);
      return scopedCSS;
    } catch (error) {
      console.log(`⚠️ No CSS file found for plugin ${plugin.name}`);
      return '/* No CSS available for this plugin */';
    }
  }

  /**
   * Filtra estilos CSS globales problemáticos
   */
  private filterGlobalCSS(cssContent: string): string {
    // Patrones de CSS globales que causan conflictos
    const globalPatterns = [
      // Tailwind CSS resets globales
      /\*,\s*::before,\s*::after\s*\{[^}]+\}/g,
      /\*\s*\{[^}]+\}/g,
      // Resets de HTML base
      /html\s*\{[^}]+\}/g,
      /body\s*\{[^}]+\}/g,
      // Otros resets globales comunes
      /:root\s*\{[^}]+\}/g,
      // Tailwind base styles que afectan elementos globales
      /h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6\s*\{[^}]+\}/g,
      /p\s*\{[^}]+\}/g,
      /a\s*\{[^}]+\}/g,
      /button\s*\{[^}]+\}/g,
      /input\s*\{[^}]+\}/g,
      /textarea\s*\{[^}]+\}/g,
      /select\s*\{[^}]+\}/g,
    ];

    let filteredCSS = cssContent;
    
    globalPatterns.forEach(pattern => {
      filteredCSS = filteredCSS.replace(pattern, '');
    });
    
    // Limpiar líneas vacías múltiples
    filteredCSS = filteredCSS.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    return filteredCSS;
  }

  /**
   * Determina si un selector debe omitirse del scoping
   */
  private shouldSkipScoping(selector: string): boolean {
    const skipPatterns = [
      // Ya tiene scoping del plugin
      new RegExp(`\\.plugin-${selector}`),
      // Selectores de keyframes
      /^@keyframes/,
      /^@media/,
      /^@supports/,
      // Selectores muy específicos que ya están scoped
      /^\.[a-zA-Z-_]+\.[a-zA-Z-_]+/,
    ];

    return skipPatterns.some(pattern => pattern.test(selector.trim()));
  }

  /**
   * Obtiene la URL del bundle de un plugin
   */
  getPluginBundleUrl(pluginSlug: string): string {
    return `/api/plugin-bundles/${pluginSlug}/bundle.js`;
  }
}

export const pluginBundleService = new PluginBundleService();

