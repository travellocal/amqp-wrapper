"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const amqp = require("amqplib");
const childLogger_1 = require("./childLogger");
function isConnectionConfig(config) {
    return config.host !== undefined && config.port !== undefined;
}
class ConnectionFactoryBase {
    constructor(parentLogger, config) {
        this.address = isConnectionConfig(config) ? `amqp://${config.host}:${config.port}` : config;
        this.logger = childLogger_1.createChildLogger(parentLogger, "RabbitMqConnectionFactory");
    }
    _connect() {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.debug("Connecting to %s", this.address);
            try {
                return yield amqp.connect(this.address);
            }
            catch (err) {
                this.logger.error("Failed to create connection '%s'", this.address);
                return Promise.reject(err);
            }
        });
    }
}
exports.ConnectionFactoryBase = ConnectionFactoryBase;
class RabbitMqConnectionFactory extends ConnectionFactoryBase {
    create() {
        return __awaiter(this, void 0, void 0, function* () {
            return this._connect();
        });
    }
}
exports.RabbitMqConnectionFactory = RabbitMqConnectionFactory;
class RabbitMqSingletonConnectionFactory extends ConnectionFactoryBase {
    create() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.connectionPromise) {
                this.logger.trace("reusing connection to %s", this.address);
            }
            else {
                this.connectionPromise = this._connect();
                const connection = yield this.connectionPromise;
                connection.on('error', this.handleConnectionFailure);
            }
            return this.connectionPromise;
        });
    }
    handleConnectionFailure(err) {
        this.logger.error("Error is happening");
        this.logger.error(err);
        this.connectionPromise = null;
    }
}
exports.RabbitMqSingletonConnectionFactory = RabbitMqSingletonConnectionFactory;
