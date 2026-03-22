"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalApiService = void 0;
const database_1 = require("../config/database");
const ExternalApiConnection_1 = require("../models/ExternalApiConnection");
const axios_1 = __importDefault(require("axios"));
const crypto = __importStar(require("crypto"));
class ExternalApiService {
    constructor() {
        this.connections = new Map();
        this.repository = database_1.AppDataSource.getRepository(ExternalApiConnection_1.ExternalApiConnection);
        this.encryptionKey = process.env.API_ENCRYPTION_KEY || 'default-key-change-in-production-2024';
    }
    // Inicializar todas las conexiones activas al arrancar la app
    async initializeConnections() {
        try {
            const activeConnections = await this.repository.find({
                where: { isActive: true }
            });
            console.log(`Initializing ${activeConnections.length} external API connections...`);
            for (const connection of activeConnections) {
                await this.createAxiosInstance(connection);
            }
            console.log('External API connections initialized successfully');
        }
        catch (error) {
            console.error('Error initializing external API connections:', error);
        }
    }
    // Crear instancia de Axios para una conexión específica
    async createAxiosInstance(connection) {
        try {
            const authConfig = connection.authConfig ? this.decrypt(connection.authConfig) : {};
            const defaultHeaders = connection.defaultHeaders ? JSON.parse(connection.defaultHeaders) : {};
            const config = connection.config ? JSON.parse(connection.config) : {};
            const axiosConfig = {
                baseURL: connection.baseUrl,
                timeout: config.timeout || 10000,
                headers: {
                    'Content-Type': 'application/json',
                    ...defaultHeaders
                }
            };
            // Configurar autenticación según el tipo
            switch (connection.authType) {
                case ExternalApiConnection_1.AuthenticationType.API_KEY:
                    if (authConfig.headerName && authConfig.apiKey) {
                        axiosConfig.headers[authConfig.headerName] = authConfig.apiKey;
                    }
                    break;
                case ExternalApiConnection_1.AuthenticationType.BEARER_TOKEN:
                    if (authConfig.token) {
                        axiosConfig.headers['Authorization'] = `Bearer ${authConfig.token}`;
                    }
                    break;
                case ExternalApiConnection_1.AuthenticationType.BASIC_AUTH:
                    if (authConfig.username && authConfig.password) {
                        axiosConfig.auth = {
                            username: authConfig.username,
                            password: authConfig.password
                        };
                    }
                    break;
                case ExternalApiConnection_1.AuthenticationType.CUSTOM_HEADER:
                    if (authConfig.headerName && authConfig.headerValue) {
                        axiosConfig.headers[authConfig.headerName] = authConfig.headerValue;
                    }
                    break;
            }
            const instance = axios_1.default.create(axiosConfig);
            // Agregar interceptores para logging en modo debug
            instance.interceptors.request.use((config) => {
                console.log(`[${connection.name}] Request:`, {
                    method: config.method?.toUpperCase(),
                    url: config.url,
                    baseURL: config.baseURL
                });
                return config;
            }, (error) => {
                console.error(`[${connection.name}] Request error:`, error);
                return Promise.reject(error);
            });
            instance.interceptors.response.use((response) => {
                console.log(`[${connection.name}] Response:`, {
                    status: response.status,
                    statusText: response.statusText
                });
                return response;
            }, (error) => {
                console.error(`[${connection.name}] Response error:`, {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    message: error.message
                });
                return Promise.reject(error);
            });
            this.connections.set(connection.name, instance);
            console.log(`Created Axios instance for connection: ${connection.name}`);
            return instance;
        }
        catch (error) {
            console.error(`Error creating Axios instance for ${connection.name}:`, error);
            throw error;
        }
    }
    // Obtener instancia de conexión por nombre
    getConnection(name) {
        return this.connections.get(name) || null;
    }
    // Obtener todas las conexiones disponibles
    getAvailableConnections() {
        return Array.from(this.connections.keys());
    }
    // Recargar una conexión específica
    async reloadConnection(connectionId) {
        try {
            const connection = await this.repository.findOne({ where: { id: connectionId } });
            if (!connection)
                return false;
            // Remover la conexión existente si existe
            if (this.connections.has(connection.name)) {
                this.connections.delete(connection.name);
            }
            // Crear nueva instancia si está activa
            if (connection.isActive) {
                await this.createAxiosInstance(connection);
            }
            return true;
        }
        catch (error) {
            console.error('Error reloading connection:', error);
            return false;
        }
    }
    // Testear conexión
    async testConnection(connectionId) {
        try {
            const connection = await this.repository.findOne({ where: { id: connectionId } });
            if (!connection) {
                return { success: false, message: 'Connection not found' };
            }
            const instance = await this.createAxiosInstance(connection);
            const testEndpoints = connection.testEndpoint || '/';
            // Parsear múltiples endpoints separados por comas
            const endpoints = testEndpoints
                .split(',')
                .map(endpoint => endpoint.trim())
                .filter(endpoint => endpoint.length > 0);
            const results = [];
            let allSuccessful = true;
            let totalTime = 0;
            for (const endpoint of endpoints) {
                const startTime = Date.now();
                try {
                    let response;
                    const method = (connection.testMethod || 'GET').toUpperCase();
                    // Usar método HTTP configurado
                    switch (method) {
                        case 'POST':
                            response = await instance.post(endpoint, {}, { timeout: 5000 });
                            break;
                        case 'PUT':
                            response = await instance.put(endpoint, {}, { timeout: 5000 });
                            break;
                        case 'PATCH':
                            response = await instance.patch(endpoint, {}, { timeout: 5000 });
                            break;
                        case 'DELETE':
                            response = await instance.delete(endpoint, { timeout: 5000 });
                            break;
                        case 'HEAD':
                            response = await instance.head(endpoint, { timeout: 5000 });
                            break;
                        case 'OPTIONS':
                            response = await instance.options(endpoint, { timeout: 5000 });
                            break;
                        case 'GET':
                        default:
                            response = await instance.get(endpoint, { timeout: 5000 });
                            break;
                    }
                    const responseTime = Date.now() - startTime;
                    totalTime += responseTime;
                    results.push({
                        endpoint,
                        success: true,
                        status: response.status,
                        statusText: response.statusText,
                        responseTime,
                        message: `${response.status} ${response.statusText}`,
                        contentType: response.headers['content-type'],
                        dataSize: response.data ? JSON.stringify(response.data).length : 0
                    });
                }
                catch (error) {
                    allSuccessful = false;
                    const responseTime = Date.now() - startTime;
                    totalTime += responseTime;
                    let message = 'Connection failed';
                    let status = null;
                    if (error.code === 'ECONNREFUSED') {
                        message = 'Connection refused - service may be down';
                    }
                    else if (error.code === 'ETIMEDOUT') {
                        message = 'Connection timeout';
                    }
                    else if (error.response) {
                        status = error.response.status;
                        message = `HTTP ${error.response.status}: ${error.response.statusText}`;
                    }
                    else if (error.message) {
                        message = error.message;
                    }
                    results.push({
                        endpoint,
                        success: false,
                        status,
                        statusText: error.response?.statusText,
                        responseTime,
                        message,
                        errorType: error.code || 'HTTP_ERROR',
                        errorDetails: error.response?.data?.message || error.message
                    });
                }
            }
            const successCount = results.filter(r => r.success).length;
            const totalCount = results.length;
            return {
                success: allSuccessful,
                message: allSuccessful
                    ? `All ${totalCount} endpoints successful`
                    : `${successCount}/${totalCount} endpoints successful`,
                responseTime: Math.round(totalTime / totalCount),
                results
            };
        }
        catch (error) {
            let message = 'Connection test failed';
            if (error.code === 'ECONNREFUSED') {
                message = 'Connection refused - service may be down';
            }
            else if (error.code === 'ETIMEDOUT') {
                message = 'Connection timeout';
            }
            else if (error.message) {
                message = error.message;
            }
            return { success: false, message };
        }
    }
    // Encriptar datos sensibles
    encrypt(text) {
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    }
    // Desencriptar datos sensibles
    decrypt(encryptedText) {
        try {
            const algorithm = 'aes-256-cbc';
            const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
            const textParts = encryptedText.split(':');
            const iv = Buffer.from(textParts.shift(), 'hex');
            const encrypted = textParts.join(':');
            const decipher = crypto.createDecipheriv(algorithm, key, iv);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return JSON.parse(decrypted);
        }
        catch (error) {
            console.error('Error decrypting auth config:', error);
            return {};
        }
    }
    // Encriptar configuración de autenticación para guardar
    encryptAuthConfig(authConfig) {
        return this.encrypt(JSON.stringify(authConfig));
    }
    // Limpiar conexión (remover de memoria)
    removeConnection(name) {
        return this.connections.delete(name);
    }
    // Obtener estadísticas de conexiones
    getConnectionStats() {
        return {
            total: this.connections.size,
            active: this.connections.size,
            connections: Array.from(this.connections.keys())
        };
    }
}
exports.ExternalApiService = ExternalApiService;
//# sourceMappingURL=externalApiService.js.map