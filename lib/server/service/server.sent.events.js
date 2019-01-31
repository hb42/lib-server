"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
class ServerSentEvent extends events_1.EventEmitter {
    constructor() {
        super();
        this.init = (req, res) => {
            let id = 0;
            req.socket.setTimeout(0);
            req.socket.setNoDelay(true);
            req.socket.setKeepAlive(true);
            res.statusCode = 200;
            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Connection", "keep-alive");
            this.setMaxListeners(this.getMaxListeners() + 1);
            const dataListener = (data) => {
                if (data.id) {
                    res.write(`id: ${data.id}\n`);
                }
                else {
                    res.write(`id: ${id}\n`);
                    id += 1;
                }
                if (data.event) {
                    res.write(`event: ${data.event}\n`);
                }
                res.write(`data: ${JSON.stringify(data.data)}\n\n`);
            };
            this.on("data", dataListener);
            setTimeout(() => {
                this.send("OK", "init", id++);
            }, 10);
            req.on("close", () => {
                this.removeListener("data", dataListener);
                this.setMaxListeners(this.getMaxListeners() - 1);
            });
        };
    }
    send(data, event, id) {
        this.emit("data", { data, event, id });
    }
}
exports.ServerSentEvent = ServerSentEvent;
//# sourceMappingURL=server.sent.events.js.map