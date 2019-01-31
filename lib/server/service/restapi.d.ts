import * as express from "express";
export interface RestApi {
    path: string;
    initRoute(router: express.Router): void;
}
