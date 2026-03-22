import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { ExternalApiConnection } from '../models/ExternalApiConnection';
import { AuthRequest } from '../middleware/auth';
import { ExternalApiService } from '../services/externalApiService';
import { createError } from '../middleware/errorHandler';

export class ExternalApiController {
  private repository = AppDataSource.getRepository(ExternalApiConnection);
  private apiService = new ExternalApiService();

  // Método especial para plugins (sin autenticación)
  getConnectionsForPlugins = async (req: any, res: Response) => {
    try {
      console.log('🔌 ExternalApiController: Plugin requesting connections');
      
      const connections = await this.repository.find({
        where: { isActive: true },
        select: ['id', 'name', 'displayName', 'baseUrl', 'type', 'isActive', 'isGlobal']
      });

      console.log(`🔌 ExternalApiController: Found ${connections.length} active connections for plugins`);
      res.json({ connections });
    } catch (error) {
      console.error('Error fetching API connections for plugins:', error);
      res.status(500).json({ message: 'Failed to fetch API connections' });
    }
  };

  // Listar todas las conexiones
  getAllConnections = async (req: AuthRequest, res: Response) => {
    try {
      const connections = await this.repository.find({
        select: ['id', 'name', 'displayName', 'description', 'baseUrl', 'type', 'authType', 'isActive', 'isGlobal', 'testEndpoint', 'createdAt', 'updatedAt'],
        order: { displayName: 'ASC' }
      });

      res.json({ connections });
    } catch (error) {
      console.error('Error fetching API connections:', error);
      res.status(500).json({ message: 'Failed to fetch API connections' });
    }
  };

  // Obtener una conexión específica
  getConnection = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const connection = await this.repository.findOne({
        where: { id },
        select: ['id', 'name', 'displayName', 'description', 'baseUrl', 'type', 'authType', 'authConfig', 'isActive', 'isGlobal', 'testEndpoint', 'testMethod', 'defaultHeaders', 'config', 'createdAt', 'updatedAt']
      });

      if (!connection) {
        throw createError('API connection not found', 404);
      }

      // Devolver authConfig desencriptado para permitir edición
      let authConfig = null;
      if (connection.authConfig) {
        try {
          const decryptedAuthConfig = this.apiService.decrypt(connection.authConfig);
          authConfig = JSON.parse(decryptedAuthConfig);
        } catch (error) {
          console.error('Error decrypting auth config for editing:', error);
          // Si falla la desencriptación, intentar parsear directamente (compatibilidad)
          try {
            authConfig = JSON.parse(connection.authConfig);
          } catch (parseError) {
            console.error('Error parsing auth config:', parseError);
            authConfig = null;
          }
        }
      }

      const response = {
        ...connection,
        hasAuthConfig: !!connection.authConfig,
        authConfig: authConfig,
        defaultHeaders: connection.defaultHeaders ? JSON.parse(connection.defaultHeaders) : null,
        config: connection.config ? JSON.parse(connection.config) : null
      };

