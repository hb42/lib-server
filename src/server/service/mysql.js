/**
 * Created by hb on 18.09.16.
 */
"use strict";
var mysql = require("mysql");
var MySQL = (function () {
    function MySQL(srv, db, usr, pwd) {
        // options: https://github.com/mysqljs/mysql#pool-options
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
        this.pool.on("connection", function (connection) {
            // connection.query('SET SESSION auto_increment_increment=1')
            console.info("INFO pool on connection");
        });
    }
    MySQL.prototype.query = function (q, cb) {
        console.info("INFO query #" + this.cnt++);
        this.pool.getConnection(function (err, connection) {
            if (err) {
                console.error("Error in pool.getConnection: " + err);
                cb(null);
                return;
            }
            connection.on("error", function (er3) {
                console.error("Error in connectio: " + er3);
                cb(null);
            });
            console.info("INFO connected as id " + connection.threadId);
            connection.query(q, function (er2, rows) {
                connection.release();
                if (er2) {
                    console.error("Error in query: " + er2);
                    cb(null);
                }
                cb(rows);
            });
        });
    };
    return MySQL;
}());
exports.MySQL = MySQL;
