import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { pluginLoaderService } from '../services/pluginLoaderService';

const router = Router();

/**
 * GET /api/plugin-assets/:pluginSlug/*
 * Sirve archivos estáticos de plugins
 */
router.get('/:pluginSlug/*', async (req: Request, res: Response) => {
  try {
    const { pluginSlug } = req.params;
    const filePath = req.params[0]; // El resto de la ruta después de pluginSlug

    // Buscar el plugin cargado
    const loadedPlugins = Array.from(pluginLoaderService.getLoadedPlugins().values());
    const plugin = loadedPlugins.find(p => p.slug === pluginSlug);

    if (!plugin) {
      return res.status(404).json({ message: 'Plugin not found or not loaded' });
    }

    // Construir la ruta completa del archivo
    const fullPath = path.join(plugin.directory, filePath);

    // Verificar que el archivo existe y está dentro del directorio del plugin (seguridad)
    const normalizedPath = path.normalize(fullPath);
    const normalizedPluginDir = path.normalize(plugin.directory);

    if (!normalizedPath.startsWith(normalizedPluginDir)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    try {
      await fs.access(fullPath);
    } catch {
      return res.status(404).json({ message: 'File not found' });
    }

    // Determinar el content-type basado en la extensión
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.js': 'application/javascript; charset=utf-8',
      '.mjs': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.html': 'text/html; charset=utf-8',
      '.vue': 'application/javascript; charset=utf-8', // Vue SFCs como módulos JS
      '.ts': 'application/javascript; charset=utf-8',  // TypeScript como módulos JS
      '.map': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.eot': 'application/vnd.ms-fontobject'
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Habilitar CORS para assets de plugins
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    // Enviar el archivo
    res.sendFile(fullPath);
  } catch (error: any) {
    console.error('Error serving plugin asset:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export { router as pluginAssetsRoutes };