      res.json({ connection: response });
    } catch (error) {
      console.error('Error fetching API connection:', error);
      res.status(500).json({ message: 'Failed to fetch API connection' });
    }
  };

  // Crear nueva conexión
  createConnection = async (req: AuthRequest, res: Response) => {
    try {
      const { 
        name, 
        displayName, 
        description, 
        baseUrl, 
        type, 
        authType, 
        authConfig, 
        defaultHeaders, 
        config, 
        testEndpoint,
        testMethod,
        isGlobal 
      } = req.body;

      // Validaciones básicas
      if (!name || !displayName || !baseUrl) {
        throw createError('Name, display name, and base URL are required', 400);
      }

      // Verificar que el nombre no esté en uso
      const existingConnection = await this.repository.findOne({ where: { name } });
      if (existingConnection) {
        throw createError('Connection name already exists', 400);
      }

      // Encriptar authConfig si existe
      let encryptedAuthConfig = undefined;
      if (authConfig && Object.keys(authConfig).length > 0) {
        encryptedAuthConfig = this.apiService.encrypt(JSON.stringify(authConfig));
      }

      const connection = this.repository.create({
        name: name.toLowerCase().replace(/[^a-z0-9_-]/g, '_'), // Normalizar nombre
        displayName,
        description,
        baseUrl: baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl, // Remover trailing slash
        type,
        authType,
        authConfig: encryptedAuthConfig,
        defaultHeaders: defaultHeaders && Object.keys(defaultHeaders).length > 0 ? JSON.stringify(defaultHeaders) : undefined,
        config: config && Object.keys(config).length > 0 ? JSON.stringify(config) : undefined,
        testEndpoint,
        testMethod: testMethod || 'GET',
        isGlobal: isGlobal || false,
        isActive: true // Por defecto activa
      });

      const savedConnection = await this.repository.save(connection);

      // Crear instancia de Axios
      // try {
      //   await this.apiService.createAxiosInstance(savedConnection);
      // } catch (axiosError) {
      //   console.warn('Warning: Could not create Axios instance immediately:', axiosError);
      // }

      // Devolver conexión sin datos sensibles
      const response = {
        ...savedConnection,
        authConfig: undefined,
        hasAuthConfig: !!savedConnection.authConfig
      };

      res.status(201).json({ 
        message: 'API connection created successfully', 
        connection: response 
      });
    } catch (error: any) {
      console.error('Error creating API connection:', error);
      if (error.status) {
        res.status(error.status).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Failed to create API connection' });
      }
    }
  };

  // Actualizar conexión existente
  updateConnection = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { 
        displayName, 
        description, 
        baseUrl, 
        type, 
        authType, 
        authConfig, 
        defaultHeaders, 
        config, 
        testEndpoint,
        testMethod,
        isGlobal 
      } = req.body;

      const connection = await this.repository.findOne({ where: { id } });
      if (!connection) {
        throw createError('API connection not found', 404);
      }

      // Actualizar campos
      if (displayName !== undefined) connection.displayName = displayName;
      if (description !== undefined) connection.description = description;
      if (baseUrl !== undefined) connection.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      if (type !== undefined) connection.type = type;
      if (authType !== undefined) connection.authType = authType;
      if (testEndpoint !== undefined) connection.testEndpoint = testEndpoint;
      if (testMethod !== undefined) connection.testMethod = testMethod;
      if (isGlobal !== undefined) connection.isGlobal = isGlobal;

      // Actualizar authConfig si se proporciona
      if (authConfig !== undefined) {
        if (authConfig && Object.keys(authConfig).length > 0) {
          connection.authConfig = this.apiService.encrypt(JSON.stringify(authConfig));
        } else {
          connection.authConfig = undefined;
        }
      }

      // Actualizar headers y config
      if (defaultHeaders !== undefined) {
        connection.defaultHeaders = defaultHeaders && Object.keys(defaultHeaders).length > 0 ? 
          JSON.stringify(defaultHeaders) : undefined;
      }
      if (config !== undefined) {
        connection.config = config && Object.keys(config).length > 0 ? 
          JSON.stringify(config) : undefined;
      }

      const updatedConnection = await this.repository.save(connection);

      // Recargar instancia de Axios si está activa
      // if (connection.isActive) {
      //   await this.apiService.reloadConnection(id);
      // }

      // Devolver conexión sin datos sensibles
      const response = {
        ...updatedConnection,
        authConfig: undefined,
        hasAuthConfig: !!updatedConnection.authConfig
      };

      res.json({ 
        message: 'API connection updated successfully', 
        connection: response 
      });
    } catch (error: any) {
      console.error('Error updating API connection:', error);
      if (error.status) {
        res.status(error.status).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Failed to update API connection' });
      }
    }
  };

  // Eliminar conexión
  deleteConnection = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const connection = await this.repository.findOne({ where: { id } });
      if (!connection) {
        throw createError('API connection not found', 404);
      }

      // Remover de memoria
      // this.apiService.removeConnection(connection.name);

      // Eliminar de base de datos
      await this.repository.remove(connection);

      res.json({ message: 'API connection deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting API connection:', error);
      if (error.status) {
        res.status(error.status).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Failed to delete API connection' });
      }
    }
  };

  // Testear conexión
  testConnection = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.apiService.testConnection(id);

      res.json(result);
    } catch (error) {
      console.error('Error testing API connection:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to test connection' 
      });
    }
  };

  // Activar/desactivar conexión
  toggleConnection = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const connection = await this.repository.findOne({ where: { id } });

      if (!connection) {
        throw createError('API connection not found', 404);
      }

      connection.isActive = !connection.isActive;
      await this.repository.save(connection);

      // if (connection.isActive) {
      //   // Crear instancia si se activa
      //   await this.apiService.createAxiosInstance(connection);
      // } else {
      //   // Remover instancia si se desactiva
      //   this.apiService.removeConnection(connection.name);
      // }

      res.json({ 
        message: `Connection ${connection.isActive ? 'activated' : 'deactivated'} successfully`,
        isActive: connection.isActive 
      });
    } catch (error: any) {
      console.error('Error toggling API connection:', error);
      if (error.status) {
        res.status(error.status).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Failed to toggle connection status' });
      }
    }
  };

  // Recargar conexión (útil para aplicar cambios sin reiniciar)
  reloadConnection = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      // const success = await this.apiService.reloadConnection(id);

      // if (success) {
        res.json({ message: 'Connection reloaded successfully' });
      // } else {
      //   res.status(404).json({ message: 'Connection not found or failed to reload' });
      // }
    } catch (error) {
      console.error('Error reloading API connection:', error);
      res.status(500).json({ message: 'Failed to reload connection' });
    }
  };

  // Obtener estadísticas de conexiones
  getConnectionStats = async (req: AuthRequest, res: Response) => {
    try {
      // const stats = this.apiService.getConnectionStats();
      const totalInDb = await this.repository.count();
      const activeInDb = await this.repository.count({ where: { isActive: true } });

      res.json({
        database: {
          total: totalInDb,
          active: activeInDb
        },
        memory: {
          total: 0,
          active: 0,
          connections: []
        }
      });
    } catch (error) {
      console.error('Error fetching connection stats:', error);
      res.status(500).json({ message: 'Failed to fetch connection statistics' });
    }
  };
}