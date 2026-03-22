export declare enum CardDataType {
    NUMBER = "number",
    PERCENTAGE = "percentage",
    CURRENCY = "currency"
}
export declare class DashboardCard {
    id: string;
    title: string;
    icon: string;
    endpoint: string;
    secondaryTitle?: string;
    secondaryIcon?: string;
    secondaryEndpoint?: string;
    secondaryDataType?: CardDataType;
    dataType: CardDataType;
    columns: number;
    order: number;
    isActive: boolean;
    description?: string;
    config?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=DashboardCard.d.ts.map