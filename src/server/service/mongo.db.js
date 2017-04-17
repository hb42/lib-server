/**
 * Created by hb on 29.05.16.
 */
"use strict";
var mongoose = require("mongoose");
// ES6 native Promise in Mongoose: mongoose.Promise = global.Promise
// (die (<any> Konstruktion ist noetig wg. Typescript-Error TS2450)
// ausserdem index.d.ts mit: type MongoosePromise<T> = Promise<T>;
// ES5 ext. lib einbinden: mongoose.Promise = require('q').Promise; | = require('bluebird');
// (mongoose v5 wird in ES5 bluebird verwenden)
mongoose.Promise = Promise;
// var Schema = mongoose.Schema;
// var ObjectId = Schema.Types.ObjectId;
/* Multiple Connections:
  var conn = mongoose.createConnection(...)
  -> models sind an connection gebunden => *.model.ts muesste angepasst werden
 http://mongoosejs.com/docs/connections.html
 */
var MongoDB = (function () {
    /*  Mongogoose connection
     *  opts enthaelt credentials: { user: config.mongodbUser, pass: config.mongodbPwd }
     */
    function MongoDB(srv, db, port, opts) {
        this.srv = srv;
        this.db = db;
        this.port = port;
        this.opts = opts;
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
    MongoDB.prototype.getConnection = function () {
        return this.connection;
    };
    MongoDB.prototype.close = function () {
        var _this = this;
        return new Promise(function (resolve) {
            _this.connection.close(function () {
                // console.log("Mongoose connection " + srv + " disconnected.");
                resolve("Mongoose connection " + _this.srv + "/" + _this.db + " disconnected.");
            });
        });
    };
    MongoDB.prototype.connect = function () {
        var _this = this;
        this.connection = mongoose.createConnection();
        this.connection.open(this.srv, this.db, this.port, this.opts);
        this.connection.once("open", function () {
            console.info("succesfully connected to mongodb " + _this.srv + "/" + _this.db);
        });
        this.connection.on("error", function (err) {
            console.error("mongodb " + _this.srv + "/" + _this.db + " connection error: " + err);
        });
    };
    return MongoDB;
}());
exports.MongoDB = MongoDB;
