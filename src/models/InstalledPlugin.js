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
exports.InstalledPlugin = exports.InstallationStatus = void 0;
const typeorm_1 = require("typeorm");
const User_1 = require("./User");
var InstallationStatus;
(function (InstallationStatus) {
    InstallationStatus["INSTALLING"] = "INSTALLING";
    InstallationStatus["INSTALLED"] = "INSTALLED";
    InstallationStatus["FAILED"] = "FAILED";
    InstallationStatus["UPDATING"] = "UPDATING";
    InstallationStatus["UNINSTALLING"] = "UNINSTALLING";
})(InstallationStatus || (exports.InstallationStatus = InstallationStatus = {}));
let InstalledPlugin = class InstalledPlugin {
};
exports.InstalledPlugin = InstalledPlugin;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], InstalledPlugin.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], InstalledPlugin.prototype, "publisherPluginId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], InstalledPlugin.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], InstalledPlugin.prototype, "slug", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], InstalledPlugin.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], InstalledPlugin.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], InstalledPlugin.prototype, "packageUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb' }),
    __metadata("design:type", Object)
], InstalledPlugin.prototype, "manifest", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], InstalledPlugin.prototype, "config", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: InstallationStatus,
        default: InstallationStatus.INSTALLING
    }),
    __metadata("design:type", String)
], InstalledPlugin.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], InstalledPlugin.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], InstalledPlugin.prototype, "autoUpdate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], InstalledPlugin.prototype, "installedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], InstalledPlugin.prototype, "lastActivatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], InstalledPlugin.prototype, "errorMessage", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], InstalledPlugin.prototype, "installedAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], InstalledPlugin.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { nullable: true }),
    __metadata("design:type", User_1.User)
], InstalledPlugin.prototype, "installer", void 0);
exports.InstalledPlugin = InstalledPlugin = __decorate([
    (0, typeorm_1.Entity)('installed_plugins')
], InstalledPlugin);
//# sourceMappingURL=InstalledPlugin.js.map