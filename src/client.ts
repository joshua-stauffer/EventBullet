/*
Client-facing component of CQRS productivity app.
*/

import * as inquirer from "inquirer";
import { MsgFunc, BrokerResponse } from "./broker";
import {
    ConfigStore
} from "./configStore";
import { ReadModel, Note, Todo, Task, Frequency } from "./readModel";
import { Command, CommandTypes } from "./writeModel";


enum MainMenu {
    Create = "Create",
    Log = "Log",
    Complete = "Complete",
    Plan = "Plan",
    View = "Change View Options",
    Settings = "Settings",
    Quit = "Quit"
}

enum CreateMenu {
    Todo = "Create Todo",
    Note = "Create Note",
    Category = "Create Category",
    Incomplete = "Mark an existing Todo as incomplete",
    Back = "Back"
}

enum TodoScheduleOptions {
    Never = "Don't schedule this Todo",
    Today = "Today",
    Tomorrow = "Tomorrow",
    Two = "Two days from now",
    Three = "Three days from now",
    Four = "Four days from now",
    Five = "Five days from now",
    Six = "Six days from now",
    Seven = "One week from now",
    Fourteen = "Two weeks from now",
    TwentyOne = "Three weeks from now",
    Month = "One month from now",
}

export enum Views {
    Daily = "Daily",
    Weekly = "Weekly",
    All = "All",
    Summary = "Summary",
    Category = "Category",
    Todo = "Todo",
    Note = "Note",
    Task = "Task",
    Back = "Back"
}

enum ViewSelector {
    Today = "Today",
    ThisWeek = "This Week",
    All = "All",
    CurrentCategory = "CurrentCategory"
}

export enum Days {
    Monday = "Monday",
    Tuesday = "Tuesday",
    Wednesday = "Wednesday",
    Thursday = "Thursday",
    Friday = "Friday",
    Saturday = "Saturday",
    Sunday = "Sunday",
}

enum SettingsMenu {
    Name = "Edit name",
    WeekStartDay = "Week start day",
    DailyPlanningReminders = "Planning reminders",
    NumItemsToShow = "Max items per view",
    Sort = "Choose how to sort items",
    ChooseCategory = "Current Category",
    HideCompleteTodos = "Toggle Hide Complete Todos",
    ChooseTaskViewOption = "Choose Logged Todo View",
    Back = "Back"
}

export enum SortOptions {
    Category = "Category",
    Date = "Date",
    Type = "Type"
}

export enum TaskViewOptions {
    Day = "Day",
    Week = "Week",
    Month = "Month",
    Year = "Year",
    All = "All"
}

enum PlanOptions {
    Skip = "Skip",
    ScheduleDaily = "Schedule this todo daily",
    Today = "Due Today",
    Tomorrow = "Due Tomorrow",
    Two = "Schedule in Two Days",
    Three = "Schedule in Three Days",
    Four = "Schedule in Four Days",
    Five = "Schedule in Five Days",
    Six = "Schedule in Six Days",
    Seven = "Due next week",
    Fourteen = "Due in two weeks",
    TwentyOne = "Due in three weeks",
    Month = "Due next month"
}

enum TimeOptions {
    _000 = "Midnight",
    _030 = "12:30 AM",
    _100 = "1:00 AM",
    _130 = "1:30 AM",
    _200 = "2:00 AM",
    _230 = "2:30 AM",
    _300 = "3:00 AM",
    _330 = "3:30 AM",
    _400 = "4:00 AM",
    _430 = "4:30 AM",
    _500 = "5:00 AM",
    _530 = "5:30 AM",
    _600 = "6:00 AM",
    _630 = "6:30 AM",
    _700 = "7:00 AM",
    _730 = "7:30 AM",
    _800 = "8:00 AM",
    _830 = "8:30 AM",
    _900 = "9:00 AM",
    _930 = "9:30 AM",
    _1000 = "10:00 AM",
    _1030 = "10:30 AM",
    _1100 = "11:00 AM",
    _1130 = "11:30 AM",
    _1200 = "Noon",
    _1230 = "12:30 PM",
    _1300 = "1:00 PM",
    _1330 = "1:30 PM",
    _1400 = "2:00 PM",
    _1430 = "2:30 PM",
    _1500 = "3:00 PM",
    _1530 = "3:30 PM",
    _1600 = "4:00 PM",
    _1630 = "4:30 PM",
    _1700 = "5:00 PM",
    _1730 = "5:30 PM",
    _1800 = "6:00 PM",
    _1830 = "6:30 PM",
    _1900 = "7:00 PM",
    _1930 = "7:30 PM",
    _2000 = "8:00 PM",
    _2030 = "8:30 PM",
    _2100 = "9:00 PM",
    _2130 = "9:30 PM",
    _2200 = "10:00 PM",
    _2230 = "10:30 PM",
    _2300 = "11:00 PM",
    _2330 = "11:30 PM"
}

interface DateObject {
    year: number;
    month: number;
    day: number;
}

interface TimeObject {
    days: number;
    minutes: number;
    hours: number;
}

type ViewFunc = (error?: boolean) => Promise<void>;
type CommandFunc = () => Promise<void>;
type ConsoleFunc = (time?: ViewSelector) => void;

