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
const childLogger_1 = require("./childLogger");
const common_1 = require("./common");
class RabbitMqConsumer {
    constructor(logger, connectionFactory) {
        this.logger = logger;
        this.connectionFactory = connectionFactory;
        this.logger = childLogger_1.createChildLogger(logger, "RabbitMqConsumer");
    }
    subscribe(queue, action) {
        return __awaiter(this, void 0, void 0, function* () {
            const queueConfig = common_1.asQueueNameConfig(queue);
            const connection = yield this.connectionFactory.create();
            const channel = yield connection.createChannel();
            this.logger.trace("got channel for queue '%s'", queueConfig.name);
            yield this.setupChannel(channel, queueConfig);
            return this.subscribeToChannel(channel, queueConfig, action);
        });
    }
    setupChannel(channel, queueConfig) {
        this.logger.trace("setup '%j'", queueConfig);
        return Promise.all(this.getChannelSetup(channel, queueConfig));
    }
    subscribeToChannel(channel, queueConfig, action) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.trace("subscribing to queue '%s'", queueConfig.name);
            let msg;
            const opts = yield channel.consume(queueConfig.name, (message) => __awaiter(this, void 0, void 0, function* () {
                try {
                    msg = this.getMessageObject(message);
                    this.logger.trace("message arrived from queue '%s' (%j)", queueConfig.name, msg);
                    yield action(msg);
                    this.logger.trace("message processed from queue '%s' (%j)", queueConfig.name, msg);
                    channel.ack(message);
                }
                catch (err) {
                    this.logger.error(err, "message processing failed from queue '%j' (%j)", queueConfig, msg);
                    channel.nack(message, false, false);
                }
            }));
            this.logger.trace("subscribed to queue '%s' (%s)", queueConfig.name, opts.consumerTag);
            const disposer = () => {
                this.logger.trace("disposing subscriber to queue '%s' (%s)", queueConfig.name, opts.consumerTag);
                return Promise.resolve(channel.cancel(opts.consumerTag));
            };
            return disposer;
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
}
exports.RabbitMqConsumer = RabbitMqConsumer;
