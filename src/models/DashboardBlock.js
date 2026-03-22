"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardBlock = exports.ChartType = exports.BlockType = void 0;
const typeorm_1 = require("typeorm");
var BlockType;
(function (BlockType) {
    BlockType["TABLE"] = "table";
    BlockType["CHART"] = "chart";
    BlockType["LIST"] = "list";
    BlockType["METRIC"] = "metric";
})(BlockType || (exports.BlockType = BlockType = {}));
var ChartType;
(function (ChartType) {
    ChartType["LINE"] = "line";
    ChartType["BAR"] = "bar";
    ChartType["PIE"] = "pie";
    ChartType["DOUGHNUT"] = "doughnut";
    ChartType["AREA"] = "area";
})(ChartType || (exports.ChartType = ChartType = {}));
let DashboardBlock = class DashboardBlock {
};
exports.DashboardBlock = DashboardBlock;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], DashboardBlock.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DashboardBlock.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: BlockType
    }),
    __metadata("design:type", String)
], DashboardBlock.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ChartType,
        nullable: true
    }),
    __metadata("design:type", String)
], DashboardBlock.prototype, "chartType", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DashboardBlock.prototype, "endpoint", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 12 }),
    __metadata("design:type", Number)
], DashboardBlock.prototype, "columns", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], DashboardBlock.prototype, "order", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], DashboardBlock.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], DashboardBlock.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], DashboardBlock.prototype, "config", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], DashboardBlock.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], DashboardBlock.prototype, "updatedAt", void 0);
exports.DashboardBlock = DashboardBlock = __decorate([
    (0, typeorm_1.Entity)('dashboard_blocks')
], DashboardBlock);
//# sourceMappingURL=DashboardBlock.js.map