type Action = Command | "Quit";


export class Client {

    private publishCommand: MsgFunc;
    private config: ConfigStore;
    private readSide: ReadModel;
    private viewMap: Map<Views, ConsoleFunc>;
    private commandMap: Map<CommandTypes, CommandFunc>;
    // useful globals for display
    private lineWidth: number;
    private col2: number;

    constructor(publishCommand: MsgFunc, readSide: ReadModel) {
        this.lineWidth = 80;
        this.col2 = 65;
        this.publishCommand = publishCommand;
        this.config = new ConfigStore();

        this.readSide = readSide;

        this.viewMap = new Map([
            [Views.Daily, this.viewDaily],
            [Views.Weekly, this.viewWeekly],
            [Views.Category, this.viewByCategory],
            [Views.Note, this.viewNotes],
            [Views.Todo, this.viewTodos],
            [Views.Task, this.viewTasks],
            [Views.Summary, this.viewSummary],
            [Views.All, this.viewAll]
        ])

        // any command which terminates in a call to confirm needs to be registered here
        this.commandMap = new Map([
            [CommandTypes.AddNewTodo, this.createTodo],
            [CommandTypes.AddNewNote, this.createNote],
            [CommandTypes.AddCategory, this.createCategory]      
        ]);


    }

    public async serve(): Promise<void> {
        // runs the client for one application lifetime.

        if (!this.config.store.isInitialized) {
            // run new user flow
            await this.setupNewUser();
        }
        await this.viewWelcome();
    }

    private async mainMenu(): Promise<void> {

        // check for cron jobs
         await this.runCronJobs();

        console.clear();
        this.printSpace();
        this.printDoubleLine();
        this.printAsterisk();
        this.printDoubleLine();
        this.printSpace();
        this.callView();
        
        return (
            inquirer.prompt({
                type: "list",
                name: "mainMenuResponse",
                message: "Main Menu",
                choices: Object.values(MainMenu)
            }).then(answers => {
                switch (answers["mainMenuResponse"]) {

                    case MainMenu.Create:
                        return this.createMenu();

                    case MainMenu.Log:
                        return this.startTaskLogger();

                    case MainMenu.Complete:
                        return this.markTodoComplete();

                    case MainMenu.Plan:
                        return this.runPlanningSession();

                    case MainMenu.View:
                        return this.viewMenu();

                    case MainMenu.Settings:
                        return this.settingsMenu();

                    case MainMenu.Quit:
                        return
                }
            })
        )
    }

    // create menu

    private createMenu = (): Promise<void> => {
        return (
            inquirer.prompt({
                type: "list",
                name: "createMenuResponse",
                message: "Main Menu",
                choices: Object.values(CreateMenu)
            }).then(answers => {
                switch (answers["createMenuResponse"]) {

                    case CreateMenu.Category:
                        return this.createCategory();

                    case CreateMenu.Note:
                        return this.createNote();

                    case CreateMenu.Todo:
                        return this.createTodo();

                    case CreateMenu.Back:
                        return this.mainMenu();

                    case CreateMenu.Incomplete:
                        return this.markTodoIncomplete();
                                        
                }
            })
        )
    }

    private createCategory = (): Promise<void> => {

        return (
            inquirer.prompt({
                name: "category",
                message: "Enter the name of your category:",
            }).then(answers => {
                const { category } = answers;
                const command: Command = {
                    type: CommandTypes.AddCategory,
                    timestamp: new Date(),
                    payload: {
                        name: category
                    }
                }
                return this.confirm(command);
            })
        ) 
    }

    private createNote = (): Promise<void> => {
        return (
            inquirer.prompt([
                {
                    type: "list",
                    name: "category",
                    message: "Select your category:",
                    choices: this.readSide.categories
                },
                {
                    name: "name",
                    message: "Enter the name of this note:"
                },
                {
                    name: "text",
                    message: "Enter note's text:"
                },

            ]).then(answers => {
                const { name, text, category } = answers;
                const command: Command = {
                    type: CommandTypes.AddNewNote,
                    timestamp: new Date(),
                    payload: {
                        name: name,
                        text: text,
                        category: category
                    }
                }
                return this.confirm(command);
            })
        )
    }

    private createTodo = (): Promise<void> => {
        return (
            inquirer.prompt([
                {
                    type: "list",
                    name: "category",
                    message: "Please select a category:",
                    choices: this.readSide.categories
                },
                {
                    name: "name",
                    message: "Enter the name of this Todo:"
                },
                {
                    name: "text",
                    message: "Enter a description of the Todo (optional):"
                },
                {
                    type: "list",
                    name: "scheduleOption",
                    message: "Choose due date for this Todo",
                    choices: Object.values(TodoScheduleOptions)
                }
            ]).then(answers => {
                const { category, name, text, scheduleOption } = answers;
                const dueDate = this.getDateScheduleOptions(scheduleOption)
                const command: Command = {
                    type: CommandTypes.AddNewTodo,
                    timestamp: new Date(),
                    payload: {
                        category: category,
                        name: name,
                        text: text,
                        dueDate: dueDate
                    }
                }
                return this.confirm(command);
            })
        )
    }

