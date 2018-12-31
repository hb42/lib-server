
import { EventEmitter } from "events";
import { Request, Response } from "express";

/**
 * Server-Sent Event instance class
 * (Inspiration: https://github.com/dpskvn/express-sse)
 *
 * SSE funktioniert nicht sauber mit komprimierten Verbindungen (es kommt im Client nichts an).
 * => app.use(compression()); nicht verwenden!
 *
 * @extends EventEmitter
 */
export class ServerSentEvent extends EventEmitter {
  /**
   * Creates a new Server-Sent Event instance
   */
  constructor() {
    super();
  }

  /**
   * The SSE route handler
   *
   * Fat Arrow, damit 'this' bei der Uebergabe als Funktions-Parameter
   * erhalten bleibt, z.B. app.get("test", sse.init)
   */
  public init = (req: Request, res: Response) => {
    let id = 0;
    req.socket.setTimeout(0);
    req.socket.setNoDelay(true);
    req.socket.setKeepAlive(true);
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    // res.setHeader("Content-Encoding", "deflate");  // doesn't help w/compression

    // Increase number of event listeners on init
    this.setMaxListeners(this.getMaxListeners() + 1);

    const dataListener = (data: any) => {
      if (data.id) {
        res.write(`id: ${data.id}\n`);
      } else {
        res.write(`id: ${id}\n`);
        id += 1;
      }
      if (data.event) {
        res.write(`event: ${data.event}\n`);
      }
      res.write(`data: ${JSON.stringify(data.data)}\n\n`);
    };

    this.on("data", dataListener);

    // we're up and running
    setTimeout(() => {
      this.send("OK", "init", id++);
    }, 10);

    // Remove listeners and reduce the number of max listeners on client disconnect
    req.on("close", () => {
      this.removeListener("data", dataListener);
      this.setMaxListeners(this.getMaxListeners() - 1);
    });
  }

  /**
   * Send data to the SSE
   * @param {(object|string)} data Data to send into the stream
   * @param {string} event Event name
   * @param {(string|number)} id Custom event ID
   */
  public send(data: any, event?: string, id?: string | number) {
    this.emit("data", { data, event, id });
  }

}
