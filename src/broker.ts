/*
A synchronous function-based message broker.
*/

import { CommandTypes, EventTypes, Payload } from "./writeModel";

export enum Channel {
    Commands = "Commands",
    EmittedEvents = "EmittedEvents",
    PersistedEvents = "PersistedEvents"
}

export enum BrokerResponse {
    Success = "Success",
    Failure = "Failure"
}

export interface Message {
    type: CommandTypes | EventTypes;
    timestamp: Date;
    payload: Payload;
}
 
export type MsgFunc = (msg: Message) => BrokerResponse;

export class Broker {

    private outbound: Map<string, MsgFunc[]>;
    private inbound: Map<string, MsgFunc>;
    public channels: Channel[];

    constructor() {
        this.outbound = new Map<string, MsgFunc[]>();
        this.inbound = new Map<string, MsgFunc>();
        this.channels = [
            Channel.Commands,
            Channel.EmittedEvents,
            Channel.PersistedEvents
        ]

        for (const c of this.channels) {
            this.outbound.set(c, []);
            this.inbound.set(c, (msg) => {
                this.outbound.get(c).forEach(msgFunc => msgFunc(msg))
                // ignoring the return values from subscribers for now
                return BrokerResponse.Success;
            });
        }
    }

    public addSubscriber(channel: Channel, recvFunc: MsgFunc): BrokerResponse {
        this.outbound.get(channel).push(recvFunc);
        return BrokerResponse.Success;
    }

    public addPublisher(channel: Channel): MsgFunc {
        return this.inbound.get(channel);
    }
}