    private markTodoComplete = (): Promise<void> => {
        
        return (
            inquirer.prompt({
                name: "todoName",
                type: "list",
                message: "Select the Todo to mark complete:",
                choices: this.readSide.todos.filter(todo => !todo.complete)
            }).then(answers => {
                const { todoName } = answers;
                const todo = this.readSide.todos.find(todo => todo.name === todoName);
                const command: Command = {
                    type: CommandTypes.MarkTodoComplete,
                    timestamp: new Date(),
                    payload: {
                        GUID: todo.GUID
                    }
                }
                this.publishCommand(command);
                return this.mainMenu();
            })
        )
    }

    private markTodoIncomplete = (): Promise<void> => {
        
        return (
            inquirer.prompt({
                name: "todoName",
                type: "list",
                message: "Select the Todo to mark incomplete:",
                choices: this.readSide.todos.filter(todo => todo.complete)
            }).then(answers => {
                const { todoName } = answers;
                const todo = this.readSide.todos.find(todo => todo.name === todoName);
                const command: Command = {
                    type: CommandTypes.MarkTodoIncomplete,
                    timestamp: new Date(),
                    payload: {
                        GUID: todo.GUID
                    }
                }
                this.publishCommand(command);
                return this.mainMenu();
            })
        )
    }

    private confirm = (command: Command): Promise<void> => {

        return (
            inquirer.prompt({
                name: "confirm",
                type: "confirm",
                // make message prettier
                message: `Confirm creating this? ${command.payload.name}`,
                default: false
            }).then(answers => {
                const { confirm } = answers;
                if (!confirm) {
                    return this.mainMenu();
                }
                const res = this.publishCommand(command);
                if (res === BrokerResponse.Success) {
                    return this.mainMenu();
                } else {
                    // need to get correct function for this command
                    const func = this.commandMap.get(command.type);
                    return this.tryAgain(func)
                }
            })
        )
    }

    // task logging

    private startTaskLogger = (): Promise<void> => {
        
        return (
            inquirer.prompt({
                name: "taskName",
                type: "list",
                message: "Select a Todo to start",
                choices: this.readSide.todos.filter(todo => !todo.complete)
            }).then(answers => {
                const { taskName } = answers;
                const task = this.readSide.todos.find(todo => todo.name === taskName)
                const startTime = new Date();
                this.publishCommand({
                    type: CommandTypes.StartLog,
                    timestamp: startTime,
                    payload: {
                        GUID: task.GUID
                    }
                })
                return this.stopTaskLogger(taskName, startTime);
            })
        )
    }

    private stopTaskLogger = (taskName: string, startTime: Date): Promise<void> => {
        // must only be called from startTaskLogger
        
        const hours = startTime.getHours();
        const minutes = startTime.getMinutes();
        
        return (
            inquirer.prompt({
                name: "stop",
                type: "list",
                message: `LOGGING! ${taskName} started at ${hours}:${minutes}. Enter save or cancel to finish logging task and return to main menu.`,
                choices: ["Save", "Cancel"]
            }).then(answers => {
                const { stop } = answers;
                if (stop === "Save") {
                    this.publishCommand({
                        type: CommandTypes.StopLog,
                        timestamp: new Date(),
                        // empty payload because timestamp is all we need
                        payload: {}
                    })
                    
                }
                // if not saving, no need to do anything
                // redirect to menu either way
                return this.mainMenu();
            })
        )
    }

    // planning session

    runPlanningSession = (): Promise<void> => {

        // add this planning time
        this.config.setLastPlanningSession(new Date())

        return (
            inquirer.prompt({
                type: "list",
                name: "response",
                message: "Would you like to start a planning session now?",
                choices: ["Yes", "No"]
            }).then(answers => {
                const { response } = answers;
                if (response === "No") {
                    return this.mainMenu();
                }
                // TODO: could be nice to select which categories to plan, and to go through
                // categories in order
                const openTodos = this.readSide.todos.filter(
                    todo => !todo.complete
                )
                return this.recurseOpenTodos(openTodos)
            })
        )
    }

