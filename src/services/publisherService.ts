import axios from 'axios';

const PUBLISHER_API_URL = process.env.PUBLISHER_API_URL || 'http://localhost:4001/api';

export class PublisherService {
  private api = axios.create({
    baseURL: PUBLISHER_API_URL,
    timeout: 30000,
  });

  /**
   * Obtiene todos los plugins publicados desde Publisher
   */
  async getAvailablePlugins(filters?: {
    search?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    page?: number;
    limit?: number;
  }) {
    try {
      const response = await this.api.get('/plugins/published', { params: filters });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching plugins from Publisher:', error.message);
      throw new Error('Failed to fetch plugins from Publisher');
    }
  }

  /**
   * Obtiene un plugin específico por ID
   */
  async getPluginById(pluginId: string) {
    try {
      const response = await this.api.get(`/plugins/${pluginId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching plugin from Publisher:', error.message);
      throw new Error('Plugin not found in Publisher');
    }
  }

  /**
   * Descarga el paquete de un plugin
   */
  async downloadPluginPackage(pluginId: string): Promise<Buffer> {
    try {
      const response = await this.api.get(`/plugins/${pluginId}/download`, {
        responseType: 'arraybuffer'
      });
      return Buffer.from(response.data);
    } catch (error: any) {
      console.error('Error downloading plugin package:', error.message);
      throw new Error('Failed to download plugin package');
    }
  }

  /**
   * Obtiene el manifest de un plugin
   */
  async getPluginManifest(pluginId: string) {
    try {
      const plugin = await this.getPluginById(pluginId);
      return plugin.manifest;
    } catch (error: any) {
      console.error('Error fetching plugin manifest:', error.message);
      throw new Error('Failed to fetch plugin manifest');
    }
  }

  /**
   * Incrementa el contador de descargas de un plugin
   */
  async incrementDownloadCount(pluginId: string) {
    try {
      await this.api.post(`/plugins/${pluginId}/download-count`);
      console.log(`✅ Download count incremented for plugin ${pluginId}`);
    } catch (error: any) {
      console.error('Error incrementing download count:', error.message);
      throw new Error('Failed to increment download count');
    }
  }

  /**
   * Decrementa el contador de descargas de un plugin
   */
  async decrementDownloadCount(pluginId: string) {
    try {
      await this.api.delete(`/plugins/${pluginId}/download-count`);
      console.log(`✅ Download count decremented for plugin ${pluginId}`);
    } catch (error: any) {
      console.error('Error decrementing download count:', error.message);
      throw new Error('Failed to decrement download count');
    }
  }
}

export const publisherService = new PublisherService();

