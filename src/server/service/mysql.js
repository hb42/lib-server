"use strict";
const mysql = require("mysql");
class MySQL {
    constructor(srv, db, usr, pwd) {
        this.pool = mysql.createPool({
            host: srv,
            user: usr,
            password: pwd,
            database: db,
            debug: false,
            acquireTimeout: 10000,
            connectionLimit: 100,
            queueLimit: 0,
            waitForConnections: true,
        });
        this.cnt = 0;
        this.pool.on("connection", (connection) => {
            console.info("INFO pool on connection");
        });
    }
    query(q, cb) {
        console.info("INFO query #" + this.cnt++);
        this.pool.getConnection((err, connection) => {
            if (err) {
                console.error("Error in pool.getConnection: " + err);
                cb(null);
                return;
            }
            connection.on("error", (er3) => {
                console.error("Error in connectio: " + er3);
                cb(null);
            });
            console.info("INFO connected as id " + connection.threadId);
            connection.query(q, (er2, rows) => {
                connection.release();
                if (er2) {
                    console.error("Error in query: " + er2);
                    cb(null);
                }
                cb(rows);
            });
        });
    }
}
exports.MySQL = MySQL;
//# sourceMappingURL=mysql.js.map