    recurseOpenTodos = (openTodos: Todo[]): Promise<void> => {
        
        if (!openTodos.length) {
            return this.mainMenu();
        }
        const thisTodo = openTodos[0];
        const nextTodos = openTodos.filter(todo => todo !== thisTodo)
        return (
            inquirer.prompt({
                type: "list",
                name: "action",
                message: `Choose action for todo: ${thisTodo.name}`,
                choices: Object.values(PlanOptions)
            }).then(answers => {
                const { action } = answers;
                let dueDate = null;

                switch (action) {
                    
                    case (PlanOptions.ScheduleDaily):
                        this.publishCommand({
                            type: CommandTypes.ScheduleTodo,
                            timestamp: new Date(),
                            payload: {
                                GUID: thisTodo.GUID,
                                scheduled: Frequency.Daily
                            }
                        });
                        this.publishCommand({
                            type: CommandTypes.MarkTodoIncomplete,
                            timestamp: new Date(),
                            payload: { GUID: thisTodo.GUID}
                        })
                        break;

                    case (PlanOptions.Skip):
                        break;

                    case (PlanOptions.Today):
                        dueDate = new Date();
                        break;

                    case (PlanOptions.Tomorrow):
                        dueDate = this.addDate(1)
                        break;

                    case (PlanOptions.Two):
                        dueDate = this.addDate(2)
                        break;

                    case (PlanOptions.Three):
                        dueDate = this.addDate(3)
                        break; 
                        
                    case (PlanOptions.Four):
                        dueDate = this.addDate(4)
                        break;

                    case (PlanOptions.Five):
                        dueDate = this.addDate(5)
                        break;

                    case (PlanOptions.Six):
                        dueDate = this.addDate(6)
                        break;

                    case (PlanOptions.Seven):
                        dueDate = this.addDate(17)
                        break;

                    case (PlanOptions.Fourteen):
                    dueDate = this.addDate(14)
                    break;

                    case (PlanOptions.TwentyOne):
                    dueDate = this.addDate(21)
                    break;

                    case (PlanOptions.Month):
                    dueDate = this.addDate(0, 1)
                    break;

                }

                if (dueDate) {
                    this.publishCommand({
                        type: CommandTypes.UpdateTodoDueDate,
                        timestamp: new Date(),
                        payload: {
                            GUID: thisTodo.GUID,
                            dueDate: dueDate
                        }
                    });
                    this.publishCommand({
                        type: CommandTypes.MarkTodoIncomplete,
                        timestamp: new Date(),
                        payload: { GUID: thisTodo.GUID}
                    })
                }

                return this.recurseOpenTodos(nextTodos);
            })
        )
    }


    //////////////////////////

    // view menu

    private viewMenu = (): Promise<void> => {
        return (
            inquirer.prompt({
                type: "list",
                name: "viewMenuResponse",
                message: "Select your view: ",
                choices: Object.values(Views)
            }).then(answers => {
                switch (answers["viewMenuResponse"]) {

                    case Views.Category:
                        this.config.setCurrentView(Views.Category);
                        return this.mainMenu();

                    case Views.Daily:
                        this.config.setCurrentView(Views.Daily);
                        return this.mainMenu();

                    case Views.Note:
                        this.config.setCurrentView(Views.Note);
                        return this.mainMenu();

                    case Views.Summary:
                        this.config.setCurrentView(Views.Summary);
                        return this.mainMenu();
              
                    case Views.Task:
                        this.config.setCurrentView(Views.Task);
                        return this.mainMenu();

                    case Views.Todo:
                        this.config.setCurrentView(Views.Todo);
                        return this.mainMenu();

                    case Views.Weekly:
                        this.config.setCurrentView(Views.Weekly);
                        return this.mainMenu();

                    case Views.All:
                        this.config.setCurrentView(Views.All);
                        return this.mainMenu();

                    case Views.Back:
                        return this.mainMenu();
                    }
            })
        )
    }

    private callView = (): void => {

        // calls the view function associated with the user's current selected view
        const view = this.config.store.currentView
        const viewFunc = this.viewMap.get(view);
        return viewFunc();
    }

    private viewDaily = (): void => {
        
        this.printCentered('Daily View');
        this.printSpace(1);
        this.printDoubleLine();
        this.viewNotes(ViewSelector.Today);
        console.log();
        this.printAsterisk();
        this.viewTodos(ViewSelector.Today);
        console.log();
        this.printAsterisk();
        this.viewTasks(ViewSelector.Today);
        console.log();
        this.printAsterisk();
    }

    private viewWeekly = (): void => {
        
        this.printCentered('Weekly View');
        this.printSpace(1);
        this.printDoubleLine();
        this.viewNotes(ViewSelector.ThisWeek);
        console.log();
        this.printAsterisk();
        this.viewTodos(ViewSelector.ThisWeek);
        console.log();
        this.printAsterisk();
        this.viewTasks(ViewSelector.ThisWeek);
        console.log();
        this.printAsterisk();
    }

    private viewByCategory = (): void => {
        
        this.printCentered('Category View');
        this.printSpace(1);
        this.printDoubleLine();
        this.viewNotes(ViewSelector.CurrentCategory);
        console.log();
        this.printAsterisk();
        this.viewTodos(ViewSelector.CurrentCategory);
        console.log();
        this.printAsterisk();
        this.viewTasks(ViewSelector.CurrentCategory);
        console.log();
        this.printAsterisk();
    }

    private viewAll = (): void => {
        this.printCentered('View All');
        this.printSpace(1);
        this.printAsterisk();
        this.viewTodos(ViewSelector.All);        
        console.log();
        this.printAsterisk();
        this.viewTasks(ViewSelector.All);
        console.log();
        this.printAsterisk();
    }


    private viewNotes = (time: ViewSelector=ViewSelector.All): void => {

        const currentNotes = this.readSide.notes.filter(note =>
            time === ViewSelector.Today ? this.isDateToday(note.timestamp)
            : time === ViewSelector.ThisWeek ? this.isDateThisWeek(note.timestamp)
            : time === ViewSelector.CurrentCategory ? this.config.store.currentCategory === note.category
            : true
        )

        this.printCentered('Notes');
        this.printSpace();

        if (!currentNotes.length) {
            this.printCentered('No Notes To Display')
        } else {
            currentNotes.forEach(note => this.printNote(note));
        }

        return
    }

