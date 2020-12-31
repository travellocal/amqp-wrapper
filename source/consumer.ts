import * as amqp from "amqplib";
import * as bunyan from "bunyan";
import {createChildLogger} from "./childLogger";
import {asQueueNameConfig, IQueueNameConfig} from "./common";
import {IRabbitMqConnectionFactory} from "./connectionFactory";

export type IRabbitMqConsumerDisposer = () => Promise<any>;

// Exponential backoff intervals (ms)
const STARTING_INTERVAL = 1000
const MAX_INTERVAL = 30000

const timeout = (ms: number): Promise<void> => { return new Promise(resolve => setTimeout(resolve, ms))};

/** A persistent subscription class that is generated by the consumer for each queue to be consumed.
 *
 * The subscription class can be attached and re-attached to different connections while preserving queue
 * and action information, allowing recovery of the subscription after a connection error.
 */
class Subscription<T>{

  private logger: bunyan;
  private channel: amqp.Channel;
  private consumerTag: string;

  constructor(parentLogger: bunyan, private queueConfig: IQueueNameConfig, private action: (message: T) => Promise<any> | void) {
    this.logger = createChildLogger(parentLogger, `${queueConfig.name} Subscription`);
  };

  /** Attach the subscription to the supplied connection, ready to consume messages.
   *
   * Returns a method that can be used to cancel the connection when the client code is finished with the subscription.
   */
  public async attach(connection: amqp.Connection): Promise<IRabbitMqConsumerDisposer> {
    await this.establishChannel(connection);
    let msg: T;

    const queueName = this.queueConfig.name;
    const opts = await this.channel.consume(queueName, async (message) => {

      try {
        msg = this.getMessageObject<T>(message);
        this.logger.trace(`Message arrived from queue ${queueName}: (${JSON.stringify(msg)})`);
        await this.action(msg);
        this.logger.trace(`Message processed from queue ${queueName}: (${JSON.stringify(msg)})`);
        this.channel.ack(message);
      } catch (err) {
        this.logger.error(err, `Message processing failed from queue ${queueName}: (${JSON.stringify(msg)})`);
        this.channel.nack(message, false, false);
      }

    });

    this.consumerTag = opts.consumerTag;
    this.logger.trace(`Subscribing to queue ${queueName} (${opts.consumerTag})`);

    return this.cancel.bind(this);

  };

  /** Cancel the current channel being used by the subscriber.
   *
   * Used in error handling code to cancel the channel on a connection error, before establishing a new channel
   * for the subscriber.
   * Can also be used by client code to cancel the channel when it's finished with the subscriber.
   */
  public async cancel(): Promise<void> {
    this.logger.trace(`Cancelling existing channel for queue ${this.queueConfig.name} (${this.consumerTag})`);
    this.channel.cancel(this.consumerTag);
  }

  protected getMessageObject<T>(message: amqp.Message) {
    this.logger.trace(`Parsing message: ${message}`)
    return JSON.parse(message.content.toString("utf8")) as T;
  }

  protected getChannelSetup(channel: amqp.Channel, queueConfig: IQueueNameConfig) {
    return [
      channel.assertQueue(queueConfig.name, this.getQueueSettings(queueConfig.dlx)),
      channel.assertQueue(queueConfig.dlq, this.getDLSettings()),
      channel.assertExchange(queueConfig.dlx, "fanout", this.getDLSettings()),
      channel.bindQueue(queueConfig.dlq, queueConfig.dlx, "*"),
    ] as any[]; // This is because we're returning an array of Bluebird promises, which TypeScript hates
  }

  protected getQueueSettings(deadletterExchangeName: string): amqp.Options.AssertQueue {
    const settings = this.getDLSettings();
    settings.arguments = {
      "x-dead-letter-exchange": deadletterExchangeName,
    };
    return settings;
  }

  protected getDLSettings(): amqp.Options.AssertQueue {
    return {
      durable: true,
      autoDelete: false,
    };
  }

  private async establishChannel(connection: amqp.Connection): Promise<void> {
    this.logger.trace(`Establishing new channel to subscribe to queue ${this.queueConfig.name}`)
    const channel = await connection.createChannel();
    await Promise.all(this.getChannelSetup(channel, this.queueConfig));
    this.channel = channel;
  }

}
export class RabbitMqConsumer {

  private interval: number;
  private logger: bunyan;
  private connectionErrorHandler;
  public connection: amqp.Connection;
  public subscriptions: {[key: string]: Subscription<any>} = {}; // Object containing existing subscriptions - one per queue

  constructor(parentLogger: bunyan, private connectionFactory: IRabbitMqConnectionFactory, private maxRetries: number = null) {
    this.logger = createChildLogger(parentLogger, "RabbitMqConsumer");
    this.interval = 0;
  }

  private async retryCreateConnection(): Promise<amqp.Connection> {

    let retry = true;
    let retries = 0;

    while (retry) {
      try {
        retries += 1;

        await timeout(this.interval);
        const connection = await this.connectionFactory.create();
        this.logger.trace(`Successfully connected after ${this.interval}ms.`)

        retry = false;
        retries = 0;
        this.interval = 0;
        return connection;

      } catch (err) {
        if (this.maxRetries != null && retries >= this.maxRetries) {
          this.logger.trace(`Attempted maximum number of allowed retries (${this.maxRetries}). Giving up.`)
          retry = false;
          retries = 0;
          this.interval = 0;
          throw err;
        }
        this.logger.trace(`Unable to connect after ${this.interval}ms.`)
        this.logger.warn(err);
        this.interval = Math.min(Math.max(STARTING_INTERVAL, this.interval*2), MAX_INTERVAL);
        this.logger.trace(`Retrying after ${this.interval}ms.`)
      }
    }

  };

  private async establishConnection(): Promise<void> {
    this.logger.trace("Establishing new connection for consumer.")

    this.connection = await this.retryCreateConnection();

    if (this.connectionErrorHandler != null) {
      try {
        this.logger.trace("Deregistering old error handler.")
        this.connection.removeListener("error", this.connectionErrorHandler)
      } catch {
        this.logger.warn("Unable to deregister old error handler. This may be because it was registered to an old connection.")
      }
    }
    const connectionErrorHandler = this.handleConsumerConnectionFailure.bind(this)
    this.logger.trace("Registering new error handler.")
    this.connection.on("error", connectionErrorHandler);
    this.connectionErrorHandler = connectionErrorHandler;
  }

  private async createSubscription<T>(queueConfig: IQueueNameConfig, action: (message: T) => Promise<any> | void): Promise<IRabbitMqConsumerDisposer> {
    const subscription = new Subscription<T>(this.logger, queueConfig, action);
    this.subscriptions[queueConfig.name] = subscription;
    return subscription.attach(this.connection);
  }

  private async handleConsumerConnectionFailure(): Promise<void> {
    this.logger.error("Connection error - re-establishing connection and existing subscriptions.");
    this.connection = null;
    await this.establishConnection();
    for (const queueName in this.subscriptions) {
      const subscripion = this.subscriptions[queueName];
      await subscripion.cancel();
      await subscripion.attach(this.connection);
    }
  }

  public async subscribe<T>(queue: string | IQueueNameConfig, action: (message: T) => Promise<any> | void): Promise<IRabbitMqConsumerDisposer> {
    const queueConfig = asQueueNameConfig(queue);
    await this.establishConnection();
    return this.createSubscription<T>(queueConfig, action);
  }
}
