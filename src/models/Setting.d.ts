export declare enum SettingCategory {
    GENERAL = "general",
    PLUGINS = "plugins",
    SECURITY = "security",
    NOTIFICATIONS = "notifications",
    ADVANCED = "advanced",
    DASHBOARD = "dashboard",
    EXTERNAL_APIS = "external_apis"
}
export declare class Setting {
    id: string;
    key: string;
    value: string;
    category: SettingCategory;
    description?: string;
    isPublic: boolean;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=Setting.d.ts.map