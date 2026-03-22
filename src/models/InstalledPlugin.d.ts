import { User } from './User';
export declare enum InstallationStatus {
    INSTALLING = "INSTALLING",
    INSTALLED = "INSTALLED",
    FAILED = "FAILED",
    UPDATING = "UPDATING",
    UNINSTALLING = "UNINSTALLING"
}
export declare class InstalledPlugin {
    id: string;
    publisherPluginId: string;
    name: string;
    slug: string;
    version: string;
    description: string;
    packageUrl: string;
    manifest: any;
    config: any;
    status: InstallationStatus;
    isActive: boolean;
    autoUpdate: boolean;
    installedBy: string;
    lastActivatedAt: Date;
    errorMessage: string;
    installedAt: Date;
    updatedAt: Date;
    installer: User;
}
//# sourceMappingURL=InstalledPlugin.d.ts.map