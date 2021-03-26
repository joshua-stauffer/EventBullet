/* 
Implementation of CQRS write model using an event-source architecture.
Expects to be initialized with a message broker to communicate with client and database.
*/

import { v4 } from "uuid";
import { MsgFunc, Message, BrokerResponse } from "./broker";
import { Frequency } from "./readModel";

export enum CommandTypes {
    AddNewTodo = "Add a new Todo",
    AddNewNote = "Add a new Note",
    AddCategory = "Add a new Category",
    MarkTodoComplete = "Mark Todo Complete",
    MarkTodoIncomplete = "Mark Todo Incomplete",
    UpdateTodoDueDate = "Update Todo Due Date",
    ScheduleTodo = "Schedule Todo",
    StartLog = "Start logging a task",
    StopLog = "Stop log"
}

export interface Payload {
    name?: string;
    text?: string;
    GUID?: string;
    category?: string;
    dueDate?: Date;
    taskDelta?: number;
    scheduled?: Frequency;
}

export interface Event {
    timestamp: Date;
    type: EventTypes;
    payload: Payload;
}

export interface NoEvent {
    message: ErrorMessage | LogMessage;
}

export enum ErrorMessage {
    CategoryAlreadyExists = "CategoryAlreadyExists",
    TaskLogNeverStarted = "TaskLogNeverStarted"
}

export enum LogMessage {
    TaskStarted = "Task Started"
}

export interface Command {
    type: CommandTypes;
    timestamp: Date;
    payload: Payload;
}

export enum EventTypes {
    CategoryAdded = 'CategoryAdded',
    NoteAdded = 'NoteAdded',
    NoteTextUpdated = 'NoteTextUpdated',
    NoteCategoryUpdated = 'NoteCategoryUpdated',
    TodoAdded = 'TodoAdded',
    TodoDueDateUpdated = 'TodoDueDateUpdated',
    TodoMarkedComplete = 'TodoMarkedComplete',
    TodoMarkedIncomplete = 'TodoMarkedIncomplete',
    TodoCategoryChanged = 'TodoCategoryChanged',
    TodoTitleChanged = 'TodoTitleChanged',
    TodoDescriptionChanged = 'TodoDescriptionChanged',
    TodoScheduled = 'TodoScheduled',
    TaskLogged = 'TaskLogged'
}

export type CommandHandler = (command: Message) => Event | NoEvent;

enum Validators {
    Category = "Category",
    Log = "Log"
}
type CategoryData = string[];
type LogData = {
    GUID: string;
    timestamp: Date;
};
type ValidatorData = CategoryData | LogData;

export class WriteModel {

    private sendEvent: MsgFunc;
    private commandHandlers: Map<CommandTypes, CommandHandler>;
    private validators: Map<Validators, ValidatorData>

    constructor( sendEvent: MsgFunc) {
        this.sendEvent = sendEvent;

        this.commandHandlers = new Map([
            [CommandTypes.AddCategory, this.handleAddCategory],
            [CommandTypes.AddNewNote, this.handleAddNewNote],
            [CommandTypes.AddNewTodo, this.handleAddTodo],
            [CommandTypes.MarkTodoComplete, this.handleMarkTodoComplete],
            [CommandTypes.MarkTodoIncomplete, this.handleMarkTodoIncomplete],
            [CommandTypes.UpdateTodoDueDate, this.handleUpdateTodoDueDate],
            [CommandTypes.ScheduleTodo, this.handleScheduleTodo],
            [CommandTypes.StartLog, this.handleStartLog],
            [CommandTypes.StopLog, this.handleStopLog]
        ])
        this.validators = new Map([
            [Validators.Category, [] as CategoryData],
            [Validators.Log, undefined], 
        ])

    }

