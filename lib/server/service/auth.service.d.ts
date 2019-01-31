import * as express from "express";
export declare class AuthService {
    private secret;
    private timeoutSec;
    constructor(secret: string, timeoutSec: number);
    newToken(payload: any): string;
    checkToken(req: express.Request): boolean;
}
