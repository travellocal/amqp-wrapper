// tslint:disable:no-unused-expression
import * as BluebirdPromise from "bluebird";
import { ConsoleLogger } from "rokot-log";
import * as sinon from "sinon";
import { DefaultQueueNameConfig } from "../common";
import { IRabbitMqConnectionConfig, RabbitMqConnectionFactory, RabbitMqConsumer, RabbitMqProducer, RabbitMqSingletonConnectionFactory } from "../index";
import { expect } from "./chai";

const logger = ConsoleLogger.create("test", { level: "trace" });
const config: IRabbitMqConnectionConfig = { host: "localhost", port: 5672 };
const invalidConfig: IRabbitMqConnectionConfig = { host: "localhost", port: 5670 };
const queueName = "TestPC";

interface IMessage{
  data: string;
  value: number;
}

describe("RabbitMqSingletonConnectionFactory Test", () => {

  it("Singleton Connection Factory should return singleton connection", async () => {
    const factory = new RabbitMqSingletonConnectionFactory(logger, config);
    const connections = await Promise.all([
      factory.create(),
      factory.create(),
      factory.create()]);

    expect(connections).to.exist;
    expect(connections.length).to.eq(3);

    for (const connection of connections) {
      expect(connection).to.exist;
      // Since the connection is a singleton, all instances of the connection should be the same object
      expect(connections[0]).to.equal(connection);
    }

  });
});

describe("Invalid configuration", () => {

  let factory;
  beforeEach(() => {
    factory = new RabbitMqConnectionFactory(logger, invalidConfig);
  });

  it("ConnectionFactory: Invalid Connection config should fail create", () => {
    return expect(factory.create()).to.eventually.be.rejected.then(v => {
      expect(v).to.exist;
      expect(v.code).to.eq("ECONNREFUSED");
    });
  });

  it("RabbitMqConsumer: Invalid Connection config should fail subscribe", () => {
    const consumer = new RabbitMqConsumer(logger, factory);
    return expect(consumer.subscribe(queueName, m => {})).to.eventually.be.rejected.then(v => {
      expect(v).to.exist;
      expect(v.code).to.eq("ECONNREFUSED");
    });
  });

  it("RabbitMqProducer: Invalid Connection config should fail publish", () => {
    const producer = new RabbitMqProducer(logger, factory);
    return expect(producer.publish(queueName, {})).to.eventually.be.rejected.then(v => {
      expect(v).to.exist;
      expect(v.code).to.eq("ECONNREFUSED");
    });
  });

  },
);

describe("Valid configuration", () => {

  describe ("Consumer", () => {

    let factory: RabbitMqConnectionFactory;
    let consumer: RabbitMqConsumer;

    beforeEach(() => {
      factory = new RabbitMqConnectionFactory(logger, config);
      consumer = new RabbitMqConsumer(logger, factory);
    });

    it("should subscribe and dispose ok with simple queue name", async () => {
      const spy = sinon.spy();
      const disposer = await consumer.subscribe<IMessage>(queueName, spy);
      expect(disposer, "disposer should exist").to.exist;
      expect(spy.callCount).to.be.eq(0, "Consumer spy should not have been called");

      return expect(disposer()).to.eventually.be.fulfilled;
    });

    it("should subscribe and dispose ok with queue config", async () => {
      const spy = sinon.spy();
      const disposer = await consumer.subscribe<IMessage>(new DefaultQueueNameConfig(queueName), spy);
      expect(disposer, "disposer should exist").to.exist;
      expect(spy.callCount).to.be.eq(0, "Consumer spy should not have been called");

      return expect(disposer()).to.eventually.be.fulfilled;
    });

    it("should recieve message from Producer", async () => {
      const spy = sinon.spy()
      const disposer = await consumer.subscribe<IMessage>(queueName, spy);
      const producer = new RabbitMqProducer(logger, factory);
      const msg: IMessage = {data: "time", value: new Date().getTime()};

      await expect(producer.publish<IMessage>(queueName, msg)).to.eventually.be.fulfilled;
      // Welcome to integration testing - we need to wait for the message to actually be sent through RabbitMQ
      await BluebirdPromise.delay(500);

      expect(spy.callCount).to.be.eq(1, "Consumer spy should have been called once");
      sinon.assert.calledWithExactly(spy, msg);

      disposer();
    });

    it("should DLQ message from Producer if action fails", async () => {
      const disposer = await consumer.subscribe<IMessage>(queueName, m => BluebirdPromise.reject(new Error("A fake error that should put messages on the DLQ")));
      const producer = new RabbitMqProducer(logger, factory);
      const msg: IMessage = {data: "time", value: new Date().getTime()};

      await producer.publish<IMessage>(queueName, msg);
      await BluebirdPromise.delay(500);

      disposer();
    });
  });

  describe ("Producer", () => {
    it("should not leave channels open", async () => {
      const factory = new RabbitMqSingletonConnectionFactory(logger, config);
      const producer = new RabbitMqProducer(logger, factory);
      const connection = await factory.create();

      const msg: IMessage = {data: "time", value: new Date().getTime()};
      // Publishing a message should close the channel once it's done
      await Promise.all([
        producer.publish<IMessage>(queueName, msg),
        producer.publish<IMessage>(queueName, msg),
      ]);

      const channels: any[] = (connection as any).connection.channels;
      // amqp.node doesn't remove empty channels, it just leaves a null in the array - see https://github.com/squaremo/amqp.node/blob/master/lib/connection.js#L438
      const openChannels = channels.filter(channel => channel !== null);
      // There will always be one open channel to manage the connection
      expect(openChannels.length).to.equal(1);
    });
  });

  after( async () => {
    const factory = new RabbitMqConnectionFactory(logger, config);
    const queueConfig = new DefaultQueueNameConfig(queueName);
    const connection = await factory.create();
    const channel = await connection.createChannel();
    // After the tests, clear out the queue, as well as its dead letter queue, from RabbitMQ
    await BluebirdPromise.all([
      channel.deleteExchange(queueConfig.dlx),
      channel.deleteQueue(queueConfig.dlq),
      channel.deleteQueue(queueConfig.name),
    ]);
    connection.close();
  });
});
