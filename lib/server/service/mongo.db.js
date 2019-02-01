"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose = require("mongoose");
const logger_service_1 = require("./logger.service");
mongoose.Promise = Promise;
class MongoDB {
    constructor(srv, db, port, opts) {
        this.opts = opts;
        this.log = logger_service_1.LoggerService.get("lib-server.server.service.MongoDB");
        this.dbUrl = "mongodb://" + srv + ":" + port + "/" + db;
        opts = Object.assign({}, opts, { poolSize: 200, reconnectTries: 100, reconnectInterval: 1000, autoReconnect: true, keepAlive: true, connectTimeoutMS: 0, socketTimeoutMS: 0, useNewUrlParser: true });
        this.dbver = this.connect(this.dbUrl, opts);
    }
    get mongodbVersion() {
        return this.dbver;
    }
    getConnection() {
        return this.connection;
    }
    close() {
        return new Promise((resolve) => {
            this.connection.close(() => {
                resolve("Mongoose connection " + this.dbUrl + " disconnected.");
            });
        });
    }
    connect(url, opts) {
        return new Promise((resolve, reject) => {
            this.connection = mongoose.createConnection(url, opts);
            this.connection.once("open", () => {
                const admin = this.connection.db.admin();
                admin.serverStatus((err, info) => {
                    if (err) {
                        this.log.error("error at serverStatus");
                        this.log.error(err);
                        return;
                    }
                    this.log.info("succesfully connected to " + this.dbUrl + " (mongoDB " + info.version + ")");
                    resolve(info.version);
                });
            });
            this.connection.on("error", (err) => {
                this.log.error(this.dbUrl + " connection error: " + err);
                reject(null);
            });
        });
    }
}
exports.MongoDB = MongoDB;
//# sourceMappingURL=mongo.db.js.map