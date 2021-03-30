/*
Server function for Bullet Productivity app.
*/

import { Broker, Channel } from "./broker";
import { Client } from "./client";
import { EventStore } from "./eventStore";
import { ReadModel } from "./readModel";
import { WriteModel } from "./writeModel";

const serveApp = () => {
    const broker = new Broker();
    
    const publishEmittedEvent = broker.addPublisher(Channel.EmittedEvents);
    const writeModel = new WriteModel(publishEmittedEvent);
    broker.addSubscriber(Channel.Commands, writeModel.recvCommand)
    
    const publishPersistedEvent = broker.addPublisher(Channel.PersistedEvents)
    const store = new EventStore('db.json', publishPersistedEvent)
    broker.addSubscriber(Channel.EmittedEvents, store.recvEvent)
    
    const readModel = new ReadModel()
    broker.addSubscriber(Channel.PersistedEvents, readModel.recvEvent)

    const publishCommand = broker.addPublisher(Channel.Commands)
    const client = new Client(publishCommand, readModel);

    // load readSides
    store.playHistory();

    client.serve();
}

serveApp();
