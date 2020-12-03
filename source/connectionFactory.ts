/* tslint:disable:max-classes-per-file */
import * as amqp from "amqplib";
import * as bunyan from "bunyan";
import {createChildLogger} from "./childLogger";

export interface IRabbitMqConnectionFactory {
  create(): Promise<amqp.Connection>;
}

export interface IRabbitMqConnectionConfig {
  host: string;
  port: number;
}

function isConnectionConfig(config: IRabbitMqConnectionConfig | string): config is IRabbitMqConnectionConfig {
  return (config as IRabbitMqConnectionConfig).host !== undefined && (config as IRabbitMqConnectionConfig).port !== undefined;
}

export class ConnectionFactoryBase {

  protected address: string;
  protected logger: bunyan;

  constructor(parentLogger: bunyan, config: IRabbitMqConnectionConfig | string) {

    this.address = isConnectionConfig(config) ? `amqp://${config.host}:${config.port}` : config;
    this.logger = createChildLogger(parentLogger, "RabbitMqConnectionFactory");
  }

  protected async _connect(): Promise<amqp.Connection> {
    this.logger.debug("Connecting to %s", this.address);
    try {
      return await amqp.connect(this.address);
    } catch (err) {
      this.logger.error("Failed to create connection '%s'", this.address);
      return Promise.reject(err);
    }

  }
}
export class RabbitMqConnectionFactory extends ConnectionFactoryBase implements IRabbitMqConnectionFactory {

  public async create(): Promise<amqp.Connection> {
    return this._connect();
  }
}

export class RabbitMqSingletonConnectionFactory extends ConnectionFactoryBase implements IRabbitMqConnectionFactory {
  private connectionPromise: Promise<amqp.Connection>;

  public async create(): Promise<amqp.Connection> {
    // Check if we've started connecting elsewhere
    if (this.connectionPromise) {
      this.logger.trace("reusing connection to %s", this.address);
    } else {
        // Don't wait for the connection to be complete to assign it persistently
        this.connectionPromise = this._connect();
        const connection = await this.connectionPromise;
        connection.on('error', this.handleConnectionFailure);
    }
    return this.connectionPromise;
  }

  private handleConnectionFailure = (err): void => {
    this.logger.error("Connection error - clearing connection.")
    this.logger.error(err);
    // Clear connection
    this.connectionPromise = null;
  }

}
