/// <reference types="bunyan" />
/// <reference types="node" />
import * as amqp from "amqplib";
import * as bunyan from "bunyan";
import { IQueueNameConfig } from "./common";
import { IRabbitMqConnectionFactory } from "./connectionFactory";
export declare class RabbitMqProducer {
    private logger;
    private connectionFactory;
    constructor(logger: bunyan, connectionFactory: IRabbitMqConnectionFactory);
    publish<T>(queue: string | IQueueNameConfig, message: T): Promise<void>;
    protected getMessageBuffer<T>(message: T): Buffer;
    protected getQueueSettings(deadletterExchangeName: string): amqp.Options.AssertQueue;
}
