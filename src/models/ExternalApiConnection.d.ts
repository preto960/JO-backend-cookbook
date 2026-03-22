export declare enum ApiConnectionType {
    REST = "rest",
    GRAPHQL = "graphql",
    WEBSOCKET = "websocket",
    SOAP = "soap"
}
export declare enum AuthenticationType {
    NONE = "none",
    API_KEY = "api_key",
    BEARER_TOKEN = "bearer_token",
    BASIC_AUTH = "basic_auth",
    OAUTH2 = "oauth2",
    CUSTOM_HEADER = "custom_header"
}
export declare class ExternalApiConnection {
    id: string;
    name: string;
    displayName: string;
    description?: string;
    baseUrl: string;
    type: ApiConnectionType;
    authType: AuthenticationType;
    authConfig?: string;
    defaultHeaders?: string;
    config?: string;
    isActive: boolean;
    isGlobal: boolean;
    testEndpoint?: string;
    testMethod: string;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=ExternalApiConnection.d.ts.map