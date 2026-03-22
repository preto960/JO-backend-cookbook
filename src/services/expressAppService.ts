import { Express, Router } from 'express';

/**
 * Service to manage Express app instance and dynamic route mounting
 */
class ExpressAppService {
  private app: Express | null = null;

  setApp(app: Express) {
    this.app = app;
  }

  getApp(): Express | null {
    return this.app;
  }

  mountPluginRouter(slug: string, router: Router) {
    if (!this.app) {
      console.warn(`Cannot mount plugin router for ${slug}: Express app not initialized`);
      return false;
    }

    this.app.use(`/api/plugins/${slug}`, router);
    console.log(`   ✓ Mounted plugin router: /api/plugins/${slug}`);
    return true;
  }
}

export const expressAppService = new ExpressAppService();

