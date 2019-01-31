import * as log4js from "log4js";
export declare class LoggerService {
    static init(filename: string): void;
    static get(logname: string): log4js.Logger;
    static shutdown(): void;
    private static instance;
    private constructor();
}
