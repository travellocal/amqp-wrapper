/// <reference types="bunyan" />
import * as amqp from "amqplib";
import * as bunyan from "bunyan";
export interface IRabbitMqConnectionFactory {
    create(): Promise<amqp.Connection>;
}
export interface IRabbitMqConnectionConfig {
    host: string;
    port: number;
}
export declare class RabbitMqConnectionFactory implements IRabbitMqConnectionFactory {
    private logger;
    private connection;
    constructor(logger: bunyan, config: IRabbitMqConnectionConfig | string);
    create(): Promise<amqp.Connection>;
}
export declare class RabbitMqSingletonConnectionFactory implements IRabbitMqConnectionFactory {
    private logger;
    private connection;
    private promise;
    constructor(logger: bunyan, config: IRabbitMqConnectionConfig | string);
    create(): Promise<amqp.Connection>;
}
