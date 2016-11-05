"use strict";
const mongoose = require("mongoose");
mongoose.Promise = Promise;
class MongoDB {
    constructor(srv, db, port, opts) {
        this.srv = srv;
        this.db = db;
        this.port = port;
        this.opts = opts;
        this.connection = mongoose.connection;
        opts.server = {
            poolSize: 100,
            reconnectTries: 100,
            reconnectInterval: 1000,
            socketOptions: {
                autoReconnect: true,
                keepAlive: 5000,
                connectTimeoutMS: 0,
                socketTimeoutMS: 0,
            },
        };
        this.connect();
    }
    getConnection() {
        return this.connection;
    }
    close() {
        return new Promise((resolve) => {
            this.connection.close(() => {
                resolve("Mongoose connection " + this.srv + "/" + this.db + " disconnected.");
            });
        });
    }
    connect() {
        this.connection.open(this.srv, this.db, this.port, this.opts);
        this.connection.once("open", () => {
            console.info("succesfully connected to mongodb " + this.srv + "/" + this.db);
        });
        this.connection.on("error", (err) => {
            console.error("mongodb " + this.srv + "/" + this.db + " connection error: " + err);
        });
    }
}
exports.MongoDB = MongoDB;
//# sourceMappingURL=mongo.db.js.map