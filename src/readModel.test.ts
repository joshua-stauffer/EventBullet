import { ReadModel } from "./readModel";
import { EventTypes } from "./writeModel";
import { Broker, MsgFunc, Channel } from "./broker";


let rm: ReadModel;
let broker: Broker;
let publishEvent: MsgFunc;

beforeEach(() => {
    rm = new ReadModel();
    broker = new Broker();
    publishEvent = broker.addPublisher(Channel.PersistedEvents);
    broker.addSubscriber(Channel.PersistedEvents, rm.recvEvent);
})

afterEach(() => {
    rm = null;
    broker = null;
    publishEvent = null;
})

test("ReadModel sanity check", () => {
    expect(rm.categories.length).toBe(0);
    expect(rm.notes.length).toBe(0);
    expect(rm.todos.length).toBe(0);
    expect(rm.tasks.length).toBe(0);
    expect(rm.timeline.length).toBe(0);
    expect(rm.eventMap).toBeTruthy();
})


// test specific event handler methods
test("CategoryAdded handler", () => {
    const testName = "Test Category";
    publishEvent({
        type: EventTypes.CategoryAdded,
        timestamp: new Date(),
        payload: {
            name: testName
        }
    });

    expect(rm.categories[0]).toBe(testName);
    expect(rm.notes.length).toBe(0);
    expect(rm.todos.length).toBe(0);
    expect(rm.tasks.length).toBe(0);
    expect(rm.timeline.length).toBe(0);
})
