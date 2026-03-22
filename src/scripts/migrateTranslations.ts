/**
 * Script para migrar TODAS las traducciones (existentes + nuevas) a la base de datos
 * Lee las traducciones existentes del seedTranslations.ts y agrega las nuevas keys hardcodeadas
 * 
 * ⚠️  DEPRECATED: Las traducciones hardcodeadas de este archivo ya fueron movidas
 * al archivo principal seedTranslations.ts. Este script ya no es necesario.
 * 
 * Para ejecutar el seed de traducciones, usar:
 * npm run seed:translations
 * 
 * Este archivo se mantiene por compatibilidad, pero se recomienda usar el seed principal.
 */

import { AppDataSource } from '../config/database'
import { Translation, SupportedLanguage } from '../models/Translation'
import * as fs from 'fs'
import * as path from 'path'

// Nuevas keys de traducción para textos hardcodeados
const newTranslations = [
  // COMMON_KEYS - WebSocket/Connection Status
  { key: 'common.connected', category: 'common', description: 'WebSocket connected status', en: 'Connected', es: 'Conectado' },
  { key: 'common.reconnecting', category: 'common', description: 'WebSocket reconnecting status', en: 'Reconnecting...', es: 'Reconectando...' },
  { key: 'common.disconnected', category: 'common', description: 'WebSocket disconnected status', en: 'Disconnected', es: 'Desconectado' },
  
  // COMMON_KEYS - UI Actions
  { key: 'common.expand_sidebar', category: 'common', description: 'Expand sidebar tooltip', en: 'Expand sidebar', es: 'Expandir barra lateral' },
  { key: 'common.collapse_sidebar', category: 'common', description: 'Collapse sidebar tooltip', en: 'Collapse sidebar', es: 'Contraer barra lateral' },
  { key: 'common.switch_to_light_mode', category: 'common', description: 'Switch to light mode tooltip', en: 'Switch to Light Mode', es: 'Cambiar a modo claro' },
  { key: 'common.switch_to_dark_mode', category: 'common', description: 'Switch to dark mode tooltip', en: 'Switch to Dark Mode', es: 'Cambiar a modo oscuro' },
  
  // COMMON_KEYS - Generic States
  { key: 'common.loading_plugin', category: 'common', description: 'Loading plugin state', en: 'Loading plugin...', es: 'Cargando plugin...' },
  { key: 'common.component_not_available', category: 'common', description: 'Component not available title', en: 'Component Not Available', es: 'Componente No Disponible' },
  { key: 'common.component_not_available_desc', category: 'common', description: 'Component not available description', en: 'This plugin component could not be loaded. The plugin may need to be recompiled or the component path may be incorrect.', es: 'Este componente del plugin no se pudo cargar. Es posible que el plugin necesite ser recompilado o que la ruta del componente sea incorrecta.' },
  { key: 'common.failed_to_load_plugin_component', category: 'common', description: 'Failed to load plugin component error', en: 'Failed to Load Plugin Component', es: 'Error al Cargar Componente del Plugin' },
  { key: 'common.plugin_not_found', category: 'common', description: 'Plugin not found error', en: 'Plugin Not Found', es: 'Plugin No Encontrado' },
  { key: 'common.plugin_inactive', category: 'common', description: 'Plugin inactive error', en: 'Plugin Inactive', es: 'Plugin Inactivo' },
  
  // COMMON_KEYS - Generic Error Messages
  { key: 'common.an_error_occurred', category: 'common', description: 'Generic error message', en: 'An error occurred', es: 'Ocurrió un error' },
  { key: 'common.login_failed_generic', category: 'common', description: 'Generic login failed message', en: 'Login failed', es: 'Error de inicio de sesión' },
  { key: 'common.status_changed_success', category: 'common', description: 'Status changed success message', en: 'Status changed for {{count}} {{type}}', es: 'Estado cambiado para {{count}} {{type}}' },
  { key: 'common.status_changed_error', category: 'common', description: 'Status changed error message', en: 'Could not change status of {{count}} {{type}}', es: 'No se pudo cambiar el estado de {{count}} {{type}}' },
  
  // COMMON_KEYS - Confirmation Messages
  { key: 'common.delete_confirmation', category: 'common', description: 'Generic delete confirmation', en: 'Are you sure you want to delete "{{item}}"?', es: '¿Estás seguro de que quieres eliminar "{{item}}"?' },
  { key: 'common.unsaved_changes', category: 'common', description: 'Unsaved changes warning', en: 'You have unsaved changes', es: 'Tienes cambios sin guardar' },
  
  // DASHBOARD_KEYS - Quick Actions
  { key: 'dashboard.quick_actions', category: 'dashboard', description: 'Quick actions section title', en: 'Quick Actions', es: 'Acciones Rápidas' },
  { key: 'dashboard.browse_market', category: 'dashboard', description: 'Browse market action', en: 'Browse Market', es: 'Explorar Mercado' },
  { key: 'dashboard.discover_new_plugins', category: 'dashboard', description: 'Discover new plugins description', en: 'Discover new plugins', es: 'Descubrir nuevos plugins' },
  { key: 'dashboard.manage_plugins', category: 'dashboard', description: 'Manage plugins action', en: 'Manage Plugins', es: 'Gestionar Plugins' },
  { key: 'dashboard.configure_installed_plugins', category: 'dashboard', description: 'Configure installed plugins description', en: 'Configure installed plugins', es: 'Configurar plugins instalados' },
  { key: 'dashboard.system_configuration', category: 'dashboard', description: 'System configuration description', en: 'System configuration', es: 'Configuración del sistema' },
  { key: 'dashboard.no_chart_data_available', category: 'dashboard', description: 'No chart data available message', en: 'No chart data available', es: 'No hay datos de gráfico disponibles' },
  
  // DASHBOARD_KEYS - Stats Labels
  { key: 'dashboard.installed_plugins_label', category: 'dashboard', description: 'Installed plugins stats label', en: 'Installed Plugins', es: 'Plugins Instalados' },
  { key: 'dashboard.active_plugins_label', category: 'dashboard', description: 'Active plugins stats label', en: 'Active Plugins', es: 'Plugins Activos' },
  { key: 'dashboard.available_in_market_label', category: 'dashboard', description: 'Available in market stats label', en: 'Available in Market', es: 'Disponibles en el Mercado' },
  
  // SETTINGS_KEYS - Permissions Matrix Descriptions
  { key: 'settings.permissions_note', category: 'settings', description: 'Permissions matrix note', en: 'You can enable Menu without View. Users will see the item in menu but get "No permission" toast when clicking. Unchecking Menu will disable all other permissions. Unchecking View will disable Create, Edit, and Delete.', es: 'Puedes habilitar Menú sin Vista. Los usuarios verán el elemento en el menú pero recibirán un mensaje de "Sin permisos" al hacer clic. Desmarcar Menú deshabilitará todos los demás permisos. Desmarcar Vista deshabilitará Crear, Editar y Eliminar.' },
  { key: 'settings.no_plugins_installed', category: 'settings', description: 'No plugins installed message', en: 'No Plugins Installed', es: 'No Hay Plugins Instalados' },
  { key: 'settings.basic_access_plugin_features', category: 'settings', description: 'Basic access plugin features description', en: 'Basic access to plugin features', es: 'Acceso básico a las funciones del plugin' },
  { key: 'settings.extended_access_plugin_features', category: 'settings', description: 'Extended access plugin features description', en: 'Extended access to plugin features', es: 'Acceso extendido a las funciones del plugin' },
  { key: 'settings.full_access_plugin_features', category: 'settings', description: 'Full access plugin features description', en: 'Full access to all plugin features', es: 'Acceso completo a todas las funciones del plugin' },
  { key: 'settings.show_plugin_in_sidebar', category: 'settings', description: 'Show plugin in sidebar description', en: 'Show plugin in sidebar menu', es: 'Mostrar plugin en el menú lateral' },
  { key: 'settings.access_to_view_resource', category: 'settings', description: 'Access to view resource description', en: 'Access to view the resource', es: 'Acceso para ver el recurso' },
  { key: 'settings.ability_to_create_items', category: 'settings', description: 'Ability to create items description', en: 'Ability to create new items', es: 'Capacidad para crear nuevos elementos' },
  { key: 'settings.modify_existing_items', category: 'settings', description: 'Modify existing items description', en: 'Modify existing items', es: 'Modificar elementos existentes' },
  { key: 'settings.remove_items_permanently', category: 'settings', description: 'Remove items permanently description', en: 'Remove items permanently', es: 'Eliminar elementos permanentemente' },
  { key: 'settings.no_permissions_defined', category: 'settings', description: 'No permissions defined message', en: 'No Permissions Defined', es: 'No Hay Permisos Definidos' },
  
  // SETTINGS_KEYS - Translation Manager Specific
  { key: 'settings.use_dynamic_values_help', category: 'settings', description: 'Dynamic values help text', en: 'Use {{param}} for dynamic values in translations.', es: 'Usa {{param}} para valores dinámicos en las traducciones.' },
  { key: 'settings.english_translation_for', category: 'settings', description: 'English translation for placeholder', en: 'English translation for {{key}}', es: 'Traducción en inglés para {{key}}' },
  { key: 'settings.spanish_translation_for', category: 'settings', description: 'Spanish translation for placeholder', en: 'Spanish translation for {{key}}', es: 'Traducción en español para {{key}}' },
  { key: 'settings.delete_translation_confirm', category: 'settings', description: 'Delete translation confirmation', en: 'Are you sure you want to delete the translation "{{key}}"?', es: '¿Estás seguro de que quieres eliminar la traducción "{{key}}"?' },
  
  // SETTINGS_KEYS - Modal Titles
  { key: 'settings.delete_card_title', category: 'settings', description: 'Delete card modal title', en: 'Delete Card', es: 'Eliminar Tarjeta' },
  { key: 'settings.delete_block_title', category: 'settings', description: 'Delete block modal title', en: 'Delete Block', es: 'Eliminar Bloque' },
  { key: 'settings.delete_translations_title', category: 'settings', description: 'Delete translations modal title', en: 'Delete Translations', es: 'Eliminar Traducciones' },
  
  // FORM_KEYS - Common Placeholders
  { key: 'form.email_placeholder', category: 'form', description: 'Email placeholder', en: 'admin@example.com', es: 'admin@ejemplo.com' },
  { key: 'form.password_placeholder', category: 'form', description: 'Password placeholder', en: '••••••••', es: '••••••••' },
  { key: 'form.website_placeholder', category: 'form', description: 'Website placeholder', en: 'https://example.com', es: 'https://ejemplo.com' },
  { key: 'form.username_placeholder', category: 'form', description: 'Username placeholder', en: 'username', es: 'usuario' },
  { key: 'form.twitter_placeholder', category: 'form', description: 'Twitter placeholder', en: '@username', es: '@usuario' },
  { key: 'form.api_endpoint_placeholder', category: 'form', description: 'API endpoint placeholder', en: 'https://api.example.com/stats', es: 'https://api.ejemplo.com/estadisticas' },
  { key: 'form.secondary_title_placeholder', category: 'form', description: 'Secondary title placeholder', en: 'Enter secondary card title...', es: 'Ingresa el título secundario de la tarjeta...' },
  { key: 'form.secondary_api_placeholder', category: 'form', description: 'Secondary API placeholder', en: 'https://api.example.com/secondary-stats', es: 'https://api.ejemplo.com/estadisticas-secundarias' },
  { key: 'form.card_description_placeholder', category: 'form', description: 'Card description placeholder', en: 'Optional description for this card...', es: 'Descripción opcional para esta tarjeta...' },
  
  // FORM_KEYS - Timezone Options
  { key: 'form.utc_timezone', category: 'form', description: 'UTC timezone option', en: 'UTC', es: 'UTC' }
]

