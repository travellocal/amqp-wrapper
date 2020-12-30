"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const rokot_log_1 = require("rokot-log");
const sinon = require("sinon");
const common_1 = require("../common");
const index_1 = require("../index");
const chai_1 = require("./chai");
const events_1 = require("events");
const amqp = require("amqplib");
const logger = rokot_log_1.ConsoleLogger.create("test", { level: "trace" });
const config = { host: "localhost", port: 5672 };
const invalidConfig = { host: "localhost", port: 5670 };
const queueName = "TestPC";
describe("RabbitMqSingletonConnectionFactory Test", () => {
    let factory;
    beforeEach(() => {
        factory = new index_1.RabbitMqSingletonConnectionFactory(logger, config);
    });
    it("Singleton Connection Factory should return singleton connection", () => __awaiter(void 0, void 0, void 0, function* () {
        const connections = yield Promise.all([
            factory.create(),
            factory.create(),
            factory.create()
        ]);
        chai_1.expect(connections).to.exist;
        chai_1.expect(connections.length).to.eq(3);
        for (const connection of connections) {
            chai_1.expect(connection).to.exist;
            chai_1.expect(connections[0]).to.equal(connection);
        }
    }));
    describe("connection error on first connection attempt", () => {
        let connectStub;
        beforeEach(() => {
            connectStub = sinon.stub(amqp, "connect");
            connectStub.rejects({
                code: "ENOTFOUND",
                syscall: "getaddrinfo",
                host: "myaddress"
            });
        });
        afterEach(() => {
            connectStub.restore();
        });
        it("should throw an error and not set a persistent connection if it can't connect", () => __awaiter(void 0, void 0, void 0, function* () {
            return chai_1.expect(factory.create()).to.eventually.be.rejected.then(v => {
                chai_1.expect(v).to.exist;
                chai_1.expect(v.code).to.eq("ENOTFOUND");
                chai_1.expect(factory.connectionPromise).to.equal(null);
            });
        }));
    });
    describe("connection error during operation", () => {
        let connectStub;
        let mockConnection;
        beforeEach(() => {
            mockConnection = new events_1.EventEmitter();
            connectStub = sinon.stub(amqp, "connect");
            connectStub.returns(mockConnection);
        });
        afterEach(() => {
            connectStub.restore();
        });
        it("should log an error and clear connection when an error is thrown by the existing connection", () => __awaiter(void 0, void 0, void 0, function* () {
            yield factory.create();
            chai_1.expect(factory.connectionPromise).to.be.a('promise');
            chai_1.expect(factory.connectionPromise).to.eventually.equal(mockConnection);
            mockConnection.emit('error', "I am an error object.");
            chai_1.expect(factory.connectionPromise).to.equal(null);
        }));
    });
});
describe("Invalid configuration", () => {
    let factory;
    beforeEach(() => {
        factory = new index_1.RabbitMqConnectionFactory(logger, invalidConfig);
    });
    it("ConnectionFactory: Invalid Connection config should fail create", () => {
        return chai_1.expect(factory.create()).to.eventually.be.rejected.then(v => {
            chai_1.expect(v).to.exist;
            chai_1.expect(v.code).to.eq("ECONNREFUSED");
        });
    });
    it("RabbitMqConsumer: Invalid Connection config should fail subscribe", () => {
        const consumer = new index_1.RabbitMqConsumer(logger, factory);
        return chai_1.expect(consumer.subscribe(queueName, m => { })).to.eventually.be.rejected.then(v => {
            chai_1.expect(v).to.exist;
            chai_1.expect(v.code).to.eq("ECONNREFUSED");
        });
    });
    it("RabbitMqProducer: Invalid Connection config should fail publish", () => {
        const producer = new index_1.RabbitMqProducer(logger, factory);
        return chai_1.expect(producer.publish(queueName, {})).to.eventually.be.rejected.then(v => {
            chai_1.expect(v).to.exist;
            chai_1.expect(v.code).to.eq("ECONNREFUSED");
        });
    });
});
describe("Valid configuration", () => {
    describe("Consumer", () => {
        let factory;
        let consumer;
        beforeEach(() => {
            factory = new index_1.RabbitMqSingletonConnectionFactory(logger, config);
            consumer = new index_1.RabbitMqConsumer(logger, factory);
        });
        it("should subscribe and dispose ok with simple queue name", () => __awaiter(void 0, void 0, void 0, function* () {
            const spy = sinon.spy();
            const disposer = yield consumer.subscribe(queueName, spy);
            chai_1.expect(disposer, "disposer should exist").to.exist;
            chai_1.expect(spy.callCount).to.be.eq(0, "Consumer spy should not have been called");
            return chai_1.expect(disposer()).to.eventually.be.fulfilled;
        }));
        it("should subscribe and dispose ok with queue config", () => __awaiter(void 0, void 0, void 0, function* () {
            const spy = sinon.spy();
            const disposer = yield consumer.subscribe(new common_1.DefaultQueueNameConfig(queueName), spy);
            chai_1.expect(disposer, "disposer should exist").to.exist;
            chai_1.expect(spy.callCount).to.be.eq(0, "Consumer spy should not have been called");
            return chai_1.expect(disposer()).to.eventually.be.fulfilled;
        }));
        it("should recieve message from Producer", () => __awaiter(void 0, void 0, void 0, function* () {
            const spy = sinon.spy();
            const disposer = yield consumer.subscribe(queueName, spy);
            const producer = new index_1.RabbitMqProducer(logger, factory);
            const msg = { data: "time", value: new Date().getTime() };
            yield chai_1.expect(producer.publish(queueName, msg)).to.eventually.be.fulfilled;
            yield new Promise((resolve) => setTimeout(resolve, 500));
            chai_1.expect(spy.callCount).to.be.eq(1, "Consumer spy should have been called once");
            sinon.assert.calledWithExactly(spy, msg);
            disposer();
        }));
        it("should DLQ message from Producer if action fails", () => __awaiter(void 0, void 0, void 0, function* () {
            const disposer = yield consumer.subscribe(queueName, m => Promise.reject(new Error("A fake error that should put messages on the DLQ")));
            const producer = new index_1.RabbitMqProducer(logger, factory);
            const msg = { data: "time", value: new Date().getTime() };
            yield producer.publish(queueName, msg);
            yield new Promise((resolve) => setTimeout(resolve, 500));
            disposer();
        }));
        it("should re-establish the connection and channel if there is a connection error", () => __awaiter(void 0, void 0, void 0, function* () {
            const spy = sinon.spy();
            const disposer = yield consumer.subscribe(queueName, spy);
            const firstConnection = consumer.connection;
            consumer.connection.emit("error", new Error("Oh no, I'm a connection error!"));
            yield new Promise((resolve) => setTimeout(resolve, 500));
            chai_1.expect(consumer.connection).to.exist;
            chai_1.expect(firstConnection).to.not.equal(consumer.connection);
            disposer();
        }));
        it("should not accumulate error handlers if there are multiple connection errors", () => __awaiter(void 0, void 0, void 0, function* () {
            const spy = sinon.spy();
            const disposer = yield consumer.subscribe(queueName, spy);
            consumer.connection.emit("error", new Error("Oh no, I'm a connection error!"));
            yield new Promise((resolve) => setTimeout(resolve, 500));
            consumer.connection.emit("error", new Error("Oh no, a second connection error!"));
            yield new Promise((resolve) => setTimeout(resolve, 500));
            chai_1.expect(consumer.connection).to.exist;
            chai_1.expect(consumer.connection.listenerCount("error")).to.equal(2);
            disposer();
        }));
        it("should receive messages from the queue before and after a connection error", () => __awaiter(void 0, void 0, void 0, function* () {
            const spy = sinon.spy();
            const disposer = yield consumer.subscribe(queueName, spy);
            const producer = new index_1.RabbitMqProducer(logger, factory);
            const msgOne = { data: "time", value: new Date().getTime() };
            yield chai_1.expect(producer.publish(queueName, msgOne)).to.eventually.be.fulfilled;
            yield new Promise((resolve) => setTimeout(resolve, 500));
            chai_1.expect(spy.callCount).to.be.eq(1, "Consumer spy should have been called once");
            consumer.connection.emit("error", new Error("Oh no, I'm a connection error!"));
            yield new Promise((resolve) => setTimeout(resolve, 500));
            const msgTwo = { data: "time", value: new Date().getTime() };
            yield chai_1.expect(producer.publish(queueName, msgTwo)).to.eventually.be.fulfilled;
            yield new Promise((resolve) => setTimeout(resolve, 500));
            chai_1.expect(spy.callCount).to.be.eq(2, "Consumer spy should have been called twice");
            sinon.assert.calledWith(spy.getCall(0), msgOne);
            sinon.assert.calledWith(spy.getCall(1), msgTwo);
            disposer();
        }));
    });
    describe("Producer", () => {
        it("should not leave channels open", () => __awaiter(void 0, void 0, void 0, function* () {
            const factory = new index_1.RabbitMqSingletonConnectionFactory(logger, config);
            const producer = new index_1.RabbitMqProducer(logger, factory);
            const connection = yield factory.create();
            const msg = { data: "time", value: new Date().getTime() };
            yield Promise.all([
                producer.publish(queueName, msg),
                producer.publish(queueName, msg),
            ]);
            const channels = connection.connection.channels;
            const openChannels = channels.filter(channel => channel !== null);
            chai_1.expect(openChannels.length).to.equal(1);
        }));
    });
    after(() => __awaiter(void 0, void 0, void 0, function* () {
        const factory = new index_1.RabbitMqConnectionFactory(logger, config);
        const queueConfig = new common_1.DefaultQueueNameConfig(queueName);
        const connection = yield factory.create();
        const channel = yield connection.createChannel();
        yield Promise.all([
            channel.deleteExchange(queueConfig.dlx),
            channel.deleteQueue(queueConfig.dlq),
            channel.deleteQueue(queueConfig.name),
        ]);
        connection.close();
    }));
});
