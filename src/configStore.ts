/*
Class to interface with json storage of user config variables
*/

import * as lowdb from "lowdb";
import * as FileSync from "lowdb/adapters/FileSync";
import { Views, Days, SortOptions, TaskViewOptions } from "./client";

// db schema
export type ConfigSchema = {
    isInitialized: boolean;
    name: string;
    weekStart: Days;
    dailyPlanningReminders: boolean;
    planningTime: Date;
    lastPlanningSession: Date;
    currentCategory: string;
    currentView: Views;
    numItemsToShow: number;
    defaultSort: SortOptions;
    hideCompleteTodos: boolean;
    taskViewOptions: TaskViewOptions;
    lastChronJob: Date;
}

type ConfigVal = Date | string | number | Views | Days | boolean;


export class ConfigStore {

    private database: lowdb.LowdbSync<ConfigSchema>;
    public store: ConfigSchema;

    constructor(source='config.json') {
        this.database = lowdb(new FileSync(source))

        // initialize new file if necessary
        if (!this.database.has('isInitialized').value()) {
            this.database.defaults({
                isInitialized: false,
                name: '',
                weekStart: Days.Monday,
                dailyPlanningReminders: false,
                planningTime: new Date('March 26, 2021 08:00:00'),
                lastPlanningSession: new Date('March 26, 2021 08:00:00'),
                currentCategory: '',
                currentView: Views.Daily,
                numItemsToShow: 30,
                defaultSort: SortOptions.Date,
                hideCompleteTodos: true,
                taskViewOptions: TaskViewOptions.All,
                lastChronJob: new Date('March 26, 2021 08:00:00')
            }).write()
        }
        this.store = this.database.getState()
    }

    // utility database methods

    private setStore = (): void => {
        // sets public view of database
        this.store = this.database.getState();
    }

    private editConfig = (key: string, val: ConfigVal): void => {
        this.database.set(key, val).write()
        this.setStore();
    }

    // public database setters

    public setName = (name: string): void => {
        this.editConfig('name', name);
    }

    public setWeekStart = (weekStart: Days): void => {
        this.editConfig('weekStart', weekStart);
    }

    public setDailyPlanningReminders = (reminders: boolean): void => {
        this.editConfig('dailyPlanningReminders', reminders);
    }

    public setPlanningTime = (time: Date): void => {
        this.editConfig('planningTime', time);
    }

    public setLastPlanningSession = (time: Date): void => {
        this.editConfig('lastPlanningSession', time);
    }

    public setCurrentCategory = (category: string): void => {
        this.editConfig('currentCategory', category);
    }

    public setCurrentView = (view: Views): void => {
        this.editConfig('currentView', view);
    }

    public setNumItemsToShow = (numItems: number): void => {
        this.editConfig('numItemsToShow', numItems);
    }

    public setDefaultSort = (sort: SortOptions): void => {
        this.editConfig('defaultSort', sort);
    }

    public setHideCompleteTodos = (hide: boolean): void => {
        this.editConfig('hideCompleteTodos', hide);
    }

    public setTaskViewOptions = (option: TaskViewOptions): void => {
        this.editConfig('taskViewOptions', option);
    }

    public resetLastChronJob = (): void => {
        this.editConfig('lastChronJob', new Date())
    }

    public initialized = (): void => {
        this.editConfig('isInitialized', true);
    }
}
