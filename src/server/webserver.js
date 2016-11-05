"use strict";
const bodyparser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const express = require("express");
const session = require("express-session");
const favicon = require("serve-favicon");
const uuid = require("uuid");
const const_1 = require("../const");
class Webserver {
    constructor(port, appname, usersess) {
        this.port = port;
        this.appname = appname;
        this.usersess = usersess;
        this.cookieMaxAgeMinutes = 60 * 24;
        this.staticContent = "./static";
        this.faviconPath = null;
        this.debug = false;
        this.apis = [];
        this.corsOptions = null;
        this.tokens = [];
        this.app = express();
    }
    setCookieMaxAgeMinutes(minutes) {
        this.cookieMaxAgeMinutes = minutes;
    }
    setStaticContent(path) {
        this.staticContent = path;
    }
    setFaviconPath(path) {
        this.faviconPath = path;
    }
    setDebug(dbg) {
        this.debug = dbg;
    }
    addApi(pth, rapi) {
        this.apis.push({ path: pth, api: rapi });
    }
    setCorsOptions(opt) {
        this.corsOptions = opt;
    }
    start() {
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
    insertStandards() {
        this.app.use(bodyparser.urlencoded({ extended: true }));
        this.app.use(bodyparser.json());
        this.app.use(cookieParser());
        if (this.faviconPath) {
            this.app.use(favicon(this.faviconPath));
        }
        this.app.use(cors(this.corsOptions));
        if (this.usersess) {
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
    }
    insertStatic() {
        if (this.staticContent) {
            this.app.use(express.static(this.staticContent));
        }
    }
    insertDebug() {
        this.app.use((req, res, next) => {
            console.info("---- request -------------------");
            console.info("protocol: ");
            console.dir(req.protocol);
            console.info("hostname: ");
            console.dir(req.hostname);
            console.info("baseUrl: ");
            console.dir(req.baseUrl);
            console.info("path: ");
            console.dir(req.path);
            console.info("url: ");
            console.dir(req.url);
            console.info("originalUrl: ");
            console.dir(req.originalUrl);
            console.info("method: ");
            console.dir(req.method);
            console.info("headers: ");
            console.dir(req.headers);
            console.info("params: ");
            console.dir(req.params);
            console.info("query: ");
            console.dir(req.query);
            console.info("body: ");
            console.dir(req.body);
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
    }
    insertSessionRouter() {
        let sessionrouter = express.Router();
        this.app.use("/", sessionrouter);
        sessionrouter.route(const_1.authURL)
            .post((req, res, next) => {
            console.info("sessionrouter " + const_1.authURL);
            this.killSession(req);
            this.authenticate(req, res);
        });
        sessionrouter.route(const_1.loginURL)
            .post((req, res, next) => {
            console.info("sessionrouter ", const_1.loginURL);
            this.login(req, res);
        });
        sessionrouter.route(const_1.keepaliveURL)
            .get((req, res, next) => {
            console.info("sessionrouter ", const_1.keepaliveURL);
            if (req["session"]["active"]) {
                req["session"].touch(null);
                res.send("OK");
            }
        });
        sessionrouter.use((req, res, next) => {
            console.info("sessionrouter default " + req.path);
            if (req["session"]["active"]) {
                req["session"].touch(null);
                next();
            }
            else {
                console.info("NO active session - redirect");
                res.redirect("/");
            }
        });
        sessionrouter.route(const_1.saveSessionURL)
            .post((req, res, next) => {
            console.info("sessionrouter /setuserdata");
            let userid = req["session"]["user"]._id;
            req["session"]["user"].session = req.body;
            this.usersess.setUserData(userid, req.body)
                .then((rc) => {
                console.info("save user OK");
                res.send("OK");
            })
                .catch(() => {
                res.send("ERROR");
            });
        });
    }
    insertAppRouters() {
        this.apis.forEach((api) => {
            let router = express.Router();
            console.info("router for " + api.path);
            this.app.use(api.path, router);
            api.api.initRoute(router);
        });
    }
    insertLast() {
        this.app.use((req, res, next) => {
            console.info("Router fall through: " + req.path);
            res.redirect("/");
        });
    }
    run() {
        this.server = this.app.listen(this.port, () => {
            console.info("server [" + this.appname + "] started at port " + this.port);
        });
    }
    authenticate(req, res) {
        console.info("SESSION: call w/uid ");
        let type = req.body["type"];
        let user;
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
        user.then(usrid => {
            if (usrid) {
                let token = uuid.v4();
                console.info("SESSION: uid=" + usrid + " new token=" + token);
                this.tokens[token] = { uid: usrid, date: Date.now() };
                let rc = {};
                rc["token"] = token;
                res.send(rc);
            }
            else {
                res.sendStatus(401);
            }
        });
    }
    login(req, res) {
        console.info("SESSION: call w/token");
        let t = req.body["token"];
        let token = this.tokens[t];
        delete this.tokens[t];
        console.info("SESSION: token=" + token);
        if (Date.now() - token.date < 300) {
            console.info("SESSION: token valid");
            let userdata = this.usersess.getUserData();
            req["session"]["active"] = true;
            req["session"]["user"] = userdata;
            res.send(userdata.session || {});
        }
        else {
            console.info("SESSION: token invalid");
            res.sendStatus(403);
        }
    }
    NTLMAuth(body) {
        let uid = body["uid"];
        return this.usersess.authUser(uid);
    }
    formAuth(body) {
        let uid = body["uid"];
        let pwd = body["pwd"];
        return this.usersess.authUser(uid, pwd);
    }
    noneAuth(body) {
        let uid = body["uid"];
        return this.usersess.authUser(uid);
    }
    killSession(req) {
        if (req.session) {
            req.session.destroy(err => {
                if (err) {
                    console.error("error destroying session: ", err);
                }
                else {
                    console.info("session destroyed");
                }
            });
        }
    }
}
exports.Webserver = Webserver;
//# sourceMappingURL=webserver.js.map