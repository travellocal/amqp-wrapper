"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const amqp = require("amqplib");
const childLogger_1 = require("./childLogger");
function isConnectionConfig(config) {
    if (config.host && config.port) {
        return true;
    }
}
class RabbitMqConnectionFactory {
    constructor(logger, config) {
        this.logger = logger;
        this.connection = isConnectionConfig(config) ? `amqp://${config.host}:${config.port}` : config;
        this.logger = childLogger_1.createChildLogger(logger, "RabbitMqConnectionFactory");
    }
    create() {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.debug("connecting to %s", this.connection);
            try {
                return yield amqp.connect(this.connection);
            }
            catch (err) {
                this.logger.error("failed to create connection '%s'", this.connection);
                return Promise.reject(err);
            }
        });
    }
}
exports.RabbitMqConnectionFactory = RabbitMqConnectionFactory;
class RabbitMqSingletonConnectionFactory {
    constructor(logger, config) {
        this.logger = logger;
        this.connection = isConnectionConfig(config) ? `amqp://${config.host}:${config.port}` : config;
    }
    create() {
        if (this.promise) {
            this.logger.trace("reusing connection to %s", this.connection);
            return this.promise;
        }
        this.logger.debug("creating connection to %s", this.connection);
        return this.promise = Promise.resolve(amqp.connect(this.connection));
    }
}
exports.RabbitMqSingletonConnectionFactory = RabbitMqSingletonConnectionFactory;
