/// <reference types="node" />
import { EventEmitter } from "events";
import { Request, Response } from "express";
export declare class ServerSentEvent extends EventEmitter {
    constructor();
    init: (req: Request, res: Response) => void;
    send(data: any, event?: string, id?: string | number): void;
}
