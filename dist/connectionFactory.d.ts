/// <reference types="bluebird" />
import * as amqp from "amqplib";
import { Logger } from "bunyan";
import * as Promise from "bluebird";
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
    constructor(logger: Logger, config: IRabbitMqConnectionConfig | string);
    create(): Promise<amqp.Connection>;
}
export declare class RabbitMqSingletonConnectionFactory implements IRabbitMqConnectionFactory {
    private logger;
    private connection;
    private promise;
    constructor(logger: Logger, config: IRabbitMqConnectionConfig | string);
    create(): Promise<amqp.Connection>;
}