// Función para extraer traducciones del archivo seedTranslations.ts
function extractExistingTranslations(): any[] {
  try {
    const seedFilePath = path.join(__dirname, 'seedTranslations.ts')
    const seedFileContent = fs.readFileSync(seedFilePath, 'utf8')
    
    // Extraer el array baseTranslations usando regex
    const match = seedFileContent.match(/const baseTranslations = \[([\s\S]*?)\];/)
    if (!match) {
      throw new Error('Could not find baseTranslations array in seedTranslations.ts')
    }
    
    // Evaluar el contenido del array (esto es seguro porque controlamos el archivo)
    const arrayContent = match[1]
    const baseTranslations = eval(`[${arrayContent}]`)
    
    console.log(`📖 Extracted ${baseTranslations.length} existing translations from seedTranslations.ts`)
    return baseTranslations
  } catch (error) {
    console.warn('⚠️  Could not extract existing translations, using empty array:', (error as Error).message)
    return []
  }
}

async function migrateTranslations() {
  try {
    console.log('🚀 Iniciando migración completa de traducciones...')
    
    // Inicializar conexión a la base de datos
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize()
      console.log('✅ Conexión a la base de datos establecida')
    }

    const translationRepository = AppDataSource.getRepository(Translation)

    // Paso 1: Extraer traducciones existentes
    console.log('📖 Extrayendo traducciones existentes...')
    const existingTranslations = extractExistingTranslations()

    // Paso 2: Combinar traducciones existentes con nuevas
    console.log('🔄 Combinando traducciones existentes con nuevas...')
    
    // Crear un mapa para eliminar duplicados (las nuevas sobreescriben las existentes)
    const translationMap = new Map()
    
    // Agregar traducciones existentes primero
    for (const translation of existingTranslations) {
      translationMap.set(translation.key, translation)
    }
    
    // Agregar nuevas traducciones (sobreescribiendo duplicados)
    for (const translation of newTranslations) {
      if (translationMap.has(translation.key)) {
        console.log(`🔄 Actualizando key existente: ${translation.key}`)
      }
      translationMap.set(translation.key, translation)
    }
    
    // Convertir el mapa a array
    const allTranslations = Array.from(translationMap.values())
    
    console.log(`📊 Total keys únicas: ${allTranslations.length}`)
    console.log(`📚 Keys existentes: ${existingTranslations.length}`)
    console.log(`🆕 Keys nuevas: ${newTranslations.length}`)

    // Paso 3: Eliminar todas las traducciones existentes
    console.log('🗑️  Eliminando traducciones existentes...')
    await translationRepository.clear()
    console.log('✅ Traducciones existentes eliminadas')

    // Paso 4: Insertar todas las traducciones (existentes + nuevas)
    console.log('📝 Insertando todas las traducciones...')
    
    const translationsToInsert = []
    
    for (const translation of allTranslations) {
      // Insertar traducción en inglés
      translationsToInsert.push(translationRepository.create({
        key: translation.key,
        language: SupportedLanguage.EN,
        value: translation.en,
        category: translation.category,
        description: translation.description || null,
        isSystem: true
      }))
      
      // Insertar traducción en español
      translationsToInsert.push(translationRepository.create({
        key: translation.key,
        language: SupportedLanguage.ES,
        value: translation.es,
        category: translation.category,
        description: translation.description || null,
        isSystem: true
      }))
    }

    // Insertar en lotes para mejor rendimiento
    const batchSize = 100
    for (let i = 0; i < translationsToInsert.length; i += batchSize) {
      const batch = translationsToInsert.slice(i, i + batchSize)
      await translationRepository.save(batch)
      console.log(`📦 Insertado lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(translationsToInsert.length / batchSize)}`)
    }

    console.log(`✅ Migración completada exitosamente!`)
    console.log(`📊 Total de traducciones migradas: ${translationsToInsert.length}`)
    console.log(`🌐 Keys únicas: ${allTranslations.length}`)
    console.log(`🆕 Nuevas keys agregadas: ${newTranslations.length}`)
    console.log(`📚 Keys existentes preservadas: ${existingTranslations.length}`)
    console.log(`🔤 Idiomas: EN, ES`)

  } catch (error) {
    console.error('❌ Error durante la migración:', error)
    throw error
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy()
      console.log('🔌 Conexión a la base de datos cerrada')
    }
  }
}

// Ejecutar migración si se llama directamente
if (require.main === module) {
  migrateTranslations()
    .then(() => {
      console.log('🎉 Migración completa de traducciones completada con éxito!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Error en la migración:', error)
      process.exit(1)
    })
}

export { migrateTranslations }