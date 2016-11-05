/**
 * Created by hb on 29.05.16.
 */

import * as mongoose from "mongoose";

// ES6 native Promise in Mongoose: mongoose.Promise = global.Promise
// (die (<any> Konstruktion ist noetig wg. Typescript-Error TS2450)
// ausserdem index.d.ts mit: type MongoosePromise<T> = Promise<T>;
// ES5 ext. lib einbinden: mongoose.Promise = require('q').Promise; | = require('bluebird');
// (mongoose v5 wird in ES5 bluebird verwenden)
(<any> mongoose).Promise = Promise;

// var Schema = mongoose.Schema;
// var ObjectId = Schema.Types.ObjectId;

/* Multiple Connections:
  var conn = mongoose.createConnection(...)
  -> models sind an connection gebunden => *.model.ts muesste angepasst werden
 http://mongoosejs.com/docs/connections.html
 */

export class MongoDB {
  private connection: mongoose.Connection;

  /*  Mongogoose connection
   *  opts enthaelt credentials: { user: config.mongodbUser, pass: config.mongodbPwd }
   */
  constructor(private srv: string, private db: string, private port: number, private opts: mongoose.ConnectionOptions) {
    opts.server = {
      poolSize: 100,            // Number of connections in the connection pool for each server instance (default 5)
      reconnectTries: 100,     // Server attempt to reconnect #times (default 30)
      reconnectInterval: 1000, // Server will wait # milliseconds between retries (default 1000)
      socketOptions: {
        autoReconnect: true,   // Reconnect on error (default true)
        keepAlive: 5000,       // TCP KeepAlive on the socket with a X ms delay before start (default 0)
        connectTimeoutMS: 0,   // TCP Connection timeout setting (default 0)
        socketTimeoutMS: 0,    // TCP Socket timeout setting (default 0)
      },
    };

    this.connect();
  }

  public getConnection(): mongoose.Connection {
    return this.connection;
  }

  public close(): Promise<string> {
    return new Promise((resolve) => {
      this.connection.close( () => {
        // console.log("Mongoose connection " + srv + " disconnected.");
        resolve("Mongoose connection " + this.srv + "/" + this.db + " disconnected.");
      });
    });

  }

  private connect(): void {
    this.connection = mongoose.createConnection();
    this.connection.open(this.srv, this.db, this.port, this.opts);

    this.connection.once("open", () => {
      console.info("succesfully connected to mongodb " + this.srv + "/" + this.db);
    });
    this.connection.on("error", (err: Error) => {
      console.error("mongodb " + this.srv + "/" + this.db  + " connection error: " + err);
    });
  }

}
