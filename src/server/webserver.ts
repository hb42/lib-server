/**
 * Created by hb on 09.08.16.
 */

// import uuid: tsc findet typings nicht (2.0.0beta), deshalb expliziter Eintrag in tsconfig.json
//       "baseUrl": "./",   // wird wg. "path" gebraucht
//       "paths": {
//         "uuid": ["node_modules/@types/node-uuid"]
//       }
//

import * as bodyparser from "body-parser";
import * as cookieParser from "cookie-parser";
import * as cors from "cors";
import * as express from "express";
import * as session from "express-session";
import * as http from "http";
import * as favicon from "serve-favicon";
import * as uuid from "uuid";

import {
  authURL,
  keepaliveURL,
  loginURL,
  saveSessionURL,
} from "@hb42/lib-common";

import {
  RestApi,
  UserCheck,
} from "./service";

interface ApiDefinition {
  path: string;
  api: RestApi;
}

export class Webserver {

  private app: express.Application;
  private server: http.Server;

  // default config
  //
  // timeout f. session coockie (nur wenn im c'tor usersess gesetzt)
  private cookieMaxAgeMinutes: number = 60 * 24;  // 1 Tag
  // html files (set to null if no content)
  private staticContent: string = "./static";
  // favicon path (has to be set)
  private faviconPath: string = null;
  // log debug info
  private debug: boolean = false;
  // einzufuegende APIs
  private apis: Array<ApiDefinition> = [];
  // CORS Optionen, sofern gebraucht (z.B. fake asp)
  private corsOptions: any = null;

  private tokens = [];

  constructor(private port: number, private appname: string, private usersess?: UserCheck) {
    this.app = express();
  }

  // config fn's
  public setCookieMaxAgeMinutes(minutes: number) {
    this.cookieMaxAgeMinutes = minutes;
  }

  public setStaticContent(path: string) {
    this.staticContent = path;
  }

  public setFaviconPath(path: string) {
    this.faviconPath = path;
  }

  public setDebug(dbg: boolean) {
    this.debug = dbg;
  }

  public addApi(pth: string, rapi: RestApi) {
    this.apis.push({path: pth, api: rapi});
  }

  public setCorsOptions(opt: any) {
    this.corsOptions = opt;
  }

  /**
   * start the webserver
   */
  public start() {
    this.insertStandards();
    this.insertStatic();
    if (this.debug) {
      this.insertDebug();
    }
    if (this.usersess) {
      this.insertSessionRouter();
    }
    this.insertAppRouters();
    this.insertLast();

    this.run();
  }

  // 1. init standard middleware
  private insertStandards() {
    this.app.use(bodyparser.urlencoded({extended: true}));
    this.app.use(bodyparser.json());
    this.app.use(cookieParser());
    if (this.faviconPath) {
      this.app.use(favicon(this.faviconPath));
    }

    // CORS: npm install cors
    //       typings install cors --ambient
    //       -> require("cors")
    // nur bestimmte Hosts erlauben
    // let corsOptions = {
    //  origin: "http://127.0.0.1:8080"
    // };
    // app.use(cors(corsOptions));
    //
    // alle Hosts erlauben: app.use.cors()
    this.app.use(cors(this.corsOptions));

    if (this.usersess) {
      // session cookie
      this.app.use(session(
          {
            name             : this.appname + ".jsSessionID",
            resave           : false,
            rolling          : true,  // auto renew maxAge
            secret           : "{199a5e48-959a-4295-b7d3-fcdc3c71fecb}",
            saveUninitialized: false,
            cookie           : {
              maxAge: this.cookieMaxAgeMinutes * 60 * 1000,  // milis
            },
          }));
    }
  }

  // 2. init static webserver
  private insertStatic() {
    if (this.staticContent) {
      this.app.use(express.static(this.staticContent));
    }
  }

  // 3. debug print request
  private insertDebug() {
    this.app.use( (req: express.Request, res: express.Response, next: express.NextFunction) => {

      console.info("---- request -------------------");  // z.B. http://localhost:1234/api/test?a=A&b=B
      console.info("protocol: ");
      console.dir(req.protocol);               // "http"
      console.info("hostname: ");
      console.dir(req.hostname);               // "localhost"
      console.info("baseUrl: ");
      console.dir(req.baseUrl);                // "/api"
      console.info("path: ");
      console.dir(req.path);                   // "/test"
      console.info("url: ");
      console.dir(req.url);                    // "/test?a=A&b=B"
      console.info("originalUrl: ");
      console.dir(req.originalUrl);            // "/api/test?a=A&b=B"
      console.info("method: ");
      console.dir(req.method);                 // "GET"
      console.info("headers: ");
      console.dir(req.headers);                // { host: ..., connection: ..., etc. }
      console.info("params: ");
      console.dir(req.params);                 // { }
      console.info("query: ");
      console.dir(req.query);                  // { a: "A", b: "B" }
      console.info("body: ");
      console.dir(req.body);                 // { }
      console.info("session:");
      if (req.session) {
        console.dir(req.session);
        console.info("sessID=", req.session["id"]);
        console.info("maxAge=", req.session.cookie.maxAge);
        console.info("expires=", req.session.cookie.expires);
      } else {
        console.info("NO session");
      }
      console.info("--------------------------------");
      next();
    });
  }

