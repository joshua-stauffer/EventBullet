EventBullet is a bullet-journal style organizational tool featuring notes, todos, and a time tracker. This overview is a way for me to organize my thoughts as I explore a new architecture, CQRS/Event-Sourcing.

The basic structure is built around a message broker. Usually this would be asynchronous and the system would be distributed, but since this application just runs as a local instance I decided to embrace the synchronous nature of the domain and keep it simple. The message broker supports two operations, requesting to be a channel publisher, or requesting to subscribe to a channel. All broker functions are expected to return a BrokerResponse indicating success or failure of the operation.

The Client captures user intent, translates it into one or more Command, and then publishes it to the Command channel. The UI is entirely functional, with three types of side effects:
- publishing Commands
- logging to the console
- interacting with the ConfigStore

The WriteModel listens to both the Command channel and the PersistedEvents channel. When it receives a Command, it attempts to translate it into an Event, sometimes first running some validation logic. If successful, it publishes the Event to the EmittedEvents channel. When it receives something on the PersistedEvents channel, it updates whatever local stores are necessary to successfully validate Commands.

The EventStore is a very basic json database of events. It listens to the EmittedEvents channel and saves any events it receives to the database. It then publishes the saved event to the PersistedEvents channel. The EventStore also has an interesting function playHistory, which starts from the beginning of the database and publishes each event to the PersistedEvents channel in chronological order. 

The ReadModel listens to the PersistedEvents channel and maintains useful aggregates of that data in a read side. These read sides are then directly available to the Client.

The ConfigStore operates separately from the rest of the application, and depends only on the Client. Any data which is useful to persist but not semantically meaningful to the domain gets saved here. For example, user preferences, view settings, and cron job logs don't reflect the domain in a meaningful way, and so are kept here instead.

The Server ties everything together by initializing each component and ensuring that everything is publishing/subscribing to the correct channels.

I want to return to the EventStore's playHistory method for just a moment. This is a useful idea in any CQRS structure, but particularly so here, where the ReadModel and WriteModel both rely on in-memory data structures to perform their tasks. Initializing the app is as easy as replaying the event history! On a scale like this one that seems to work fine, but in production or in a larger system they would likely depend on local snapshots of history, and only replay the full history after major changes were made to the code.

One important idea in the CQRS architecture is an Aggregate, which represents an encapsulation of transactions. Aggregates need to be able to validate data based only on themselves. In this case, the aggregate is one User, which happens to be a singleton! In a larger, perhaps web-based, version of this application, we could see multiple instances of users, and then the aggregate would start to become more apparent as a useful structure.

One last thought -- I dodged quite a bit of complexity by allowing the Broker to be synchronous. Larger, production systems would need to handle eventual consistency in the UI, since there would be a delay between the UI making Commands and the read sides eventually catching up, especially with a network involved.
