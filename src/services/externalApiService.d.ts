import { ExternalApiConnection } from '../models/ExternalApiConnection';
import { AxiosInstance } from 'axios';
export declare class ExternalApiService {
    private connections;
    private repository;
    private encryptionKey;
    initializeConnections(): Promise<void>;
    createAxiosInstance(connection: ExternalApiConnection): Promise<AxiosInstance>;
    getConnection(name: string): AxiosInstance | null;
    getAvailableConnections(): string[];
    reloadConnection(connectionId: string): Promise<boolean>;
    testConnection(connectionId: string): Promise<{
        success: boolean;
        message: string;
        responseTime?: number;
        results?: any[];
    }>;
    encrypt(text: string): string;
    decrypt(encryptedText: string): any;
    encryptAuthConfig(authConfig: any): string;
    removeConnection(name: string): boolean;
    getConnectionStats(): {
        total: number;
        active: number;
        connections: string[];
    };
}
//# sourceMappingURL=externalApiService.d.ts.map