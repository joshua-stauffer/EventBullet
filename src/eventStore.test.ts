import {
    // types
    Channel,
    BrokerResponse,
    Message,
    MsgFunc,
    // broker class
    Broker
} from "./broker";
import {
    // types
    CommandTypes,
    Payload,
    Command,
    Event,
    EventTypes,
    CommandHandler,
    // class
    WriteModel
} from "./writeModel";
import { TestClient } from "./broker.test";
import { EventStore } from "./eventStore";


test("Test that EventStore exists", () => {
    const broker = new Broker();
    const es = new EventStore(
        'testDB.json',
        broker.addPublisher(Channel.PersistedEvents)
    )
    expect(es.playHistory).toBeDefined();
    expect(es.recvEvent).toBeDefined();
})

test("Test playHistory", () => {
    const broker = new Broker();
    const es = new EventStore(
        'testDB.json',
        broker.addPublisher(Channel.PersistedEvents)
    )
    const readSide = new TestClient();
    broker.addSubscriber(Channel.PersistedEvents, readSide.recv)

    const eventList = [
        {
            type: EventTypes.CategoryAdded,
            timestamp: new Date(),
            payload: {name: 'Test one!'}
        },
        {
            type: EventTypes.NoteAdded,
            timestamp: new Date(),
            payload: {name: 'Test two!'}
        },
        {
            type: EventTypes.TodoAdded,
            timestamp: new Date(),
            payload: {text: 'Test three!'}
        }
    ]
    for (const event of eventList) {
        es.recvEvent(event);
    }
    // todo: either teardown db or find a way to access exact number of entries
    expect(readSide.msgQ.length).toBe(eventList.length);
    es.playHistory();
    expect(readSide.msgQ.length).toBeGreaterThanOrEqual(eventList.length);
})