  // 4. Router "/" -> session handling
  private insertSessionRouter() {
    let sessionrouter = express.Router();
    this.app.use("/", sessionrouter);

    // authenticate call from IIS | form
    sessionrouter.route(authURL)
        .post((req: express.Request, res: express.Response, next: express.NextFunction) => {
          console.info("sessionrouter " + authURL);
          this.killSession(req);
          this.authenticate(req, res);
        });
    // logon call from app with authenticate token
    sessionrouter.route(loginURL)
        .post((req: express.Request, res: express.Response, next: express.NextFunction) => {
          console.info("sessionrouter ", loginURL);
          this.login(req, res);
        });
    // keepalive call
    sessionrouter.route(keepaliveURL)
        .get((req: express.Request, res: express.Response, next: express.NextFunction) => {
          console.info("sessionrouter ", keepaliveURL);
          if (req["session"]["active"]) {
            req["session"].touch(null);
            res.send("OK");
          }
        });
    // check session
    sessionrouter.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.info("sessionrouter default " + req.path);
      if (req["session"]["active"]) {
        /* laufende session */
        // TODO gem. Doku sollte touch() implizit sein (s.o. rolling: true)
        req["session"].touch(null);
        next(); // session ok -> weiter
      } else {
        console.info("NO active session - redirect");
        res.redirect("/"); // keine Session -> zur Startseite
      }
    });
    // save user data
    sessionrouter.route(saveSessionURL)
        .post((req: express.Request, res: express.Response, next: express.NextFunction) => {
          console.info("sessionrouter /setuserdata");
          let userid = req["session"]["user"]._id;
          req["session"]["user"].session = req.body;
          this.usersess.setUserData(userid, req.body)
              .then( (rc) => {
                console.info("save user OK");
                res.send("OK");
              })
              .catch( () => {
                res.send("ERROR");
              });
        });

  }

  // 5. App Router(s)
  private insertAppRouters() {
    this.apis.forEach( (api) => {
      let router = express.Router();
      console.info("router for " + api.path);
      this.app.use(api.path, router);
      api.api.initRoute(router);
    });
  }

  // 6. Handle fall through -> redirect "/" TODO: wie mit Fehler umgehen? Immer auf / abladen?
  private insertLast() {
    this.app.use((req: express.Request, res: express.Response, next) => {
      console.info("Router fall through: " + req.path);
      res.redirect("/"); // -> index.html
    });
  }

  /**
   * start server
   */
  private run() {
    this.server = this.app.listen(this.port, () => {
      // let host = server.address().address; //ipv6 -> ::
//    let port = server.address().port;
      console.info("server [" + this.appname + "] started at port " + this.port);
    });
  }

  // ---- session handling ----

  /**
   *  authenticate w/ userID, [password]
   *
   *  POST data in req.body:
   *  { tpye: NTLM|FORM|NONE, uid: <UserID>, pwd?: <password> }
   *
   *  sends { token: <Token> } | 401
   *
   * @param req
   * @param res
   */
  private authenticate(req: express.Request, res: express.Response) {
    console.info("SESSION: call w/uid ");
    let type = req.body["type"];
    let user: Promise<string>;
    switch (type) {
      case "NTLM":
        user = this.NTLMAuth(req.body);
        break;
      case "FORM":
        user = this.formAuth(req.body);
        break;
      case "NONE":
        user = this.noneAuth(req.body);
        break;
      default:
        break;
    }
    user.then( usrid => {
      if (usrid) {
        let token = uuid.v4();
        console.info("SESSION: uid=" + usrid + " new token=" + token);
        this.tokens[token] = {uid: usrid, date: Date.now()};
        let rc = {};
        rc["token"] = token;
        res.send(rc);
      } else {  // invalid uid/pwd
        res.sendStatus(401); // TODO Testen, wenn Form-Login mal implementiert wird
      }
    });
  }

  /**
   * Get user data for auth token
   *
   * POST data in req.body: (s. authenticate() )
   * { token: <Token> }
   *
   * @param req
   * @param res
   */
  private login(req: express.Request, res: express.Response) {
    console.info("SESSION: call w/token");
    let t = req.body["token"];
    let token = this.tokens[t];
    delete this.tokens[t];
    console.info("SESSION: token=" + token);

    if (Date.now() - token.date < 300) {  // TODO token timeout als param
      console.info("SESSION: token valid");
      let userdata = this.usersess.getUserData();
      req["session"]["active"] = true; // -> set cookie
      req["session"]["user"] = userdata;
      res.send(userdata.session || {});
    } else {
      /* ungueltiges Token */
      console.info("SESSION: token invalid");
      res.sendStatus(403); // TODO forbidden -> start page ??
    }
  }

  private NTLMAuth(body): Promise<any> {
    let uid = body["uid"];
    return this.usersess.authUser(uid);
  }

  private formAuth(body): Promise<any> {
    let uid = body["uid"];
    let pwd = body["pwd"];
    // TODO check user/pwd
    return this.usersess.authUser(uid, pwd);
  }

  private noneAuth(body): Promise<any> {
    let uid = body["uid"];
    return this.usersess.authUser(uid);
  }

  private killSession(req: express.Request) {
    if (req.session) {
      req.session.destroy(err => {
        if (err) {
          console.error("error destroying session: ", err);
        } else {
          console.info("session destroyed");
        }
      });
    }
  }

}
