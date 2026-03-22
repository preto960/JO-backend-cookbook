import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { AppDataSource, initializeDatabase } from './config/database';
import { ensureDbConnected } from './middleware/dbConnection';
import { errorHandler } from './middleware/errorHandler';
import { TenantResolver } from './middleware/tenantResolver';
import { settingsCache } from './services/settingsCache';
import { pluginLoaderService } from './services/pluginLoaderService';
import { expressAppService } from './services/expressAppService';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { installedPluginRoutes } from './routes/installedPlugins';
import { marketRoutes } from './routes/market';
import { pluginAssetsRoutes } from './routes/pluginAssets';
import { pluginBundlesRoutes } from './routes/pluginBundles';
import permissionRoutes from './routes/permissions';
import roleRoutes from './routes/roles';
import settingRoutes from './routes/settings';
import uploadRoutes from './routes/upload';
import dashboardRoutes from './routes/dashboard';
import translationRoutes from './routes/translations';
import externalApiRoutes from './routes/externalApis';
import { tenantRoutes } from './routes/tenants';

const app = express();
const PORT = process.env.PORT || 3001;
const IS_VERCEL = !!process.env.VERCEL;

app.set('trust proxy', 1);

// ✅ OPTIONS preflight PRIMERO
app.options('*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Tenant-ID, X-Client-Monitor');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.status(204).end();
});

app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
}));

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Client-Monitor'],
  optionsSuccessStatus: 204
}));

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ✅ Health check sin DB
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    dbConnected: AppDataSource.isInitialized,
    environment: IS_VERCEL ? 'vercel' : 'local'
  });
});

// ✅ Este middleware garantiza DB conectada ANTES de cualquier ruta de API
app.use('/api', ensureDbConnected);

// ✅ Settings cache y tenant middleware lazy
app.use('/api', async (req, res, next) => {
  try {
    if (!settingsCache['initialized']) {
      await settingsCache.initialize();
    }
    next();
  } catch (error) {
    next();
  }
});

app.use('/api', TenantResolver.middleware);

// ✅ Rutas
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/installed-plugins', installedPluginRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/plugin-assets', pluginAssetsRoutes);
app.use('/api/plugin-bundles', pluginBundlesRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/translations', translationRoutes);
app.use('/api/external-apis', externalApiRoutes);
app.use('/api/tenants', tenantRoutes);

// Plugin router dinámico
app.use('/api/plugins/:slug', (req, res, next) => {
  const { slug } = req.params;
  const router = pluginLoaderService.getPluginRouterBySlug(slug);

  if (!router) {
    return res.status(404).json({ message: `Plugin '${slug}' not found or not active` });
  }

  req.url = req.url.replace(`/${slug}`, '') || '/';
  if (!req.url.startsWith('/')) req.url = '/' + req.url;

  router(req, res, next);
});

app.use(errorHandler);
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// ✅ Arranque diferente para Vercel vs local
if (!IS_VERCEL) {
  // Servidor tradicional: inicializar todo al arrancar
  const startServer = async () => {
    try {
      await initializeDatabase();
      await settingsCache.initialize();
      expressAppService.setApp(app);
      await pluginLoaderService.initialize();
      await pluginLoaderService.loadAllActivePlugins();

      app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
      });
    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  };

  startServer();
} else {
  // Vercel: solo registrar el app service, el resto es lazy
  expressAppService.setApp(app);
  console.log('⚡ Vercel serverless mode ready');
}

export default app;
module.exports = app;