export declare enum SupportedLanguage {
    EN = "en",
    ES = "es"
}
export declare class Translation {
    id: string;
    key: string;
    language: SupportedLanguage;
    value: string;
    category: string | null;
    description: string | null;
    isSystem: boolean;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=Translation.d.ts.map