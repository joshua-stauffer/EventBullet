import {
    // types
    Channel,
    BrokerResponse,
    Message,
    MsgFunc,
    // broker class
    Broker
} from "./broker";

import { CommandTypes, Payload } from "./writeModel";


// utility class
export class TestClient {
    send: MsgFunc;
    recv: MsgFunc;
    msg: Message;
    msgQ: Message[];

    constructor() {
        this.recv = (msg: Message) => {
            // saves incoming message:
            // handle message in whatever way makes sense
            this.msg = msg;
            this.msgQ.push(msg);
            return BrokerResponse.Success;
        }
        this.send = undefined;
        this.msg = null;
        this.msgQ = [];
    }
}

test("Check that Broker public methods and properties exist", () => {
    const broker = new Broker();
    expect(broker.addSubscriber).toBeDefined();
    expect(broker.addPublisher).toBeDefined();
    expect(broker.channels).toBeDefined();
});

test("Check Broker addSubscriber", () => {
    const broker = new Broker();
    const recv = (msg: Message) => BrokerResponse.Success;
    const res = broker.addSubscriber(Channel.Commands, recv);
    expect(res).toBe(BrokerResponse.Success);
})

test("Test that Broker subscribe and publish passes message", () => {

    const broker = new Broker();
    const client = new TestClient();
    
    broker.addSubscriber(Channel.Commands, client.recv);
    client.send = broker.addPublisher(Channel.Commands);

    expect(client.msg).toBeFalsy();
    const msg: Message = {
        type: CommandTypes.AddCategory,
        timestamp: new Date(),
        payload: {name: 'Test!'}
    }
    client.send(msg);
    expect(client.msg).toBe(msg)
})
