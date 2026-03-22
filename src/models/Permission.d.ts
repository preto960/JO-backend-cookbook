export declare enum ResourceType {
    DASHBOARD = "dashboard",
    MARKET = "market",
    PLUGINS = "plugins",
    USERS = "users",
    ROLES = "roles",
    SETTINGS = "settings",
    PROFILE = "profile",
    EXTERNAL_APIS = "external_apis"
}
export declare enum PermissionAction {
    VIEW = "view",
    CREATE = "create",
    EDIT = "edit",
    DELETE = "delete"
}
export declare class Permission {
    id: string;
    role: string;
    resource: string;
    pluginId: string | null;
    isDynamic: boolean;
    resourceLabel: string | null;
    resourceDescription: string | null;
    displayOrder: number;
    canInMenu: boolean;
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=Permission.d.ts.map