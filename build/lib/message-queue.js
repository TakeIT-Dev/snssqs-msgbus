"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageQueue = void 0;
const aws_sdk_1 = __importDefault(require("aws-sdk"));
;
class MessageQueue {
    constructor(awsRegion) {
        this.loopFn = async () => {
            while (this.status === 'RUNNING') {
                const pollingPromises = [];
                for (const s of this.subscriptions) {
                    const recvCall = this.sqsInstance.receiveMessage({
                        QueueUrl: s.url,
                        MaxNumberOfMessages: 1,
                        VisibilityTimeout: 120,
                        WaitTimeSeconds: 20,
                        MessageAttributeNames: ['command', 'originUuid'],
                    }).promise();
                    pollingPromises.push(recvCall);
                }
                const pollingResults = await Promise.all(pollingPromises);
                for (const [idx, r] of pollingResults.entries()) {
                    if (r.retryable !== undefined) {
                        const res = r;
                        console.error(`MessageQueue: Error while polling ${this.subscriptions[idx].name}. ${res.message}`, res);
                    }
                    else if (r.Messages !== undefined) {
                        const res = r;
                        await this.executeCallbackOnMessages(res.Messages, this.subscriptions[idx]);
                    }
                }
            }
        };
        this.sqsInstance = new aws_sdk_1.default.SQS({
            apiVersion: '2012-11-05',
            region: awsRegion,
        });
        this.status = 'STOPPED';
        this.timeoutHandler = undefined;
        this.subscriptions = [];
    }
    async executeCallbackOnMessages(messages, subInfo) {
        var _a, _b, _c, _d, _e, _f;
        for (const m of messages) {
            try {
                console.log(`Processing ${((_a = m.MessageAttributes.command) === null || _a === void 0 ? void 0 : _a.StringValue) || 'UndefinedCommand'}:${((_b = m.MessageAttributes.originUuid) === null || _b === void 0 ? void 0 : _b.StringValue) || 'UndefinedOriginUuid'}. MessageId ${m.MessageId}`);
                if (subInfo.cb.constructor.name === "AsyncFunction") {
                    await subInfo.cb(m.MessageId, m.Body, m.MessageAttributes);
                }
                else {
                    subInfo.cb(m.MessageId, m.Body, m.MessageAttributes);
                }
                await this.sqsInstance.deleteMessage({
                    ReceiptHandle: m.ReceiptHandle,
                    QueueUrl: subInfo.url,
                }).promise();
                console.log(`Finished ${((_c = m.MessageAttributes.command) === null || _c === void 0 ? void 0 : _c.StringValue) || 'UndefinedCommand'}:${((_d = m.MessageAttributes.originUuid) === null || _d === void 0 ? void 0 : _d.StringValue) || 'UndefinedOriginUuid'}. MessageId ${m.MessageId}`);
            }
            catch (err) {
                console.error(`Error processing ${((_e = m.MessageAttributes.command) === null || _e === void 0 ? void 0 : _e.StringValue) || 'UndefinedCommand'}:${((_f = m.MessageAttributes.originUuid) === null || _f === void 0 ? void 0 : _f.StringValue) || 'UndefinedOriginUuid'}. MessageId ${m.MessageId}`, err);
            }
        }
    }
    addSubscription(name, queueURL, callback) {
        const exists = this.subscriptions.map(s => s.url).indexOf(queueURL) > -1;
        if (exists) {
            throw new Error(`Queue subscription already exists for ${queueURL}`);
        }
        this.subscriptions.push({
            url: queueURL,
            cb: callback,
            name: name,
        });
    }
    removeSubscription(name) {
        const idx = this.subscriptions.map(s => s.name).indexOf(name);
        if (idx === -1) {
            throw new Error(`Queue sub '${name}' does not exists removing subscription.`);
        }
        this.subscriptions.splice(idx, 1);
    }
    run() {
        if (this.status === 'RUNNING') {
            throw new Error('Error: MessageQueue already running wen calling run()');
        }
        this.status = 'RUNNING';
        this.timeoutHandler = setTimeout(this.loopFn, 1);
    }
    stop() {
        if (this.status === 'STOPPED') {
            throw new Error('Error: MessageQueue already stoped wen calling stop()');
        }
        clearTimeout(this.timeoutHandler);
        this.status = 'STOPPED';
        this.timeoutHandler = undefined;
    }
    getStatus() {
        return this.status;
    }
}
exports.MessageQueue = MessageQueue;
//# sourceMappingURL=message-queue.js.map