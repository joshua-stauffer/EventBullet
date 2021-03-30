import { Client } from "./client";
import { ReadModel } from "./readModel";
import { EventTypes } from "./writeModel";
import { Broker, MsgFunc, Channel } from "./broker";


let rm: ReadModel;
let broker: Broker;
let publishCommand: MsgFunc;
let client: Client;

beforeEach(() => {
    rm = new ReadModel();
    broker = new Broker();
    publishCommand = broker.addPublisher(Channel.Commands);
    client = new Client(publishCommand, rm)
})

afterEach(() => {
    rm = null;
    broker = null;
    publishCommand = null;
    client = null;
})

test("Sanity check",  () => {
    expect(client).toBeTruthy();
})
