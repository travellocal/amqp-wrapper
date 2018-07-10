import * as amqp from "amqplib";
import {Logger} from "bunyan";
import {createChildLogger} from "./childLogger";
import {asQueueNameConfig, IQueueNameConfig} from "./common";
import {IRabbitMqConnectionFactory} from "./connectionFactory";

export type IRabbitMqConsumerDisposer = () => Promise<any>;

export class RabbitMqConsumer {
  constructor(private logger: Logger, private connectionFactory: IRabbitMqConnectionFactory) {
    this.logger = createChildLogger(logger, "RabbitMqConsumer");
  }

  public async subscribe<T>(queue: string | IQueueNameConfig, action: (message: T) => Promise<any> | void): Promise<IRabbitMqConsumerDisposer> {
    const queueConfig = asQueueNameConfig(queue);
    const connection = await this.connectionFactory.create();
    const channel = await connection.createChannel();

    this.logger.trace("got channel for queue '%s'", queueConfig.name);
    await this.setupChannel<T>(channel, queueConfig);
    return this.subscribeToChannel<T>(channel, queueConfig, action);
  }

  private setupChannel<T>(channel: amqp.Channel, queueConfig: IQueueNameConfig) {
    this.logger.trace("setup '%j'", queueConfig);
    return Promise.all(this.getChannelSetup(channel, queueConfig));
  }

  private async subscribeToChannel<T>(channel: amqp.Channel, queueConfig: IQueueNameConfig, action: (message: T) => Promise<any> | void) {
    this.logger.trace("subscribing to queue '%s'", queueConfig.name);
    let msg: T;

    const opts = await channel.consume(queueConfig.name, async (message) => {

      try {
        msg = this.getMessageObject<T>(message);
        this.logger.trace("message arrived from queue '%s' (%j)", queueConfig.name, msg);
        await action(msg);
        this.logger.trace("message processed from queue '%s' (%j)", queueConfig.name, msg);
        channel.ack(message);
      } catch (err) {
        this.logger.error(err, "message processing failed from queue '%j' (%j)", queueConfig, msg);
        channel.nack(message, false, false);
      }

    });

    this.logger.trace("subscribed to queue '%s' (%s)", queueConfig.name, opts.consumerTag);

    const disposer: IRabbitMqConsumerDisposer = () => {
      this.logger.trace("disposing subscriber to queue '%s' (%s)", queueConfig.name, opts.consumerTag);
      return Promise.resolve(channel.cancel(opts.consumerTag));
    };

    return disposer;
  }

  protected getMessageObject<T>(message: amqp.Message) {
    return JSON.parse(message.content.toString("utf8")) as T;
  }

  protected getChannelSetup(channel: amqp.Channel, queueConfig: IQueueNameConfig) {
    return [
      channel.assertQueue(queueConfig.name, this.getQueueSettings(queueConfig.dlx)),
      channel.assertQueue(queueConfig.dlq, this.getDLSettings()),
      channel.assertExchange(queueConfig.dlx, "fanout", this.getDLSettings()),
      channel.bindQueue(queueConfig.dlq, queueConfig.dlx, "*")
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
}
