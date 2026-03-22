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
exports.DashboardCard = exports.CardDataType = void 0;
const typeorm_1 = require("typeorm");
var CardDataType;
(function (CardDataType) {
    CardDataType["NUMBER"] = "number";
    CardDataType["PERCENTAGE"] = "percentage";
    CardDataType["CURRENCY"] = "currency";
})(CardDataType || (exports.CardDataType = CardDataType = {}));
let DashboardCard = class DashboardCard {
};
exports.DashboardCard = DashboardCard;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], DashboardCard.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DashboardCard.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DashboardCard.prototype, "icon", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DashboardCard.prototype, "endpoint", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DashboardCard.prototype, "secondaryTitle", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DashboardCard.prototype, "secondaryIcon", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DashboardCard.prototype, "secondaryEndpoint", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: CardDataType,
        nullable: true
    }),
    __metadata("design:type", String)
], DashboardCard.prototype, "secondaryDataType", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: CardDataType,
        default: CardDataType.NUMBER
    }),
    __metadata("design:type", String)
], DashboardCard.prototype, "dataType", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'decimal',
        precision: 3,
        scale: 1,
        default: 3.0
    }),
    __metadata("design:type", Number)
], DashboardCard.prototype, "columns", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], DashboardCard.prototype, "order", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], DashboardCard.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], DashboardCard.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], DashboardCard.prototype, "config", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], DashboardCard.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], DashboardCard.prototype, "updatedAt", void 0);
exports.DashboardCard = DashboardCard = __decorate([
    (0, typeorm_1.Entity)('dashboard_cards')
], DashboardCard);
//# sourceMappingURL=DashboardCard.js.map