    private viewTodos = (time: ViewSelector=ViewSelector.All): void => {

        this.printCentered('Todos');
        this.printSpace();

        const workingTodos = this.readSide.todos.filter(todo => {
            if (todo.complete && this.config.store.hideCompleteTodos) {
                return false
            }
            return true
        });

        const currentTodos = workingTodos.filter(todo =>
            time === ViewSelector.Today ? this.calculateDaysFromDue(todo.timestamp) <= 0
            : time === ViewSelector.ThisWeek ? this.calculateDaysFromDue(todo.timestamp) <= 7
            : time === ViewSelector.CurrentCategory ? this.config.store.currentCategory === todo.category
            : true
        )

        if (!currentTodos.length) {
            this.printCentered('No Todos To Display');
        } else {
            currentTodos.forEach(todo => this.printTodo(todo));
        }
        return
    }

    private viewTasks = (time: ViewSelector=ViewSelector.All): void => {
        
        this.printCentered('Activity Log');
        this.printSpace();

        const currentTasks = this.readSide.tasks.filter(task =>
            time === ViewSelector.Today ? this.isDateToday(task.timestamp)
            : time === ViewSelector.ThisWeek ? this.isDateThisWeek(task.timestamp, true)
            : time === ViewSelector.CurrentCategory ? task.category === this.config.store.currentCategory
            : true
        )
        if (!currentTasks.length) {
            this.printCentered('No Tasks To Display');
        } else {
            currentTasks.forEach(task => this.printTask(task));
        }
        return
        
    }

    private viewSummary = (): void => {

        this.printCentered('Summary View')
        this.printLine();
        console.log(`Notes: ${this.readSide.notes.length}`);
        console.log(`Open Todos: ${this.readSide.todos.filter(t => !t.complete).length}`)
        console.log(`Tasks: ${this.readSide.tasks.length}`)
        this.printLine();
    }

    private viewWelcome = (): Promise<void> => {
        const welcomeMsg = `Welcome back to EventBullet, ${this.config.store.name}!`

        console.clear();
        this.printAsterisk();
        console.log('\n\n\n');
        this.printCentered(welcomeMsg)
        console.log()
        this.printCentered('a productivity app loosely based on the bullet journal method')
        console.log()
        this.printCentered('Designed and built by Joshua Stauffer')
        this.printCentered('March 25th 2020')
        console.log('\n\n\n');
        this.printAsterisk();
        return (
            inquirer.prompt({
                name: "hello",
                message: "Enter any key to continue."
            }).then(answer => this.mainMenu())
        )

    }

    // settings

    private settingsMenu = (): Promise<void> => {
        console.clear();
        return (
            inquirer.prompt({
                type: "list",
                name: "settings",
                message: "Settings Menu",
                choices: Object.values(SettingsMenu)
            }).then(answers => {
                const { settings } = answers;

                switch (settings) {

                    case (SettingsMenu.Name):
                        return this.editName();

                    case (SettingsMenu.Back):
                        return this.mainMenu();

                    case (SettingsMenu.WeekStartDay):
                        return this.chooseWeekStartDay();

                    case (SettingsMenu.NumItemsToShow):
                        return this.mainMenu();

                    case (SettingsMenu.DailyPlanningReminders):
                        return this.togglePlanningReminders();

                    case (SettingsMenu.ChooseCategory):
                        return this.chooseCategory();

                    case (SettingsMenu.Sort):
                        return this.chooseSort();

                    case (SettingsMenu.HideCompleteTodos):
                        return this.toggleHideCompleteTodos();

                    case (SettingsMenu.ChooseTaskViewOption):
                        return this.chooseTaskViewOption();
                }
            })
        )
    }

    private setupNewUser = (): Promise<void> => {
        console.log('Hi! Welcome to EventBullet. Let\'s start by setting up your preferences. You can change these at any time in settings.')
        return (
            inquirer.prompt([
                {
                    type: "input",
                    message: "Enter your name",
                    name: "name"
                },
                {
                    type: "input",
                    name: "category",
                    message: "Notes and Todos are organized by category. Create your first category now:"
                },
                {
                    type: "list",
                    name: "planningTime",
                    message: "One useful tool this app provides is a planning session to manage your unfinished Todos. Once a day while you have the app open you\'ll be prompted to review any unfinished Todos, and be given the option to reschedule them. (You can turn this feature on or off next!) Please select a time for your daily planning session:",
                    choices: Object.values(TimeOptions)
                },
                {
                    type: "confirm",
                    name: "turnPlanningTimeOn",
                    message: "Would you like to turn on daily planning sessions? ",
                }
            ]).then(answers => {
                const { name, category, planningTime, turnPlanningTimeOn } = answers;
                this.config.setName(name);
                const command = {
                    type: CommandTypes.AddCategory,
                    timestamp: new Date(),
                    payload: {
                        name: category
                    }
                }
                this.publishCommand(command);
                this.config.setCurrentCategory(category);
                const time = this.getDateFromTimeOptions(planningTime)
                this.config.setPlanningTime(time);
                this.config.setDailyPlanningReminders(turnPlanningTimeOn);

                // mark setup as complete
                this.config.initialized();

                return this.mainMenu();
            })
        )
    }

