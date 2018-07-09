"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const amqp = require("amqplib");
const Promise = require("bluebird");
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
        this.logger.debug("connecting to %s", this.connection);
        return Promise.resolve(amqp.connect(this.connection)).catch(err => {
            this.logger.error("failed to create connection '%s'", this.connection);
            return Promise.reject(err);
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
