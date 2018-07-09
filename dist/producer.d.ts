/// <reference types="node" />
import * as amqp from "amqplib";
import { IRabbitMqConnectionFactory } from "./connectionFactory";
import { Logger } from "bunyan";
import { IQueueNameConfig } from "./common";
export declare class RabbitMqProducer {
    private logger;
    private connectionFactory;
    constructor(logger: Logger, connectionFactory: IRabbitMqConnectionFactory);
    publish<T>(queue: string | IQueueNameConfig, message: T): Promise<void>;
    protected getMessageBuffer<T>(message: T): Buffer;
    protected getQueueSettings(deadletterExchangeName: string): amqp.Options.AssertQueue;
}