    private chooseCategory = (): Promise<void> => {

        return (
            inquirer.prompt({
                type: "list",
                name: "category",
                message: "Select your category:",
                choices: this.readSide.categories
            }).then(answers => {
                const { category } = answers;
                this.config.setCurrentCategory(category);
                return this.settingsMenu();
            })
        )
    }

    private editName = (): Promise<void> => {

        return (
            inquirer.prompt({
                name: "name",
                message: "Enter your name:",
            }).then(answers => {
                const { name } = answers;
                this.config.setName(name);
                return this.settingsMenu();
            })
        )
    }

    private chooseWeekStartDay = (): Promise<void> => {

        return (
            inquirer.prompt({
                type: "list",
                name: "weekStart",
                message: "Select your category:",
                choices: Object.keys(Days)
            }).then(answers => {
                const { weekStart } = answers;
                this.config.setWeekStart(weekStart);
                return this.settingsMenu();
            })
        )
    }

    private togglePlanningReminders = (): Promise<void> => {

        return (
            inquirer.prompt({
                type: "list",
                name: "toggle",
                message: "Select your category:",
                choices: [
                    "On", "Off"
                ]
            }).then(answers => {
                const { toggle } = answers;
                if (toggle === 'On') {
                    this.config.setDailyPlanningReminders(true)
                } else {
                    this.config.setDailyPlanningReminders(false)
                }
                return this.settingsMenu();
            })
        )
    }

    private chooseSort = (): Promise<void> => {
        
        return (
            inquirer.prompt({
                type: "list",
                name: "sort",
                message: "Select the default way to sort todos, notes, and tasks:",
                choices: Object.values(SortOptions)
            }).then(answers => {
                const { sort } = answers;
                this.config.setDefaultSort(sort);
                return this.settingsMenu();
            })
        )
    }

    private toggleHideCompleteTodos = (): Promise<void> => {

        return (
            inquirer.prompt({
                type: "list",
                name: "hideOrShow",
                message: "Hide/Show Complete Todos:",
                choices: ["Hide", "Show"]
            }).then(answers => {
                const { hideOrShow } = answers;

                if (hideOrShow === 'Hide') {
                    this.config.setHideCompleteTodos(true);
                } else {
                    this.config.setHideCompleteTodos(false);
                }
                return this.settingsMenu();
            })
        )
    }

    private chooseTaskViewOption = (): Promise<void> => {

        return (
            inquirer.prompt({
                type: "list",
                name: "taskViewOption",
                message: "Select the period you would like to view logged Todos",
                choices: Object.values(TaskViewOptions)
            }).then(answers => {
                const { taskViewOption } = answers;
                this.config.setTaskViewOptions(taskViewOption);
                return this.settingsMenu();
            })
        )
    }

    // Cron jobs

    async runCronJobs(): Promise<void> {

        // have i run yet today?
        // reset cron job should always run as soon as the user first opens the application for the day
        if (!this.isDateToday(new Date(this.config.store.lastChronJob))) {
             this.resetDailyTasks();
        }
        // TODO: reset weekly tasks?

        // does the user want a daily planning session?
        if (this.config.store.dailyPlanningReminders && 
            // have they already planned today?
            !(this.isDateToday(new Date(this.config.store.lastPlanningSession))) &&
            // is it time to plan yet?
            (new Date().getHours() >= new Date(this.config.store.planningTime).getHours())
            ) {
            
            await this.runPlanningSession();
            // check if the user has changed any completed todos to daily tasks
            this.resetDailyTasks();
        }

        // mark cron job as finished for the day
        this.config.resetLastChronJob();
    }

    private resetDailyTasks = (): void => {
        
        const time = new Date();

        for (const todo of this.readSide.todos.filter(todo => todo.scheduled === Frequency.Daily && todo.complete)) {
            this.publishCommand({
                type: CommandTypes.MarkTodoIncomplete,
                timestamp: time,
                payload: {GUID: todo.GUID}
            })
            this.publishCommand({
                type: CommandTypes.UpdateTodoDueDate,
                timestamp: time,
                payload: {
                    GUID: todo.GUID,
                    dueDate: time
                }
            })
        }
    }

    /////////////////////////////////////////////////////////////////////////
    /////////////               utility methods              ////////////////
    /////////////////////////////////////////////////////////////////////////

    // create menu utilities

    private getDateScheduleOptions = (dueDate: TodoScheduleOptions): Date | null =>  {
        // translates a TodoScheduleOptions into a new date or null corresponding with the
        // option's delta from this moment
        
        switch (dueDate) {

            case TodoScheduleOptions.Never:
                return null

            case TodoScheduleOptions.Today:
                return this.addDate(0, 0);

            case TodoScheduleOptions.Tomorrow:
                return this.addDate(1);

            case TodoScheduleOptions.Two:
                return this.addDate(2);
            
            case TodoScheduleOptions.Three:
                return this.addDate(3);

            case TodoScheduleOptions.Four:
                return this.addDate(4);

            case TodoScheduleOptions.Five:
                return this.addDate(5);

            case TodoScheduleOptions.Six:
                return this.addDate(6);

            case TodoScheduleOptions.Seven:
                return this.addDate(7);

            case TodoScheduleOptions.Fourteen:
                return this.addDate(14);

            case TodoScheduleOptions.TwentyOne:
                return this.addDate(21);

            case TodoScheduleOptions.Month:
                return this.addDate(0, 1);
        }
    }

