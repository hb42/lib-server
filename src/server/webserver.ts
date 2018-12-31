/**
 * Created by hb on 09.08.16.
 */

import * as bodyparser from "body-parser";
import * as compression from "compression";
import * as cookieParser from "cookie-parser";
import * as cors from "cors";
import * as express from "express";
import * as http from "http";
import * as favicon from "serve-favicon";
import * as uuid from "uuid";

import {
  authURL,
  keepaliveURL,
  loginURL,
  makeSseUrl,
  staticURL,
} from "@hb42/lib-common";

import {
  AuthService,
  LoggerService,
  RestApi,
  ServerSentEvent,
  UserCheck,
} from "./service";

export class Webserver {

  private app: express.Application;
  private server: http.Server;

  private log = LoggerService.get("lib-server.server.Webserver");

  // default config
  //
  // webapp (set to null if no content)
  private staticContent: string; // "./static";
  private staticUrl: string = staticURL; // == BASE_URL default "/app"
  // favicon path (mandatory)
  private faviconPath: string;
  // log debug info
  private debug: boolean = false;
  // einzufuegende APIs (via addApi() eintragen)
  private apis: RestApi[] = [];
  // CORS Optionen, sofern gebraucht (z.B. fake asp)
  private corsOptions: any = null;
  // Login-Token-Timeout milis (damit das mit IE-F12 fkt. muesste > 5000 gesetzt werden)
  private tokentimeout = 1000;
  // JWT handling
  private authService: AuthService;
  // SSE-URL (beginnt immer mit /sse/)
  private sseUrl: string;
  // SSE event handling
  private sse: ServerSentEvent;

  private tokens: any[] = [];

  constructor(private port: number, private appname: string,
              private userCheck?: UserCheck, log?: express.Handler) {
    this.app = express();
    if (log) { // -> log4js
      this.app.use(log);
    }
    if (userCheck) {
      this.authService = new AuthService(userCheck.getJwtSecret(), userCheck.getJwtTimeout());
    }
    // caching komplet abschalten -> verhindert Status 304
    this.app.disable("etag");
  }

  // config fn's
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

  public setSSE(url: string) {
    this.sseUrl = makeSseUrl(url);
  }
  public getSSEurl(): string {
    return this.sseUrl;
  }
  public getSSE(): ServerSentEvent {
    return this.sse;
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
    if (this.userCheck) {
      this.insertSessionRouter();
    }
    this.insertAppRouters();
    this.insertLast();

    this.run();
  }

