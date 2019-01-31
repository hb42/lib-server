"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ldapjs_1 = require("ldapjs");
const _1 = require(".");
class ADService {
    constructor() {
        this.log = _1.LoggerService.get("lib-server.server.services.ADService");
        this.log.debug("c'tor ADService");
    }
    bind(ldapUrl, ldapUser, ldapPwd) {
        return new Promise((resolve, reject) => {
            if (this.client) {
                this.log.debug("bind() on already connected AD");
                resolve(false);
            }
            this.log.debug("connecting to AD...");
            this.client = ldapjs_1.createClient({ url: ldapUrl, connectTimeout: 5000 });
            if (this.client) {
                this.log.debug("binding to AD...");
                this.client.bind(ldapUser, ldapPwd, (err) => {
                    if (err) {
                        const e = "error binding " + err;
                        this.log.error(e);
                        reject(e);
                    }
                    else {
                        this.log.info("success binding to AD");
                        resolve(true);
                    }
                });
            }
            else {
                const e = "ERROR: timeout connecting to AD";
                this.log.error(e);
                reject(e);
            }
        });
    }
    unbind() {
        if (!this.client) {
            this.log.debug("unbind() on already unbound AD");
            return;
        }
        this.client.unbind((uberr) => {
            if (uberr) {
                this.log.error("error unbinding " + uberr);
            }
            else {
                this.log.info("successfuly disconnected AD");
            }
            this.client = null;
        });
    }
    query(base, opts) {
        this.log.info("query start");
        const rc = [];
        return new Promise((resolve, reject) => {
            if (!this.client) {
                reject("calling query() on unbound LDAP");
            }
            else {
                this.client.search(base, opts, (err, res) => {
                    if (err) {
                        this.log.error("LDAP query error: " + err.message);
                        reject("LADP query error: " + err.message);
                    }
                    else {
                        res.on("searchEntry", (entry) => {
                            rc.push(entry.object);
                        });
                        res.on("searchReference", (referral) => {
                            this.log.info("referral: " + referral.uris.join());
                        });
                        res.on("error", (e) => {
                            this.log.error("LDAP query error: " + e.message);
                            reject("LDAP query error: " + e.message);
                        });
                        res.on("end", (result) => {
                            this.log.info("query on.end");
                            resolve(rc);
                        });
                    }
                });
            }
        });
    }
}
exports.ADService = ADService;
//# sourceMappingURL=ad.service.js.map