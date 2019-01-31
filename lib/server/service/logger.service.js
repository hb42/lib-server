"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const log4js = require("log4js");
class LoggerService {
    static init(filename) {
        this.shutdown();
        this.instance = new this(filename);
    }
    static get(logname) {
        if (this.instance) {
            return log4js.getLogger(logname);
        }
        else {
            const logger = log4js.getLogger(logname);
            logger.level = "all";
            return logger;
        }
    }
    static shutdown() {
        if (this.instance) {
            log4js.shutdown();
            this.instance = null;
        }
    }
    constructor(confFile) {
        log4js.configure(confFile);
    }
}
exports.LoggerService = LoggerService;
//# sourceMappingURL=logger.service.js.map