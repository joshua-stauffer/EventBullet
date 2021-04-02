/*
An in memory data store of Read Sides for a CQRS event-source application. 
*/

import {
    Event,
    EventTypes,
} from "./writeModel";
import {
    BrokerResponse
} from "./broker";

export interface Note {
    GUID: GUID;
    name: string;
    text: string;
    category: string;
    timestamp: Date;
}

export interface Todo {
    GUID: GUID;
    name: string;
    text: string;
    category: string;
    timestamp: Date;
    dueDate: Date | null;
    complete: boolean;
    timeCompleted: Date | null;
    scheduled?: Frequency;
}

export interface Task {
    GUID: GUID;
    name: string;
    category: string;
    taskDelta: number;
    timestamp: Date;
}

export enum Frequency {
    Never = "Never",
    Daily = "Daily",
    // weekly
}

type GUID = string;
type EventHandler = (event: Event) => BrokerResponse;

export class ReadModel {
    
    public categories: string[];
    public notes: Note[];
    public todos: Todo[];
    public tasks: Task[];
    public timeline: GUID[];
    public eventMap: Map<GUID, Note | Todo | Task>;
    private eventHandlerMap: Map<EventTypes, EventHandler>;

    constructor() {
        this.categories = [];
        this.notes = [];
        this.todos = [];
        this.tasks = [];
        this.timeline = [];
        this.eventMap = new Map();

        this.eventHandlerMap = new Map([
            [EventTypes.CategoryAdded, this.handleCategoryAdded],
            [EventTypes.NoteAdded, this.handleNoteAdded],
            [EventTypes.TodoAdded, this.handleTodoAdded],
            [EventTypes.TodoMarkedComplete, this.handleTodoMarkedComplete],
            [EventTypes.TodoMarkedIncomplete, this.handleTodoMarkedIncomplete],
            [EventTypes.TodoDueDateUpdated, this.handleTodoDueDateUpdated],
            [EventTypes.TodoScheduled, this.handleTodoScheduled],
            [EventTypes.TaskLogged, this.handleTaskLogged]
        ]);
    }

    public recvEvent = (event: Event): BrokerResponse => {
        const handler = this.getEventHandler(event.type);
        return handler(event);
    }

    private getEventHandler = (eventType: EventTypes): EventHandler => {
        return this.eventHandlerMap.get(eventType)
    }

    // Event Handlers

    private handleCategoryAdded = (event: Event): BrokerResponse => {
        
        this.categories.push(event.payload.name)
        return BrokerResponse.Success;
    }

    private handleNoteAdded = (event: Event): BrokerResponse => {
        
        const note = {
            GUID: event.payload.GUID,
            name: event.payload.name,
            text: event.payload.text,
            timestamp: new Date(event.timestamp),
            category: event.payload.category
        }
        this.notes.push(note);
        this.timeline.push(event.payload.GUID);
        this.eventMap.set(event.payload.GUID, note);
        return BrokerResponse.Success;
    }

    private handleTodoAdded = (event: Event): BrokerResponse => {
        
        const todo: Todo = {
            GUID: event.payload.GUID,
            name: event.payload.name,
            text: event.payload.text,
            timestamp: new Date(event.timestamp),
            dueDate: event.payload.dueDate ? new Date(event.payload.dueDate) : null,
            category: event.payload.category,
            complete: false,
            timeCompleted: null,
            scheduled: Frequency.Never
        }
        this.todos.push(todo);
        this.timeline.push(event.payload.GUID);
        this.eventMap.set(event.payload.GUID, todo)
        return BrokerResponse.Success;
    }

    private handleTodoMarkedComplete = (event: Event): BrokerResponse => {
        
        // change eventMap todo
        const e = this.eventMap.get(event.payload.GUID) as Todo;
        e.complete = true;
        e.timeCompleted = new Date(event.timestamp);
        e.dueDate = null;
        // change todo list
        const t = this.todos.find(e => e.GUID === event.payload.GUID);
        t.complete = true;
        t.timeCompleted = new Date(event.timestamp);
        t.dueDate = null;

        return BrokerResponse.Success;
    }

    private handleTodoMarkedIncomplete = (event: Event): BrokerResponse => {
        // this event will be triggered even when another 'completing' action takes place
        // i.e. handleTodoScheduled or handleTodoUpdated (a separate TodoMarkedIncomplete
        // event must be emitted)
        
        // change eventMap todo
        const e = this.eventMap.get(event.payload.GUID) as Todo;
        e.complete = false;
        e.timeCompleted = null;
        // change todo list
        const t = this.todos.find(e => e.GUID === event.payload.GUID);
        t.complete = false;
        t.timeCompleted = null;

        return BrokerResponse.Success;
    }

    private handleTodoDueDateUpdated = (event: Event): BrokerResponse => {
        
        // change eventMap todo
        const e = this.eventMap.get(event.payload.GUID) as Todo;
        e.dueDate = new Date(event.payload.dueDate);
        // change todo list
        const t = this.todos.find(e => e.GUID === event.payload.GUID);
        t.dueDate = new Date(event.payload.dueDate);

        return BrokerResponse.Success;

    }

    private handleTodoScheduled = (event: Event): BrokerResponse => {

        // change eventMap todo
        const e = this.eventMap.get(event.payload.GUID) as Todo;
        e.scheduled = event.payload.scheduled;
        // change todo list
        this.todos.find(e => e.GUID === event.payload.GUID).scheduled = event.payload.scheduled;

        return BrokerResponse.Success;
    }

    private handleTaskLogged = (event: Event): BrokerResponse => {

        const parentTodo = this.todos.find(todo => todo.GUID === event.payload.GUID);
        const task: Task = {
            taskDelta: event.payload.taskDelta,
            GUID: parentTodo.GUID,
            name: parentTodo.name,
            category: parentTodo.category,
            timestamp: new Date(event.timestamp)
        };
        this.tasks.push(task)
        this.timeline.push(task.GUID);
        this.eventMap.set(task.GUID, task);

        return BrokerResponse.Success;
    }
}
