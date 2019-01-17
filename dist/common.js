"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class DefaultQueueNameConfig {
    constructor(name) {
        this.name = name;
        this.dlq = `${name}.DLQ`;
        this.dlx = `${this.dlq}.Exchange`;
    }
}
exports.DefaultQueueNameConfig = DefaultQueueNameConfig;
function asQueueNameConfig(config) {
    return isQueueNameConfig(config) ? config : new DefaultQueueNameConfig(config);
}
exports.asQueueNameConfig = asQueueNameConfig;
function isQueueNameConfig(config) {
    if (config.name && config.dlq && config.dlx) {
        return true;
    }
}
