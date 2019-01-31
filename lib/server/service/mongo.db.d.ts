import * as mongoose from "mongoose";
export declare class MongoDB {
    private opts;
    private connection;
    private readonly dbUrl;
    private readonly dbver;
    readonly mongodbVersion: Promise<string>;
    private log;
    constructor(srv: string, db: string, port: number, opts: mongoose.ConnectionOptions);
    getConnection(): mongoose.Connection;
    close(): Promise<string>;
    private connect;
}
