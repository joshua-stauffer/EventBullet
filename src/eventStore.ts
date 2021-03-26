/*
Simple implementation of database layer in event source application.
Stores data in a local json file.
*/

import * as lowdb from "lowdb";
import * as FileSync from "lowdb/adapters/FileSync";
import { Event } from "./writeModel";
import { MsgFunc, BrokerResponse } from "./broker";


// db schema
type SchemaType = {
    events: Event[];
}


export class EventStore {

    private database: lowdb.LowdbSync<SchemaType>;
    private sendEvent: MsgFunc;

    constructor(source='db.json', sendEvent: MsgFunc) {
        this.database = lowdb(new FileSync(source))
        this.sendEvent = sendEvent

        // initialize new file if necessary
        if (!this.database.has('events').value()) {
            this.database.defaults({
                events: []
            }).write()
        }
    }

    public recvEvent = (event: Event): BrokerResponse => {
        this.saveEvent(event);
        this.sendEvent(event);
        return BrokerResponse.Success;
    }

    public playHistory = (): void => {
        const history = this.database.get('events').value();
        for (const event of history) {
            this.sendEvent(event)
        }
    }

    private saveEvent = (event: Event): void => {
        this.database.get('events').push(event).write()
    }
}
