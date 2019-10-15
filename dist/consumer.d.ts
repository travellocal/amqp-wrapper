/// <reference types="bunyan" />
import * as amqp from "amqplib";
import * as bunyan from "bunyan";
import { IQueueNameConfig } from "./common";
import { IRabbitMqConnectionFactory } from "./connectionFactory";
export declare type IRabbitMqConsumerDisposer = () => Promise<any>;
export declare class RabbitMqConsumer {
    private logger;
    private connectionFactory;
    constructor(logger: bunyan, connectionFactory: IRabbitMqConnectionFactory);
    subscribe<T>(queue: string | IQueueNameConfig, action: (message: T) => Promise<any> | void): Promise<IRabbitMqConsumerDisposer>;
    private setupChannel<T>(channel, queueConfig);
    private subscribeToChannel<T>(channel, queueConfig, action);
    protected getMessageObject<T>(message: amqp.Message): T;
    protected getChannelSetup(channel: amqp.Channel, queueConfig: IQueueNameConfig): any[];
    protected getQueueSettings(deadletterExchangeName: string): amqp.Options.AssertQueue;
    protected getDLSettings(): amqp.Options.AssertQueue;
}