    private tryAgain = (nextView: ViewFunc): Promise<void> => {
        // Offers user the option to try a failed operation again or return to main menu.

        console.log('Sorry, there was an error and your work wasn\'t saved.')
        return (
            inquirer.prompt({
                type: "list",
                name: "tryAgain",
                message: "Try again, or return to the main menu?",
                choices: [{key: "tryAgain", value: "Try Again"}, {key: "return", value: "Return to "}]
            }).then(answers => {
                const answer = answers['tryAgain'];
                if (answer === "tryAgain") {
                    return nextView(true);
                }
                return this.mainMenu();
            })
        )
    }

    // print utilities

    private printNote = (note: Note): void => {

        console.log(note.name.padEnd(this.col2, ' ') + note.category)
        this.printTimeCreated(note.timestamp);
        console.log(note.text)
        this.printSpace();
    }

    private printTodo = (todo: Todo): void => {

        console.log(todo.name.padEnd(this.col2, ' ') + todo.category)
        this.printTimeCreated(todo.timestamp);
        console.log(todo.text)
        this.printDueDateStatus(todo.dueDate, todo.complete);
        this.printSpace();

    }

    private printTask = (task: Task): void => {

        console.log(task.name.padEnd(this.col2, ' ') + task.category)
        this.printTimeCreated(task.timestamp)
        this.printDuration(task.taskDelta)
        this.printSpace();
    }

    private printTimeCreated = (date: Date): void => {
        
        const hours = date.getHours();
        const minutes = date.getMinutes();
        console.log(date.toDateString().padEnd(this.col2, ' ') + `${hours}:${minutes}`)
    }

    private printDuration = (delta: number): void => {
        
        const { days, hours, minutes } = this.deltaToHoursMinutes(delta);
        const dayLabel = !days ? ''
                            : days > 1 ? `${days} days`
                            : `${days} day`;
        const hourLabel = !hours ? ''
                            : hours > 1 ? `${hours} hours`
                            : `${hours} hour`;
        const minuteLabel = !minutes ? '0 minutes'
                            : minutes > 1 ? `${minutes} minutes`
                            : `${minutes} minute`;           

        console.log(`Duration: ${dayLabel} ${hourLabel} ${minuteLabel}`)
    }

    private printDueDateStatus = (date: Date | null, isComplete=false): void => {
        if (isComplete) {
            return this.printCentered('(  Complete  )');
        }
        if (!date) {
            return this.printCentered('No due date.');
        }
    
        const days = this.calculateDaysFromDue(date);
        switch (days) {

            case 0:
                return this.printCentered('Due today.')

            case 1:
                return this.printCentered('Due tomorrow.')

            case -1:
                return this.printCentered('Due yesterday!')

            default:
                if (days < 0) {
                    this.printCentered('OVERDUE!!!')
                    return this.printCentered(`Due ${days} days ago.`)

                } else {
                    return this.printCentered(`Due in ${days} days.`)
                }
            
        }
    }

    private printCentered = (str: string): void => {
        // utility method to print a string in the middle of the console

        const width = str.length;
        const pad = this.lineWidth / 2 + Math.floor(width / 2)
        console.log(str.padStart(pad, ' '))
    }

    private printLine = (): void => {
        console.log('_'.repeat(this.lineWidth))
    }

    private printAsterisk = (): void => {
        console.log('*'.repeat(this.lineWidth))
    }

    private printDoubleLine = (): void => {
        console.log('='.repeat(this.lineWidth))
    }

    private printSpace = (numLines?: number): void => {

        if (!numLines) console.log()
        console.log('\n'.repeat(numLines));
    }

    // time calculators

    private addDate = (days=0, months=0): Date => {
        const now = new Date();
        return new Date(
            now.getFullYear(),
            now.getMonth() + months,
            now.getDate() + days,
            now.getHours(),
            now.getMinutes()
        )
    }

    private getCurrentDate = (): DateObject => {
        const today = new Date();
        return {
            year: today.getFullYear(),
            month: today.getMonth(),
            day: today.getDay()
        }
    }

    private isDateToday = (date: Date): boolean => {
        const { year, month, day } = this.getCurrentDate();
        if ((date.getFullYear() === year) 
            && (date.getMonth() === month)
            && (date.getDay() === day)) {
                return true;
            }
        return false;
    }

    private isDateThisWeek = (date: Date, past?: true): boolean => {
        // checks is a given day falls in the coming week or any time past.
        // if param: past is true checks if date falls in the past week.
        if (past) {
            return this.calculateDaysFromDue(date) >= -7;
        }
        return this.calculateDaysFromDue(date) <= 7;
    }

    private calculateDaysFromDue = (date: Date): number => {
        // returns delta in days between todays date and param date
        // negative numbers represent times in the past, positive future
        const now = new Date();
        const millisecondsDelta = date.valueOf() - now.valueOf();
        return Math.ceil(millisecondsDelta / 86400000); // num milliseconds in a day
    }

