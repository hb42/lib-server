/**
 * Created by hb on 09.08.16.
 */
"use strict";
// import uuid: tsc findet typings nicht (2.0.0beta), deshalb expliziter Eintrag in tsconfig.json
//       "baseUrl": "./",   // wird wg. "path" gebraucht
//       "paths": {
//         "uuid": ["node_modules/@types/node-uuid"]
//       }
//
var bodyparser = require("body-parser");
var cookieParser = require("cookie-parser");
var cors = require("cors");
var express = require("express");
var session = require("express-session");
var favicon = require("serve-favicon");
var uuid = require("uuid");
var lib_common_1 = require("@hb42/lib-common");
var Webserver = (function () {
    function Webserver(port, appname, usersess) {
        this.port = port;
        this.appname = appname;
        this.usersess = usersess;
        // default config
        //
        // timeout f. session coockie (nur wenn im c'tor usersess gesetzt)
        this.cookieMaxAgeMinutes = 60 * 24; // 1 Tag
        // html files (set to null if no content)
        this.staticContent = "./static";
        // favicon path (has to be set)
        this.faviconPath = null;
        // log debug info
        this.debug = false;
        // einzufuegende APIs
        this.apis = [];
        // CORS Optionen, sofern gebraucht (z.B. fake asp)
        this.corsOptions = null;
        this.tokens = [];
        this.app = express();
    }
    // config fn's
    Webserver.prototype.setCookieMaxAgeMinutes = function (minutes) {
        this.cookieMaxAgeMinutes = minutes;
    };
    Webserver.prototype.setStaticContent = function (path) {
        this.staticContent = path;
    };
    Webserver.prototype.setFaviconPath = function (path) {
        this.faviconPath = path;
    };
    Webserver.prototype.setDebug = function (dbg) {
        this.debug = dbg;
    };
    Webserver.prototype.addApi = function (pth, rapi) {
        this.apis.push({ path: pth, api: rapi });
    };
    Webserver.prototype.setCorsOptions = function (opt) {
        this.corsOptions = opt;
    };
    /**
     * start the webserver
     */
    Webserver.prototype.start = function () {
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
    };
    // 1. init standard middleware
    Webserver.prototype.insertStandards = function () {
        this.app.use(bodyparser.urlencoded({ extended: true }));
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
            this.app.use(session({
                name: this.appname + ".jsSessionID",
                resave: false,
                rolling: true,
                secret: "{199a5e48-959a-4295-b7d3-fcdc3c71fecb}",
                saveUninitialized: false,
                cookie: {
                    maxAge: this.cookieMaxAgeMinutes * 60 * 1000,
                },
            }));
        }
    };
    // 2. init static webserver
    Webserver.prototype.insertStatic = function () {
        if (this.staticContent) {
            this.app.use(express.static(this.staticContent));
        }
    };
    // 3. debug print request
    Webserver.prototype.insertDebug = function () {
        this.app.use(function (req, res, next) {
            console.info("---- request -------------------"); // z.B. http://localhost:1234/api/test?a=A&b=B
            console.info("protocol: ");
            console.dir(req.protocol); // "http"
            console.info("hostname: ");
            console.dir(req.hostname); // "localhost"
            console.info("baseUrl: ");
            console.dir(req.baseUrl); // "/api"
            console.info("path: ");
            console.dir(req.path); // "/test"
            console.info("url: ");
            console.dir(req.url); // "/test?a=A&b=B"
            console.info("originalUrl: ");
            console.dir(req.originalUrl); // "/api/test?a=A&b=B"
            console.info("method: ");
            console.dir(req.method); // "GET"
            console.info("headers: ");
            console.dir(req.headers); // { host: ..., connection: ..., etc. }
            console.info("params: ");
            console.dir(req.params); // { }
            console.info("query: ");
            console.dir(req.query); // { a: "A", b: "B" }
            console.info("body: ");
            console.dir(req.body); // { }
            console.info("session:");
            if (req.session) {
                console.dir(req.session);
                console.info("sessID=", req.session["id"]);
                console.info("maxAge=", req.session.cookie.maxAge);
                console.info("expires=", req.session.cookie.expires);
            }
            else {
                console.info("NO session");
            }
            console.info("--------------------------------");
            next();
        });
    };
    // 4. Router "/" -> session handling
    Webserver.prototype.insertSessionRouter = function () {
        var _this = this;
        var sessionrouter = express.Router();
        this.app.use("/", sessionrouter);
        // authenticate call from IIS | form
        sessionrouter.route(lib_common_1.authURL)
            .post(function (req, res, next) {
            console.info("sessionrouter " + lib_common_1.authURL);
            _this.killSession(req);
            _this.authenticate(req, res);
        });
        // logon call from app with authenticate token
        sessionrouter.route(lib_common_1.loginURL)
            .post(function (req, res, next) {
            console.info("sessionrouter ", lib_common_1.loginURL);
            _this.login(req, res);
        });
        // keepalive call
        sessionrouter.route(lib_common_1.keepaliveURL)
            .get(function (req, res, next) {
            console.info("sessionrouter ", lib_common_1.keepaliveURL);
            if (req["session"]["active"]) {
                req["session"].touch(null);
                res.send("OK");
            }
        });
        // check session
        sessionrouter.use(function (req, res, next) {
            console.info("sessionrouter default " + req.path);
            if (req["session"]["active"]) {
                /* laufende session */
                // TODO gem. Doku sollte touch() implizit sein (s.o. rolling: true)
                req["session"].touch(null);
                next(); // session ok -> weiter
            }
            else {
                console.info("NO active session - redirect");
                res.redirect("/"); // keine Session -> zur Startseite
            }
        });
        // save user data
        sessionrouter.route(lib_common_1.saveSessionURL)
            .post(function (req, res, next) {
            console.info("sessionrouter /setuserdata");
            req["session"]["user"].session = req.body;
            _this.usersess.setUserData(req.body)
                .then(function (rc) {
                console.info("save user OK");
                res.send("OK");
            })
                .catch(function () {
                res.send("ERROR");
            });
        });
    };
    // 5. App Router(s)
    Webserver.prototype.insertAppRouters = function () {
        var _this = this;
        this.apis.forEach(function (api) {
            var router = express.Router();
            console.info("router for " + api.path);
            _this.app.use(api.path, router);
            api.api.initRoute(router);
        });
    };
    // 6. Handle fall through -> redirect "/" TODO: wie mit Fehler umgehen? Immer auf / abladen?
    Webserver.prototype.insertLast = function () {
        this.app.use(function (req, res, next) {
            console.info("Router fall through: " + req.path);
            res.redirect("/"); // -> index.html
        });
    };
    /**
     * start server
     */
    Webserver.prototype.run = function () {
        var _this = this;
        this.server = this.app.listen(this.port, function () {
            // let host = server.address().address; //ipv6 -> ::
            //    let port = server.address().port;
            console.info("server [" + _this.appname + "] started at port " + _this.port);
        });
    };
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
    Webserver.prototype.authenticate = function (req, res) {
        var _this = this;
        console.info("SESSION: call w/uid ");
        var type = req.body["type"];
        var user;
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
        user.then(function (usrid) {
            if (usrid) {
                var token = uuid.v4();
                console.info("SESSION: uid=" + usrid + " new token=" + token);
                _this.tokens[token] = { uid: usrid, date: Date.now() };
                var rc = {};
                rc["token"] = token;
                res.send(rc);
            }
            else {
                res.sendStatus(401); // TODO Testen, wenn Form-Login mal implementiert wird
            }
        });
    };
    /**
     * Get user data for auth token
     *
     * POST data in req.body: (s. authenticate() )
     * { token: <Token> }
     *
     * @param req
     * @param res
     */
    Webserver.prototype.login = function (req, res) {
        console.info("SESSION: call w/token");
        var t = req.body["token"];
        var token = this.tokens[t];
        delete this.tokens[t];
        console.info("SESSION: token=" + token);
        if (Date.now() - token.date < 300) {
            console.info("SESSION: token valid");
            var userdata = this.usersess.getUserData();
            req["session"]["active"] = true; // -> set cookie
            req["session"]["user"] = userdata;
            res.send(userdata || {});
        }
        else {
            /* ungueltiges Token */
            console.info("SESSION: token invalid");
            res.sendStatus(403); // TODO forbidden -> start page ??
        }
    };
    Webserver.prototype.NTLMAuth = function (body) {
        var uid = body["uid"];
        return this.usersess.authUser(uid);
    };
    Webserver.prototype.formAuth = function (body) {
        var uid = body["uid"];
        var pwd = body["pwd"];
        // TODO check user/pwd
        return this.usersess.authUser(uid, pwd);
    };
    Webserver.prototype.noneAuth = function (body) {
        var uid = body["uid"];
        return this.usersess.authUser(uid);
    };
    Webserver.prototype.killSession = function (req) {
        if (req.session) {
            req.session.destroy(function (err) {
                if (err) {
                    console.error("error destroying session: ", err);
                }
                else {
                    console.info("session destroyed");
                }
            });
        }
    };
    return Webserver;
}());
exports.Webserver = Webserver;
