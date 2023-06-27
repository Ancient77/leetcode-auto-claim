export enum Color {
    red = "\x1b[31m",
    green = "\x1b[32m",
    yellow = "\x1b[33m",
    grey = "\x1b[90m",
}

export class ConsoleTable {
    private status: string;
    private lastError: string;
    private currentPoints: string;
    private lastUpdate: Date;
    
    public updateStatus(color:Color,status: string) {
        this.status = color+status+"\x1b[0m";
        this.update();
    }
    public updateError(color:Color,error: string) {
        this.lastError = color+error+"\x1b[0m";
        this.update();
    }
    public updatePoints(color:Color,points: number) {
        this.currentPoints = color+points.toString()+"\x1b[0m";
        this.update();
    }
    public updateLastUpdate(color:Color,lastUpdate: Date) {
        this.lastUpdate = new Date();
        this.update();
    }
    private update() {
        console.clear();
        console.log('Status: ' + this.status);
        console.log('Last Error: ' + this.lastError);
        console.log('Current Points: ' + this.currentPoints);
        console.log('Last Update: ' + this.lastUpdate);
    }
    constructor() {
        this.status = Color.grey+"unknown"+'\x1b[0m';
        this.lastError = Color.grey+"unknown"+'\x1b[0m';
        this.currentPoints = Color.grey+"unknown"+'\x1b[0m';
        this.lastUpdate = new Date();
        return this;
    }
}