    public recvCommand = (command: Command): BrokerResponse => {
        // transform command to event
        const handler = this.commandHandlers.get(command.type)
        const eventOrNoEvent = handler(command)

        if ('message' in eventOrNoEvent) {
            // NoEvent: check for error
            if (eventOrNoEvent.message === 'CategoryAlreadyExists' || 'TaskLogNeverStarted') {
                return BrokerResponse.Failure
            } else if (eventOrNoEvent.message === 'Task Started') {
                return BrokerResponse.Success
            } else {
                console.log('heres the event', eventOrNoEvent)
                throw new Error('Unknown NoEvent passed to WriteModel.recvCommand')
            }
            
        }
        
        // send event to broker
        this.sendEvent(eventOrNoEvent)

        return BrokerResponse.Success;
    }

    public recvPersistedEvents = (event: Event): BrokerResponse => {
        // subscribe to persistedEvents stream to update validation models
        switch (event.type) {

            case EventTypes.CategoryAdded:
                const categoryData = this.validators.get(Validators.Category) as CategoryData;
                categoryData.push(event.payload.name)
                return BrokerResponse.Success;

            default:
                return BrokerResponse.Success;
        }
        
    }

    // command handlers

    private handleAddCategory = (command: Command): Event | NoEvent => {
        
        // validate category name
        const categories = this.validators.get(Validators.Category) as CategoryData;
        if (categories.some(name => name === command.payload.name)) {
            return {
                message: ErrorMessage.CategoryAlreadyExists
            }
        }

        return {
            type: EventTypes.CategoryAdded,
            timestamp: command.timestamp,
            payload: command.payload
        }
    }

    private handleAddNewNote = (command: Command): Event | NoEvent => {
        return {
            type: EventTypes.NoteAdded,
            timestamp: command.timestamp,
            payload: {
                ...command.payload,
                GUID: v4()
            }
        }
    }

    private handleAddTodo = (command: Command): Event | NoEvent => {
        return {
            type: EventTypes.TodoAdded,
            timestamp: command.timestamp,
            payload: {
                ...command.payload,
                GUID: v4()
            }
        }
    }

    private handleMarkTodoComplete = (command: Command): Event | NoEvent => {
        return {
            type: EventTypes.TodoMarkedComplete,
            timestamp: command.timestamp,
            payload: {
                GUID: command.payload.GUID
            }
        }
    }

    private handleMarkTodoIncomplete = (command: Command): Event | NoEvent => {
        return {
            type: EventTypes.TodoMarkedIncomplete,
            timestamp: command.timestamp,
            payload: {
                GUID: command.payload.GUID
            }
        }
    }

    private handleUpdateTodoDueDate = (command: Command): Event | NoEvent => {
        return {
            type: EventTypes.TodoDueDateUpdated,
            timestamp: command.timestamp,
            payload: {
                GUID: command.payload.GUID,
                dueDate: command.payload.dueDate
            }
        }
    }

    private handleScheduleTodo = (command: Command): Event | NoEvent => {

        return {
            type: EventTypes.TodoScheduled,
            timestamp: command.timestamp,
            payload: {
                scheduled: command.payload.scheduled,
                GUID: command.payload.GUID
            }
        }
    }

    private handleStartLog = (command: Command): Event | NoEvent => {
        // expects a todo GUID
        this.validators.set(Validators.Log, {
            GUID: command.payload.GUID,
            timestamp: command.timestamp
        });
        return { message: LogMessage.TaskStarted }
    }

    private handleStopLog = (command: Command): Event | NoEvent => {
        const taskStart = this.validators.get(Validators.Log) as LogData;
        console.log('got task start: ', taskStart)
        if (!taskStart) {
            return {
                message: ErrorMessage.TaskLogNeverStarted
            }
        }
        const taskDelta = command.timestamp.valueOf() - taskStart.timestamp.valueOf()
        // empty log cache
        this.validators.set(Validators.Log, undefined)
        
        const event = {
            type: EventTypes.TaskLogged,
            timestamp: taskStart.timestamp,
            payload: {
                GUID: taskStart.GUID,
                taskDelta: taskDelta
            }
        }
        console.log('in handleStopLog event is ', event)
        return event
    }

}