  // 1. init standard middleware
  private insertStandards() {
    if (!this.sseUrl) {
      this.app.use(compression()); // nicht zusammen mit SSE verwenden!
    }
    this.app.use(bodyparser.urlencoded({extended: true}));
    this.app.use(bodyparser.json({limit: "20mb"}));
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
    this.app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {

      this.log.debug("---- BEGIN request -------------------");
      // z.B. http://localhost:1234/api/test?a=A&b=B
      // this.log.info("protocol: ");
      // this.log.dir(req.protocol);               // "http"
      // this.log.info("hostname: ");
      // this.log.dir(req.hostname);               // "localhost"
      // this.log.info("baseUrl: ");
      // this.log.dir(req.baseUrl);                // "/api"
      // this.log.info("path: ");
      // this.log.dir(req.path);                   // "/test"
      // this.log.info("url: ");
      // this.log.dir(req.url);                    // "/test?a=A&b=B"
      this.log.debug("- originalUrl: " + req.originalUrl);  // "/api/test?a=A&b=B"
      this.log.debug("- method:      " + req.method);
      this.log.debug("- headers: ");
      this.log.debug(req.headers);                // { host: ..., connection: ..., etc. }
      this.log.debug("- params: ");
      this.log.debug(req.params);                 // { }
      this.log.debug("- query: ");
      this.log.debug(req.query);                  // { a: "A", b: "B" }
      this.log.debug("- body: ");
      this.log.debug(req.body);                 // { }
      this.log.debug("---- END request ---------------------");
      next();
    });
  }

  // 4. Router "/" -> logon handling
  /*
     SSO via NTLM:

     - request: Client -> IIS?app=<app-name>
         Client-App (Browser) ruft eine Adresse des IIS auf.
     -  request: IIS -> this/"authURL" (body: uid=<user>)
          Der IIS ermittelt den NTLM-User und ruft damit die Server-Adresse 'authURL' auf.
     -  response: this -> IIS (POST: token=<token>) | 401
          Hier wird der User ueberprueft (this.userCheck -> in WebApp definiert) und bei Erfolg ein
          Token zurueckgegeben (im Fehlerfall Status 401).
     - response: IIS -> Client (POST: token=<token>) | 401
         Der IIS gibt das Token an die Client-App zurueck.
     - request: Client -> this/"loginURL"/<token>
         Die Client-App ruft die Adresse 'loginURL' auf und gibt in der URL das Token mit.
     - reponse: this -> Client (GET: <JWT>) | 403
         Hier wird, sofern das Token nicht aelter als this.tokentimeout ist, ein JsonWebToken
         generiert. Im JWT werden unter 'data' die Benutzerdaten aus der WebApp eingefuegt und
         das JWT an den Client zurueckgeliefert (oder Status 403 bei Fehler).

     - request: Client -> this
         Bei allen weiteren Anfragen gibt der Client das JWT im Header mit. Hier wird das JWT aus dem
         Header extrahiert und unter request.session.data fuer die WebApp verfuegbar gemacht. Falls
         das JWT abgelaufen ist wird Status 401 zurueckgegeben.
   */
  private insertSessionRouter() {
    const mainrouter = express.Router();
    this.app.use("/", mainrouter);

    // "/" auf webapp umleiten (fkt. nur, wenn static im REST-Server gehosted wird)
    mainrouter.route("/")
        .all((req: express.Request, res: express.Response, next: express.NextFunction) => {
          if (this.staticContent) {
            this.log.debug("mainrouter redirect to static /");
            res.redirect(this.staticUrl); // zur Startseite (fkt. nicht f. ajax!)
          } else {
            next();
          }
        });
    // authenticate call from IIS | form
    mainrouter.route(authURL)
        .post((req: express.Request, res: express.Response, next: express.NextFunction) => {
          this.log.info("mainrouter AUTH: " + authURL);
          this.authenticate(req, res);
        });
    // logon call from app with authenticate token
    mainrouter.route(loginURL + "/:logintoken")
        .get((req: express.Request, res: express.Response, next: express.NextFunction) => {
          this.log.info("mainrouter LOGIN: ", loginURL);
          // req[""] = req.params.conf_name;
          this.login(req, res);
        });
    // keepalive call
    mainrouter.route(keepaliveURL)
        .get((req: express.Request, res: express.Response, next: express.NextFunction) => {
          this.log.debug("mainrouter KEEPALIVE: ", keepaliveURL);
          // if (req.session && req.session.active) {
          if (this.authService.checkToken(req)) {
            // req.session.touch((err: any) => this.log.error("ERROR at express-session.Touch()"));
            res.send("OK");
          } else {
            this.log.error("invalid session send 401");
            // res.send(null);  // -> error in cli
            res.sendStatus(401);  // muss Webapp behandeln
          }
        });
    // check session
    mainrouter.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      this.log.debug("mainrouter default " + req.path);
      // nur fuer REST-APIs ist der Session-Check sinnvoll
      // (static muss das intern regeln, sonstige URLs fallen durch)
      const checkapi: boolean =
                this.apis.reduce((b: boolean, a: RestApi) => b ? b : req.path.startsWith(a.path + "/"), false);
      if (checkapi) {
        this.log.debug("check session");
        if (this.authService.checkToken(req)) {
          const usr = req["session"] && req["session"]["data"] && req["session"]["data"]["uid"]
              ? req["session"]["data"]["uid"]
              : "";
          this.log.debug("check session: active UID=" + usr);
          next(); // session ok -> weiter
        } else {
          this.log.error("check session: NOT active, send 401");
          res.sendStatus(401);  // muss Webapp behandeln
          // res.send(null);
        }
      } else {
        next();
      }
    });
    // SSE-Route
    if (this.sseUrl) {
      this.sse = new ServerSentEvent();
      this.log.info("set SSE route to " + this.sseUrl);
      mainrouter.route(this.sseUrl).get(this.sse.init);
      // this.app.get(this.sseUrl, this.sse.init);
    }
  }

  // 5. App Router(s)
  private insertAppRouters() {
    this.apis.forEach((api) => {
      const router = express.Router();
      this.log.info("router for " + api.path);
      this.app.use(api.path, router);
      api.initRoute(router);
    });
  }

  // 6. Handle fall through
  private insertLast() {
    this.app.use((req: express.Request, res: express.Response, next) => {
      this.log.error("Router fall through: " + req.path);
      // TODO was bis hierher kommt ist ungueltig, also mit 404 antworten ??
      // -> wenn IE-F12 vergebens jede Menge *.map sucht funktioniert es besser,
      //    null zurueckzugeben. (next() wuerde implizit 404 ausloesen(?))
      // res.send(null);
      res.sendStatus(404);
    });
  }

  /**
   * start server
   */
  private run() {
    this.server = this.app.listen(this.port, () => {
      this.log.info("server [" + this.appname + "] started at port " + this.port);
    });
  }

  // ---- login handling ----

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
    this.log.info("LOGIN: authenticate uid");
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
        user = this.noneAuth(req.body);
        break;
    }
    user.then((usrid) => {
      if (usrid) {
        const authToken: string = uuid.v4();
        this.log.info("LOGIN: uid=" + usrid + " new authentication token=" + authToken);
        this.tokens[authToken as any] = {uid: usrid, date: Date.now()};
        const rc: any = {token: authToken};
        res.send(rc);
      } else {  // invalid uid/pwd
        res.sendStatus(401); // TODO Testen, wenn Form-Login mal implementiert wird
      }
    });
  }

  /**
   * Create new JWT
   *
   * GET login/<token>
   *
   * @param req
   * @param res
   */
  private login(req: express.Request, res: express.Response) {
    this.log.info("LOGIN: login w/auth-token");
    const t = req.params.logintoken;
    const authToken = this.tokens[t];
    delete this.tokens[t];
    this.log.info("LOGIN: authentication token=" + authToken);

    if (Date.now() - authToken.date < this.tokentimeout && this.userCheck) {
      this.log.info("LOGIN: token valid");
      this.userCheck.getUser(authToken.uid)
          .then((user) => {
            res.send({jwt: this.authService.newToken(user)});
          })
          .catch((err) => {
            this.log.info("LOGIN: user not allowed");
            res.sendStatus(403);
          });
    } else {
      /* ungueltiges Token */
      this.log.info("LOGIN: token invalid");
      res.sendStatus(403); // forbidden
    }
  }

  private NTLMAuth(body: any): Promise<any> {
    const uid = body["uid"];
    this.log.info("LOGIN: NTLMauth get authUser");
    if (this.userCheck) {
      return this.userCheck.authUser(uid);
    } else {
      return new Promise((resolve, reject) => reject("No UserCheck object."));
    }
  }

  private formAuth(body: any): Promise<any> {
    const uid = body["uid"];
    const pwd = body["pwd"];
    // TODO check user/pwd
    if (this.userCheck) {
      return this.userCheck.authUser(uid, pwd);
    } else {
      return new Promise((resolve, reject) => reject("No UserCheck object."));
    }
  }

  private noneAuth(body: any): Promise<any> {
    const uid = body["uid"];
    if (this.userCheck) {
      return this.userCheck.authUser(uid);
    } else {
      return new Promise((resolve, reject) => reject("No UserCheck object."));
    }
  }

}
