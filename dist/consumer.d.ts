/// <reference types="bluebird" />
import * as amqp from "amqplib";
import { IRabbitMqConnectionFactory } from "./connectionFactory";
import { Logger } from "bunyan";
import * as Promise from "bluebird";
import { IQueueNameConfig } from "./common";
export interface IRabbitMqConsumerDisposer {
    (): Promise<void>;
}
export declare class RabbitMqConsumer {
    private logger;
    private connectionFactory;
    constructor(logger: Logger, connectionFactory: IRabbitMqConnectionFactory);
    subscribe<T>(queue: string | IQueueNameConfig, action: (message: T) => Promise<any> | void): Promise<IRabbitMqConsumerDisposer>;
    private setupChannel<T>(channel, queueConfig);
    private subscribeToChannel<T>(channel, queueConfig, action);
    protected getMessageObject<T>(message: amqp.Message): T;
    protected getChannelSetup(channel: amqp.Channel, queueConfig: IQueueNameConfig): Promise<amqp.Replies.Empty>[];
    protected getQueueSettings(deadletterExchangeName: string): amqp.Options.AssertQueue;
    protected getDLSettings(): amqp.Options.AssertQueue;
}
