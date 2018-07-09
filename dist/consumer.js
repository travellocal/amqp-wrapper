"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Promise = require("bluebird");
const common_1 = require("./common");
const childLogger_1 = require("./childLogger");
class RabbitMqConsumer {
    constructor(logger, connectionFactory) {
        this.logger = logger;
        this.connectionFactory = connectionFactory;
        this.logger = childLogger_1.createChildLogger(logger, "RabbitMqConsumer");
    }
    subscribe(queue, action) {
        const queueConfig = common_1.asQueueNameConfig(queue);
        return this.connectionFactory.create()
            .then(connection => connection.createChannel())
            .then(channel => {
            this.logger.trace("got channel for queue '%s'", queueConfig.name);
            return this.setupChannel(channel, queueConfig)
                .then(() => this.subscribeToChannel(channel, queueConfig, action));
        });
    }
    setupChannel(channel, queueConfig) {
        this.logger.trace("setup '%j'", queueConfig);
        return Promise.all(this.getChannelSetup(channel, queueConfig));
    }
    subscribeToChannel(channel, queueConfig, action) {
        this.logger.trace("subscribing to queue '%s'", queueConfig.name);
        return channel.consume(queueConfig.name, (message) => {
            let msg;
            Promise.try(() => {
                msg = this.getMessageObject(message);
                this.logger.trace("message arrived from queue '%s' (%j)", queueConfig.name, msg);
                return action(msg);
            }).then(() => {
                this.logger.trace("message processed from queue '%s' (%j)", queueConfig.name, msg);
                channel.ack(message);
            }).catch((err) => {
                this.logger.error(err, "message processing failed from queue '%j' (%j)", queueConfig, msg);
                channel.nack(message, false, false);
            });
        }).then(opts => {
            this.logger.trace("subscribed to queue '%s' (%s)", queueConfig.name, opts.consumerTag);
            return (() => {
                this.logger.trace("disposing subscriber to queue '%s' (%s)", queueConfig.name, opts.consumerTag);
                return Promise.resolve(channel.cancel(opts.consumerTag)).return();
            });
        });
    }
    getMessageObject(message) {
        return JSON.parse(message.content.toString('utf8'));
    }
    getChannelSetup(channel, queueConfig) {
        return [
            channel.assertQueue(queueConfig.name, this.getQueueSettings(queueConfig.dlx)),
            channel.assertQueue(queueConfig.dlq, this.getDLSettings()),
            channel.assertExchange(queueConfig.dlx, 'fanout', this.getDLSettings()),
            channel.bindQueue(queueConfig.dlq, queueConfig.dlx, '*')
        ];
    }
    getQueueSettings(deadletterExchangeName) {
        var settings = this.getDLSettings();
        settings.arguments = {
            'x-dead-letter-exchange': deadletterExchangeName
        };
        return settings;
    }
    getDLSettings() {
        return {
            durable: true,
            autoDelete: false
        };
    }
}
exports.RabbitMqConsumer = RabbitMqConsumer;
