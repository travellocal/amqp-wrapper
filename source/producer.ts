import * as amqp from "amqplib";
import * as bunyan from "bunyan";
import { createChildLogger } from "./childLogger";
import { asQueueNameConfig, IQueueNameConfig } from "./common";
import {IRabbitMqConnectionFactory} from "./connectionFactory";

export class RabbitMqProducer {
  constructor(private logger: bunyan, private connectionFactory: IRabbitMqConnectionFactory) {
    this.logger = createChildLogger(logger, "RabbitMqProducer");
  }

  public async publish<T>(queue: string | IQueueNameConfig, message: T): Promise<void> {
    const queueConfig = asQueueNameConfig(queue);
    const settings = this.getQueueSettings(queueConfig.dlx);

    const connection = await this.connectionFactory.create();
    const channel = await connection.createChannel();

    // Create the queue if it doesn't already exist - idempotent
    await channel.assertQueue(queueConfig.name, settings);

    if (!channel.sendToQueue(queueConfig.name, this.getMessageBuffer(message), { persistent: true })) {
      this.logger.error("unable to send message to queue '%j' {%j}", queueConfig, message);
      return Promise.reject(new Error("Unable to send message"));
    }
    this.logger.trace("message sent to queue '%s' (%j)", queueConfig.name, message);

    // Close channel after message has been published
    await channel.close();
  }

  protected getMessageBuffer<T>(message: T) {
    return new Buffer(JSON.stringify(message), "utf8");
  }

  protected getQueueSettings(deadletterExchangeName: string): amqp.Options.AssertQueue {
    return {
      durable: true,
      autoDelete: false,
      arguments: {
        "x-dead-letter-exchange": deadletterExchangeName,
      },
    };
  }
}
