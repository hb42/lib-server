"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bodyparser = require("body-parser");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const express = require("express");
const favicon = require("serve-favicon");
const uuid = require("uuid");
const lib_common_1 = require("@hb42/lib-common");
const service_1 = require("./service");
class Webserver {
    constructor(port, appname, userCheck, log) {
        this.port = port;
        this.appname = appname;
        this.userCheck = userCheck;
        this.log = service_1.LoggerService.get("lib-server.server.Webserver");
        this.staticUrl = lib_common_1.staticURL;
        this.debug = false;
        this.apis = [];
        this.corsOptions = null;
        this.tokentimeout = 5000;
        this.tokens = [];
        this.app = express();
        if (log) {
            this.app.use(log);
        }
        if (userCheck) {
            this.authService = new service_1.AuthService(userCheck.getJwtSecret(), userCheck.getJwtTimeout());
        }
        this.app.disable("etag");
    }
    setStaticContent(path) {
        this.staticContent = path;
    }
    setStaticUrl(url) {
        this.staticUrl = url;
    }
    setFaviconPath(path) {
        this.faviconPath = path;
    }
    setDebug(dbg) {
        this.debug = dbg;
    }
    addApi(api) {
        this.apis.push(api);
    }
    setCorsOptions(opt) {
        this.corsOptions = opt;
    }
    setSSE(url) {
        this.sseUrl = lib_common_1.makeSseUrl(url);
    }
    getSSEurl() {
        return this.sseUrl;
    }
    getSSE() {
        return this.sse;
    }
    start() {
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
    insertStandards() {
        if (!this.sseUrl) {
            this.app.use(compression());
        }
        this.app.use(bodyparser.urlencoded({ extended: true }));
        this.app.use(bodyparser.json({ limit: "20mb" }));
        this.app.use(cookieParser());
        if (this.faviconPath) {
            this.app.use(favicon(this.faviconPath));
        }
        this.app.use(cors(this.corsOptions));
    }
    insertStatic() {
        if (this.staticContent) {
            this.app.use(this.staticUrl, express.static(this.staticContent));
        }
    }
    insertDebug() {
        this.app.use((req, res, next) => {
            this.log.debug("---- BEGIN request -------------------");
            this.log.debug("- originalUrl: " + req.originalUrl);
            this.log.debug("- method:      " + req.method);
            this.log.debug("- headers: ");
            this.log.debug(req.headers);
            this.log.debug("- params: ");
            this.log.debug(req.params);
            this.log.debug("- query: ");
            this.log.debug(req.query);
            this.log.debug("- body: ");
            this.log.debug(req.body);
            this.log.debug("---- END request ---------------------");
            next();
        });
    }
    insertSessionRouter() {
        const mainrouter = express.Router();
        this.app.use("/", mainrouter);
        mainrouter.route("/")
            .all((req, res, next) => {
            if (this.staticContent) {
                this.log.debug("mainrouter redirect to static /");
                res.redirect(this.staticUrl);
            }
            else {
                next();
            }
        });
        mainrouter.route(lib_common_1.authURL)
            .post((req, res, next) => {
            this.log.info("mainrouter AUTH: " + lib_common_1.authURL);
            this.authenticate(req, res);
        });
        mainrouter.route(lib_common_1.loginURL + "/:logintoken")
            .get((req, res, next) => {
            this.log.info("mainrouter LOGIN: ", lib_common_1.loginURL);
            this.login(req, res);
        });
        mainrouter.use((req, res, next) => {
            this.log.debug("mainrouter default " + req.path);
            const checkapi = this.apis.reduce((b, a) => b ? b : req.path.startsWith(a.path + "/"), false);
            if (checkapi) {
                this.log.debug("check session");
                if (this.authService.checkToken(req)) {
                    const usr = req["session"] && req["session"]["data"] && req["session"]["data"]["uid"]
                        ? req["session"]["data"]["uid"]
                        : "";
                    this.log.debug("check session: active UID=" + usr);
                    next();
                }
                else {
                    this.log.error("check session: NOT active, send 401");
                    res.sendStatus(401);
                }
            }
            else {
                next();
            }
        });
        if (this.sseUrl) {
            this.sse = new service_1.ServerSentEvent();
            this.log.info("set SSE route to " + this.sseUrl);
            mainrouter.route(this.sseUrl).get(this.sse.init);
        }
    }
    insertAppRouters() {
        this.apis.forEach((api) => {
            const router = express.Router();
            this.log.info("router for " + api.path);
            this.app.use(api.path, router);
            api.initRoute(router);
        });
    }
    insertLast() {
        this.app.use((req, res, next) => {
            this.log.error("Router fall through: " + req.path);
            res.sendStatus(404);
        });
    }
    run() {
        this.server = this.app.listen(this.port, () => {
            this.log.info("server [" + this.appname + "] started at port " + this.port);
        });
    }
    authenticate(req, res) {
        this.log.info("LOGIN: authenticate uid");
        const type = req.body["type"];
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
                user = this.noneAuth(req.body);
                break;
        }
        user.then((usrid) => {
            if (usrid) {
                const authToken = uuid.v4();
                this.log.info("LOGIN: uid=" + usrid + " new authentication token=" + authToken);
                this.tokens[authToken] = { uid: usrid, date: Date.now() };
                const rc = { token: authToken };
                res.send(rc);
            }
            else {
                res.sendStatus(401);
            }
        });
    }
    login(req, res) {
        this.log.info("LOGIN: login w/auth-token");
        const t = req.params.logintoken;
        const authToken = this.tokens[t];
        delete this.tokens[t];
        this.log.info("LOGIN: authentication token=" + authToken);
        if (Date.now() - authToken.date < this.tokentimeout && this.userCheck) {
            this.log.info("LOGIN: token valid");
            this.userCheck.getUser(authToken.uid)
                .then((user) => {
                res.send({ jwt: this.authService.newToken(user) });
            })
                .catch((err) => {
                this.log.info("LOGIN: user not allowed");
                res.sendStatus(403);
            });
        }
        else {
            this.log.info("LOGIN: token invalid");
            res.sendStatus(403);
        }
    }
    NTLMAuth(body) {
        const uid = body["uid"];
        this.log.info("LOGIN: NTLMauth get authUser");
        if (this.userCheck) {
            return this.userCheck.authUser(uid);
        }
        else {
            return new Promise((resolve, reject) => reject("No UserCheck object."));
        }
    }
    formAuth(body) {
        const uid = body["uid"];
        const pwd = body["pwd"];
        if (this.userCheck) {
            return this.userCheck.authUser(uid, pwd);
        }
        else {
            return new Promise((resolve, reject) => reject("No UserCheck object."));
        }
    }
    noneAuth(body) {
        const uid = body["uid"];
        if (this.userCheck) {
            return this.userCheck.authUser(uid);
        }
        else {
            return new Promise((resolve, reject) => reject("No UserCheck object."));
        }
    }
}
exports.Webserver = Webserver;
//# sourceMappingURL=webserver.js.map