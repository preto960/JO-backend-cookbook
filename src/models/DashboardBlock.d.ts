export declare enum BlockType {
    TABLE = "table",
    CHART = "chart",
    LIST = "list",
    METRIC = "metric"
}
export declare enum ChartType {
    LINE = "line",
    BAR = "bar",
    PIE = "pie",
    DOUGHNUT = "doughnut",
    AREA = "area"
}
export declare class DashboardBlock {
    id: string;
    title: string;
    type: BlockType;
    chartType?: ChartType;
    endpoint: string;
    columns: number;
    order: number;
    isActive: boolean;
    description?: string;
    config?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=DashboardBlock.d.ts.map