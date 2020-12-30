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
class RabbitMqProducer {
    constructor(logger, connectionFactory) {
        this.logger = logger;
        this.connectionFactory = connectionFactory;
        this.logger = childLogger_1.createChildLogger(logger, "RabbitMqProducer");
    }
    publish(queue, message) {
        return __awaiter(this, void 0, void 0, function* () {
            const queueConfig = common_1.asQueueNameConfig(queue);
            const settings = this.getQueueSettings(queueConfig.dlx);
            this.logger.trace("Establishing new connection for producer.");
            const connection = yield this.connectionFactory.create();
            const channel = yield connection.createChannel();
            yield channel.assertQueue(queueConfig.name, settings);
            if (!channel.sendToQueue(queueConfig.name, this.getMessageBuffer(message), { persistent: true })) {
                this.logger.error("unable to send message to queue '%j' {%j}", queueConfig, message);
                return Promise.reject(new Error("Unable to send message"));
            }
            this.logger.trace("message sent to queue '%s' (%j)", queueConfig.name, message);
            yield channel.close();
        });
    }
    getMessageBuffer(message) {
        return new Buffer(JSON.stringify(message), "utf8");
    }
    getQueueSettings(deadletterExchangeName) {
        return {
            durable: true,
            autoDelete: false,
            arguments: {
                "x-dead-letter-exchange": deadletterExchangeName,
            },
        };
    }
}
exports.RabbitMqProducer = RabbitMqProducer;
