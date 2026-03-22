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
exports.ExternalApiConnection = exports.AuthenticationType = exports.ApiConnectionType = void 0;
const typeorm_1 = require("typeorm");
var ApiConnectionType;
(function (ApiConnectionType) {
    ApiConnectionType["REST"] = "rest";
    ApiConnectionType["GRAPHQL"] = "graphql";
    ApiConnectionType["WEBSOCKET"] = "websocket";
    ApiConnectionType["SOAP"] = "soap";
})(ApiConnectionType || (exports.ApiConnectionType = ApiConnectionType = {}));
var AuthenticationType;
(function (AuthenticationType) {
    AuthenticationType["NONE"] = "none";
    AuthenticationType["API_KEY"] = "api_key";
    AuthenticationType["BEARER_TOKEN"] = "bearer_token";
    AuthenticationType["BASIC_AUTH"] = "basic_auth";
    AuthenticationType["OAUTH2"] = "oauth2";
    AuthenticationType["CUSTOM_HEADER"] = "custom_header";
})(AuthenticationType || (exports.AuthenticationType = AuthenticationType = {}));
let ExternalApiConnection = class ExternalApiConnection {
};
exports.ExternalApiConnection = ExternalApiConnection;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ExternalApiConnection.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], ExternalApiConnection.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ExternalApiConnection.prototype, "displayName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ExternalApiConnection.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ExternalApiConnection.prototype, "baseUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ApiConnectionType,
        default: ApiConnectionType.REST
    }),
    __metadata("design:type", String)
], ExternalApiConnection.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: AuthenticationType,
        default: AuthenticationType.NONE
    }),
    __metadata("design:type", String)
], ExternalApiConnection.prototype, "authType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ExternalApiConnection.prototype, "authConfig", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ExternalApiConnection.prototype, "defaultHeaders", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ExternalApiConnection.prototype, "config", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], ExternalApiConnection.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], ExternalApiConnection.prototype, "isGlobal", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ExternalApiConnection.prototype, "testEndpoint", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'GET' }),
    __metadata("design:type", String)
], ExternalApiConnection.prototype, "testMethod", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ExternalApiConnection.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], ExternalApiConnection.prototype, "updatedAt", void 0);
exports.ExternalApiConnection = ExternalApiConnection = __decorate([
    (0, typeorm_1.Entity)('external_api_connections'),
    (0, typeorm_1.Index)(['name'], { unique: true })
], ExternalApiConnection);
//# sourceMappingURL=ExternalApiConnection.js.map