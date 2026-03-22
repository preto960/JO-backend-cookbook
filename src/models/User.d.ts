export declare enum UserRole {
    USER = "USER",
    DEVELOPER = "DEVELOPER",
    ADMIN = "ADMIN"
}
export declare class User {
    id: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    bio?: string;
    website?: string;
    github?: string;
    twitter?: string;
    role: UserRole;
    isActive: boolean;
    lastLoginAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=User.d.ts.map