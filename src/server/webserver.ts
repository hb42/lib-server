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
import * as compression from "compression";
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
  staticURL,
} from "../shared/ext";
import {
  RestApi,
  UserCheck,
} from "./service";

export class Webserver {

  private app: express.Application;
  private server: http.Server;

  // default config
  //
  // timeout f. session cookie (nur wenn im c'tor usersess gesetzt)
  private cookieMaxAgeMinutes: number = 60 * 24;  // 1 Tag
  // webapp (set to null if no content)
  private staticContent: string = null; // "./static";
  private staticUrl: string = staticURL; // == BASE_URL default "/app"
  // favicon path (has to be set)
  private faviconPath: string = null;
  // log debug info
  private debug: boolean = false;
  // einzufuegende APIs (via addApi() eintragen)
  private apis: RestApi[] = [];
  // CORS Optionen, sofern gebraucht (z.B. fake asp)
  private corsOptions: any = null;
  // Token-Timeout milis (5 sec., damit Logon auch mit IE-F12 fkt.)
  private tokentimeout = 5000;

  private tokens = [];

  constructor(private port: number, private appname: string, log: express.Handler,
              private usersess?: UserCheck) {
    this.app = express();
    this.app.use(log);
    // caching komplet abschalten -> verhindert Status 304
    this.app.disable("etag");
  }

  // config fn's
  public setCookieMaxAgeMinutes(minutes: number) {
    this.cookieMaxAgeMinutes = minutes;
  }

  public setStaticContent(path: string) {
    this.staticContent = path;
  }

  public setStaticUrl(url: string) {
    this.staticUrl = url;
  }

  public setFaviconPath(path: string) {
    this.faviconPath = path;
  }

  public setDebug(dbg: boolean) {
    this.debug = dbg;
  }

