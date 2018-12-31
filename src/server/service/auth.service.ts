
import * as express from "express";
import * as jwt from "jsonwebtoken";

import {
  JwtHeader,
} from "@hb42/lib-common";

/**
 * JWT Handling
 *
 * Die Application-Daten werden im JWT an "data" gehaengt.
 * Das JWT vom Client wird an request.session gehaengt, Zugriff auf die App-Daten:
 *
 *    req["session"]["data"]
 *
 */
export class AuthService {

  constructor(private secret: string, private timeoutSec: number) {
  }

  public newToken(payload: any): string {
    return jwt.sign({ data: payload}, this.secret, { expiresIn: this.timeoutSec });
  }

  public checkToken(req: express.Request): boolean {
    const token: string | undefined = req.get(JwtHeader);
    let decoded: any = null;
    if (token) {
      try {
        decoded = jwt.verify(token, this.secret);
        if (!decoded) {
          decoded = { data: {} };
        }
        if (!decoded.data) {
          decoded.data = {};
        }
        req["session"] = decoded;
      } catch (err) {  // TODO throw?
        console.error("Error validating JWT-token " + err.message);
      }
    }
    return decoded !== null;
  }

}
