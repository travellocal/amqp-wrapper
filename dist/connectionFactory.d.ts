import * as amqp from "amqplib";
import * as bunyan from "bunyan";
export interface IRabbitMqConnectionFactory {
    create(): Promise<amqp.Connection>;
}
export interface IRabbitMqConnectionConfig {
    host: string;
    port: number;
}
export declare class ConnectionFactoryBase {
    protected address: string;
    protected logger: bunyan;
    constructor(parentLogger: bunyan, config: IRabbitMqConnectionConfig | string);
    protected _connect(): Promise<amqp.Connection>;
}
export declare class RabbitMqConnectionFactory extends ConnectionFactoryBase implements IRabbitMqConnectionFactory {
    create(): Promise<amqp.Connection>;
}
export declare class RabbitMqSingletonConnectionFactory extends ConnectionFactoryBase implements IRabbitMqConnectionFactory {
    connectionPromise: Promise<amqp.Connection>;
    create(): Promise<amqp.Connection>;
    private handleConnectionFailure;
}