    private deltaToHoursMinutes = (delta: number): TimeObject => {
        // expects param: delta a positive whole number

        const dayRemainder = delta % 86400000
        const days = (delta - dayRemainder) / 86400000;    // 86,400,000 ms in day
        const hourRemainder = dayRemainder % 3600000;
        const hours = (dayRemainder - hourRemainder) / 3600000;   // 3,600,000 ms in hour
        const minutes = Math.round(hourRemainder/60000); // 60,000 ms in minute
        return {
            days: days,
            hours: hours,
            minutes: minutes
        }
    }

    private getDateFromTimeOptions = (time: TimeOptions): Date => {
        // translates TimeOptions into a new date object corresponding to that time
        // is there REALLY no better way to do this?!? i HATE this method...
        // some way to map a (Date) value directly into the enum ? 

        switch (time) {

            case (TimeOptions._000):
                return new Date('March 26, 2021 00:00:00')

            case (TimeOptions._030):
                return new Date('March 26, 2021 00:30:00')

            case (TimeOptions._100):
                return new Date('March 26, 2021 01:00:00')

            case (TimeOptions._130):
                return new Date('March 26, 2021 01:30:00')

            case (TimeOptions._200):
                return new Date('March 26, 2021 02:00:00')

            case (TimeOptions._230):
                return new Date('March 26, 2021 02:30:00')

            case (TimeOptions._300):
                return new Date('March 26, 2021 03:00:00')

            case (TimeOptions._330):
                return new Date('March 26, 2021 03:30:00')

            case (TimeOptions._400):
                return new Date('March 26, 2021 04:00:00')

            case (TimeOptions._430):
                return new Date('March 26, 2021 04:30:00')

            case (TimeOptions._500):
                return new Date('March 26, 2021 05:00:00')

            case (TimeOptions._530):
                return new Date('March 26, 2021 05:30:00')

            case (TimeOptions._600):
                return new Date('March 26, 2021 06:00:00')

            case (TimeOptions._630):
                return new Date('March 26, 2021 06:30:00')

            case (TimeOptions._700):
                return new Date('March 26, 2021 07:00:00')

            case (TimeOptions._730):
                return new Date('March 26, 2021 07:30:00')

            case (TimeOptions._800):
                return new Date('March 26, 2021 08:00:00')

            case (TimeOptions._830):
                return new Date('March 26, 2021 08:30:00')

            case (TimeOptions._900):
                return new Date('March 26, 2021 09:00:00')

            case (TimeOptions._930):
                return new Date('March 26, 2021 09:30:00')

            case (TimeOptions._1000):
                return new Date('March 26, 2021 10:00:00')

            case (TimeOptions._1030):
                return new Date('March 26, 2021 10:30:00')

            case (TimeOptions._1100):
                return new Date('March 26, 2021 11:00:00')

            case (TimeOptions._1130):
                return new Date('March 26, 2021 11:30:00')

            case (TimeOptions._1200):
                return new Date('March 26, 2021 12:00:00')

            case (TimeOptions._1230):
                return new Date('March 26, 2021 12:30:00')

            case (TimeOptions._1300):
                return new Date('March 26, 2021 13:00:00')

            case (TimeOptions._1330):
                return new Date('March 26, 2021 13:30:00')

            case (TimeOptions._1400):
                return new Date('March 26, 2021 14:00:00')

            case (TimeOptions._1430):
                return new Date('March 26, 2021 14:30:00')

            case (TimeOptions._1500):
                return new Date('March 26, 2021 15:00:00')

            case (TimeOptions._1530):
                return new Date('March 26, 2021 15:30:00')

            case (TimeOptions._1600):
                return new Date('March 26, 2021 16:00:00')

            case (TimeOptions._1630):
                return new Date('March 26, 2021 16:30:00')

            case (TimeOptions._1700):
                return new Date('March 26, 2021 17:00:00')

            case (TimeOptions._1730):
                return new Date('March 26, 2021 17:30:00')

            case (TimeOptions._1800):
                return new Date('March 26, 2021 18:00:00')

            case (TimeOptions._1830):
                return new Date('March 26, 2021 18:30:00')

            case (TimeOptions._1900):
                return new Date('March 26, 2021 19:00:00')

            case (TimeOptions._1930):
                return new Date('March 26, 2021 19:30:00')

            case (TimeOptions._2000):
                return new Date('March 26, 2021 20:00:00')

            case (TimeOptions._2030):
                return new Date('March 26, 2021 20:30:00')

            case (TimeOptions._2100):
                return new Date('March 26, 2021 21:00:00')

            case (TimeOptions._2130):
                return new Date('March 26, 2021 21:30:00')
            
            case (TimeOptions._2200):
                return new Date('March 26, 2021 22:00:00')

            case (TimeOptions._2230):
                return new Date('March 26, 2021 22:30:00')

            
            case (TimeOptions._2300):
                return new Date('March 26, 2021 23:00:00')

            case (TimeOptions._2330):
                return new Date('March 26, 2021 23:30:00')
                
            default:
                throw new Error('Unknown date passed to getDateFromTimeOptions')
        }

    }

}