  public addApi(api: RestApi) {
    this.apis.push(api);
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
    this.app.use(compression());
    this.app.use(bodyparser.urlencoded({extended: true}));
    this.app.use(bodyparser.json({limit: "10mb"}));
    this.app.use(cookieParser());
    if (this.faviconPath) {
      this.app.use(favicon(this.faviconPath));
    }

    // CORS: npm install cors
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
      // TODO fallthrough abschalten -> Doku
      this.app.use(this.staticUrl, express.static(this.staticContent));
    }
  }

  // 3. debug print request
  private insertDebug() {
    this.app.use( (req: express.Request, res: express.Response, next: express.NextFunction) => {

      console.info("---- request -------------------");  // z.B. http://localhost:1234/api/test?a=A&b=B
      // console.info("protocol: ");
      // console.dir(req.protocol);               // "http"
      // console.info("hostname: ");
      // console.dir(req.hostname);               // "localhost"
      // console.info("baseUrl: ");
      // console.dir(req.baseUrl);                // "/api"
      // console.info("path: ");
      // console.dir(req.path);                   // "/test"
      // console.info("url: ");
      // console.dir(req.url);                    // "/test?a=A&b=B"
      console.info("- originalUrl: " + req.originalUrl);  // "/api/test?a=A&b=B"
      // console.info("method: ");
      // console.dir(req.method);                 // "GET"
      console.info("- headers: ");
      console.dir(req.headers);                // { host: ..., connection: ..., etc. }
      console.info("- params: ");
      console.dir(req.params);                 // { }
      console.info("- query: ");
      console.dir(req.query);                  // { a: "A", b: "B" }
      console.info("- body: ");
      console.dir(req.body);                 // { }
      if (req.session) {
        console.info("- session ID = " + req.session["id"]);
        console.dir(req.session);
        // console.info("sessID  =", req.session["id"]);
        // console.info("active  =", req.session["active"]);
        // console.info("User    =", req.session["user"]);
        // console.info("maxAge  =", req.session.cookie.maxAge);
        // console.info("expires =", req.session.cookie.expires);
      } else {
        console.info("- NO session");
      }
      console.info("--------------------------------");
      next();
    });
  }

  // 4. Router "/" -> session handling
  private insertSessionRouter() {
    const mainrouter = express.Router();
    this.app.use("/", mainrouter);

    // "/" auf webapp umleiten (fkt. nur, wenn static im REST-Server gehosted wird)
    mainrouter.route("/")
        .all((req: express.Request, res: express.Response, next: express.NextFunction) => {
          if (this.staticContent) {
            console.info("mainrouter redirect /");
            res.redirect(this.staticUrl); // zur Startseite (fkt. nicht f. ajax!)
          } else {
            next();
          }
        });
    // authenticate call from IIS | form
    mainrouter.route(authURL)
        .post((req: express.Request, res: express.Response, next: express.NextFunction) => {
          console.info("mainrouter " + authURL);
          this.killSession(req);
          this.authenticate(req, res);
        });
    // logon call from app with authenticate token
    mainrouter.route(loginURL + "/:logintoken")
        .get((req: express.Request, res: express.Response, next: express.NextFunction) => {
          console.info("mainrouter ", loginURL);
          // req[""] = req.params.conf_name;
          this.login(req, res);
        });
    // keepalive call
    mainrouter.route(keepaliveURL)
        .get((req: express.Request, res: express.Response, next: express.NextFunction) => {
          console.info("mainrouter ", keepaliveURL);
          if (req["session"]["active"]) {
            req["session"].touch(null);
            res.send("OK");
          } else {
            console.info("invalid session send 401");
            res.sendStatus(401);  // muss Webapp behandeln
          }
        });
    // check session
    mainrouter.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.info("mainrouter default " + req.path);
      // nur fuer REST-APIs ist der Session-Check sinnvoll
      // (static muss das intern regeln, sonstige URLs fallen durch)
      const check: boolean =
                this.apis.reduce( (b: boolean, a: RestApi) => b ? b : req.path.startsWith(a.path), false);
      if (check) {
        console.info("check session");
        if (req["session"]["active"]) {
          /* laufende session */
          // TODO gem. Doku sollte touch() implizit sein (s.o. rolling: true)
          req["session"].touch(null);
          next(); // session ok -> weiter
        } else {
          console.info("NO active session - send error");
          res.sendStatus(401);  // muss Webapp behandeln
        }
      } else {
        next();
      }
    });
  }

  // 5. App Router(s)
  private insertAppRouters() {
    this.apis.forEach( (api) => {
      const router = express.Router();
      console.info("router for " + api.path);
      this.app.use(api.path, router);
      api.initRoute(router);
    });
  }

  // 6. Handle fall through
  private insertLast() {
    this.app.use((req: express.Request, res: express.Response, next) => {
      console.info("Router fall through: " + req.path);
      // was bis hierher kommt ist ungueltig, also mit 404 antworten ??
      // -> wenn IE-F12 vergebens jede Menge *.map sucht funktioniert es besser,
      //    null zurueckzugeben. (next() wuerde implizit 404 ausloesen)
      res.send(null);
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
    const type = req.body["type"];
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
    user.then( (usrid) => {
      if (usrid) {
        const token = uuid.v4();
        console.info("SESSION: uid=" + usrid + " new token=" + token);
        this.tokens[token] = {uid: usrid, date: Date.now()};
        const rc = {};
        rc["token"] = token;
        res.send(rc);
      } else {  // invalid uid/pwd
        res.sendStatus(401); // TODO Testen, wenn Form-Login mal implementiert wird
      }
    });
  }

  /**
   * Create new session cookie
   *
   * GET login/<token>
   *
   * @param req
   * @param res
   */
  private login(req: express.Request, res: express.Response) {
    console.info("SESSION: call w/token");
    // const t = req.body["token"];
    // const t = req.query["t"];
    const t = req.params.logintoken;
    const token = this.tokens[t];
    delete this.tokens[t];
    console.info("SESSION: token=" + token);

    if (Date.now() - token.date < this.tokentimeout) {
      console.info("SESSION: token valid");
      this.usersess.getUser(token.uid)
          .then( (user) => {
            req["session"]["active"] = true; // -> set cookie
            req["session"]["user"] = user;
            res.send("OK");
          })
          .catch( (err) => {
            console.info("SESSION: user not allowed");
            res.sendStatus(403);
          });
    } else {
      /* ungueltiges Token */
      console.info("SESSION: token invalid");
      res.sendStatus(403); // forbidden
    }
  }

  private NTLMAuth(body): Promise<any> {
    const uid = body["uid"];
    return this.usersess.authUser(uid);
  }

  private formAuth(body): Promise<any> {
    const uid = body["uid"];
    const pwd = body["pwd"];
    // TODO check user/pwd
    return this.usersess.authUser(uid, pwd);
  }

  private noneAuth(body): Promise<any> {
    const uid = body["uid"];
    return this.usersess.authUser(uid);
  }

  private killSession(req: express.Request) {
    if (req.session) {
      req.session.destroy( (err) => {
        if (err) {
          console.error("error destroying session: ", err);
        } else {
          console.info("session destroyed");
        }
      });
    }
  }

}
