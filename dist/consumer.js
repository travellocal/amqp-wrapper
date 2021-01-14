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
const childLogger_1 = require("./childLogger");
const common_1 = require("./common");
const STARTING_INTERVAL = 1000;
const MAX_INTERVAL = 30000;
const timeout = (ms) => { return new Promise(resolve => setTimeout(resolve, ms)); };
class Subscription {
    constructor(parentLogger, queueConfig, action) {
        this.queueConfig = queueConfig;
        this.action = action;
        this.logger = childLogger_1.createChildLogger(parentLogger, `${queueConfig.name} Subscription`);
    }
    ;
    attach(connection) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.establishChannel(connection);
            let msg;
            const queueName = this.queueConfig.name;
            const opts = yield this.channel.consume(queueName, (message) => __awaiter(this, void 0, void 0, function* () {
                try {
                    msg = this.getMessageObject(message);
                    this.logger.trace(`Message arrived from queue ${queueName}: (${JSON.stringify(msg)})`);
                    yield this.action(msg);
                    this.logger.trace(`Message processed from queue ${queueName}: (${JSON.stringify(msg)})`);
                    this.channel.ack(message);
                }
                catch (err) {
                    this.logger.error(err, `Message processing failed from queue ${queueName}: (${JSON.stringify(msg)})`);
                    this.channel.nack(message, false, false);
                }
            }));
            this.consumerTag = opts.consumerTag;
            this.logger.trace(`Subscribing to queue ${queueName} (${opts.consumerTag})`);
            return this.cancel.bind(this);
        });
    }
    ;
    cancel() {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.trace(`Cancelling existing channel for queue ${this.queueConfig.name} (${this.consumerTag})`);
            try {
                yield this.channel.cancel(this.consumerTag);
            }
            catch (err) {
                this.logger.warn(`Unable to cancel channel ${this.consumerTag}.`);
                this.logger.error(err);
            }
        });
    }
    getMessageObject(message) {
        return JSON.parse(message.content.toString("utf8"));
    }
    getChannelSetup(channel, queueConfig) {
        return [
            channel.assertQueue(queueConfig.name, this.getQueueSettings(queueConfig.dlx)),
            channel.assertQueue(queueConfig.dlq, this.getDLSettings()),
            channel.assertExchange(queueConfig.dlx, "fanout", this.getDLSettings()),
            channel.bindQueue(queueConfig.dlq, queueConfig.dlx, "*"),
        ];
    }
    getQueueSettings(deadletterExchangeName) {
        const settings = this.getDLSettings();
        settings.arguments = {
            "x-dead-letter-exchange": deadletterExchangeName,
        };
        return settings;
    }
    getDLSettings() {
        return {
            durable: true,
            autoDelete: false,
        };
    }
    establishChannel(connection) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.trace(`Establishing new channel to subscribe to queue ${this.queueConfig.name}`);
            const channel = yield connection.createChannel();
            yield Promise.all(this.getChannelSetup(channel, this.queueConfig));
            this.channel = channel;
        });
    }
}
class RabbitMqConsumer {
    constructor(parentLogger, connectionFactory, maxRetries = null) {
        this.connectionFactory = connectionFactory;
        this.maxRetries = maxRetries;
        this.subscriptions = {};
        this.logger = childLogger_1.createChildLogger(parentLogger, "RabbitMqConsumer");
        this.interval = 0;
    }
    retryCreateConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            let retry = true;
            let retries = 0;
            while (retry) {
                try {
                    retries += 1;
                    yield timeout(this.interval);
                    const connection = yield this.connectionFactory.create();
                    this.logger.trace(`Successfully connected after ${this.interval}ms.`);
                    retry = false;
                    retries = 0;
                    this.interval = 0;
                    return connection;
                }
                catch (err) {
                    if (this.maxRetries != null && retries >= this.maxRetries) {
                        this.logger.trace(`Attempted maximum number of allowed retries (${this.maxRetries}). Giving up.`);
                        retry = false;
                        retries = 0;
                        this.interval = 0;
                        throw err;
                    }
                    this.logger.trace(`Unable to connect after ${this.interval}ms. Retrying.`);
                    this.logger.error(err);
                    this.interval = Math.min(Math.max(STARTING_INTERVAL, this.interval * 2), MAX_INTERVAL);
                }
            }
        });
    }
    ;
    establishConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.trace("Establishing new connection for consumer.");
            this.connection = yield this.retryCreateConnection();
            if (this.connectionErrorHandler != null) {
                try {
                    this.connection.removeListener("error", this.connectionErrorHandler);
                }
                catch (_a) {
                    this.logger.warn("Unable to deregister old error handler. This may be because it was registered to an old connection.");
                }
            }
            const connectionErrorHandler = this.handleConsumerConnectionFailure.bind(this);
            this.connection.on("error", connectionErrorHandler);
            this.connectionErrorHandler = connectionErrorHandler;
        });
    }
    createSubscription(queueConfig, action) {
        return __awaiter(this, void 0, void 0, function* () {
            const subscription = new Subscription(this.logger, queueConfig, action);
            this.subscriptions[queueConfig.name] = subscription;
            return subscription.attach(this.connection);
        });
    }
    handleConsumerConnectionFailure() {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.error("Connection error - re-establishing connection and existing subscriptions.");
            this.connection = null;
            yield this.establishConnection();
            for (const queueName in this.subscriptions) {
                const subscripion = this.subscriptions[queueName];
                yield subscripion.cancel();
                yield subscripion.attach(this.connection);
            }
        });
    }
    subscribe(queue, action) {
        return __awaiter(this, void 0, void 0, function* () {
            const queueConfig = common_1.asQueueNameConfig(queue);
            yield this.establishConnection();
            return this.createSubscription(queueConfig, action);
        });
    }
}
exports.RabbitMqConsumer = RabbitMqConsumer;
