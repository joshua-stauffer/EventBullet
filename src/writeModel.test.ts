import {
    // types
    CommandTypes,
    Command,
    EventTypes,
    // class
    WriteModel
} from "./writeModel";
import {
    Channel,
    Broker
} from "./broker";
import { TestClient } from "./broker.test";


test("Test that Command turns into Event", () => {
    
    const broker = new Broker();
    const wm = new WriteModel(broker.addPublisher(Channel.EmittedEvents));
    const db = new TestClient();
    broker.addSubscriber(Channel.Commands, wm.recvCommand);
    broker.addSubscriber(Channel.EmittedEvents, db.recv);
    const commandPublisher = broker.addPublisher(Channel.Commands)

    const createCategoryCommand: Command = {
        type: CommandTypes.AddCategory,
        timestamp: new Date(),
        payload: {name: 'Test!'}
    }
    expect(db.msg).toBe(null);
    commandPublisher(createCategoryCommand);
    // gotta stringify because toBe expects memory equality for objects
    expect(JSON.stringify(db.msg)).toBe(JSON.stringify({
        type: EventTypes.CategoryAdded,
        timestamp: createCategoryCommand.timestamp,
        payload: createCategoryCommand.payload
    }))
})
