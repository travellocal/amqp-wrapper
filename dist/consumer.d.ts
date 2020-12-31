import * as amqp from "amqplib";
import * as bunyan from "bunyan";
import { IQueueNameConfig } from "./common";
import { IRabbitMqConnectionFactory } from "./connectionFactory";
export declare type IRabbitMqConsumerDisposer = () => Promise<any>;
declare class Subscription<T> {
    private queueConfig;
    private action;
    private logger;
    private channel;
    private consumerTag;
    constructor(parentLogger: bunyan, queueConfig: IQueueNameConfig, action: (message: T) => Promise<any> | void);
    attach(connection: amqp.Connection): Promise<IRabbitMqConsumerDisposer>;
    cancel(): Promise<void>;
    protected getMessageObject<T>(message: amqp.Message): T;
    protected getChannelSetup(channel: amqp.Channel, queueConfig: IQueueNameConfig): any[];
    protected getQueueSettings(deadletterExchangeName: string): amqp.Options.AssertQueue;
    protected getDLSettings(): amqp.Options.AssertQueue;
    private establishChannel;
}
export declare class RabbitMqConsumer {
    private connectionFactory;
    private maxRetries;
    private interval;
    private logger;
    private connectionErrorHandler;
    connection: amqp.Connection;
    subscriptions: {
        [key: string]: Subscription<any>;
    };
    constructor(parentLogger: bunyan, connectionFactory: IRabbitMqConnectionFactory, maxRetries?: number);
    private retryCreateConnection;
    private establishConnection;
    private createSubscription;
    private handleConsumerConnectionFailure;
    subscribe<T>(queue: string | IQueueNameConfig, action: (message: T) => Promise<any> | void): Promise<IRabbitMqConsumerDisposer>;
}
export {};
