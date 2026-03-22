import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum ApiConnectionType {
  REST = 'rest',
  GRAPHQL = 'graphql',
  WEBSOCKET = 'websocket',
  SOAP = 'soap'
}

export enum AuthenticationType {
  NONE = 'none',
  API_KEY = 'api_key',
  BEARER_TOKEN = 'bearer_token',
  BASIC_AUTH = 'basic_auth',
  OAUTH2 = 'oauth2',
  CUSTOM_HEADER = 'custom_header'
}

@Entity('external_api_connections')
@Index(['name'], { unique: true })
export class ExternalApiConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string; // Nombre identificativo (ej: "stripe", "paypal", "sendgrid")

  @Column()
  displayName: string; // Nombre para mostrar en UI

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column()
  baseUrl: string; // URL base de la API

  @Column({
    type: 'enum',
    enum: ApiConnectionType,
    default: ApiConnectionType.REST
  })
  type: ApiConnectionType;

  @Column({
    type: 'enum',
    enum: AuthenticationType,
    default: AuthenticationType.NONE
  })
  authType: AuthenticationType;

  // Configuración de autenticación (encriptada)
  @Column({ type: 'text', nullable: true })
  authConfig?: string; // JSON encriptado con keys, tokens, etc.

  // Headers por defecto
  @Column({ type: 'text', nullable: true })
  defaultHeaders?: string; // JSON con headers por defecto

  // Configuración adicional (timeouts, retry, etc.)
  @Column({ type: 'text', nullable: true })
  config?: string; // JSON con configuración adicional

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isGlobal: boolean; // Si está disponible globalmente para todos los plugins

  // Test endpoint para verificar conectividad
  @Column({ nullable: true })
  testEndpoint?: string;

  // Método HTTP para test endpoint
  @Column({ default: 'GET' })
  testMethod: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}