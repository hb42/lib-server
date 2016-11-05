/**
 * Created by hb on 07.08.16.
 */

import * as express from "express";

export interface RestApi {
  initRoute(router: express.Router): void;
}
