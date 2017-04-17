/**
 * Created by hb on 07.03.17.
 */

import * as log4js from "log4js";
/*
 LOG4JS  -> https://github.com/nomiddlename/log4js-node
 Loglevels

 OFF
 FATAL
 ERROR
 WARN
 INFO
 DEBUG
 TRACE
 ALL

  Fehler bei patternLayout() ist OK. In @types/log4js wird nur Layout als "(evt: event): string" definiert
  und keine Ausnahme fuer patternLayout. 
 */

export class LoggerService {

  /**
   * Dateiname fuer Logfile setzen
   *
   * @param filename
   */
  public static init(filename: string) {
    this.logFileName = filename;
    this.check();
  }

  /**
   * Logger fuer eine Kategorie holen
   *
   * @param logname - Log-Kategorie
   * @returns {Logger}
   */
  public static get(logname: string): log4js.Logger {
    this.check();
    return log4js.getLogger(logname);
  }

  /**
   * Logger fuer eine zusaetzliche Datei holen
   *
   * @param logname - Log-Kategorie
   * @param filename- Logdatei
   * @returns {log4js.Logger}
   */
  public static getFile(logname: string, filename: string) {
    this.check();
    // function fileAppender(file, layout, logSize, numBackups, options, timezoneOffset)
    log4js.addAppender(log4js.appenders.file(filename, log4js.layouts.patternLayout(LoggerService.stdPattern + "%m"),
                                             1024000, 20), logname);
    return this.get(logname);
  }

  /**
   * Logger fuer express/connect
   *
   * @param logname
   * @param filename
   * @returns {express.Handler}
   */
  public static getWeb(logname: string, filename: string) {
    // const DEFAULT_FORMAT = ':remote-addr - -' +
    //     ' ":method :url HTTP/:http-version"' +
    //     ' :status :content-length ":referrer"' +
    //     ' ":user-agent"';
    // sonst header fields: req[cookie] res[field]
    const form = ":remote-addr -- :method :url HTTP/:http-version :status :content-length \":referrer\"";
    return log4js.connectLogger(this.getFile(logname, filename), { format: form, level: "auto" });
  }

  /**
   * Console-Logging einschalten
   */
  public static useConsole() {
    this.check();
    if (!log4js.appenders.console) {
      log4js.loadAppender("console");
      // Syntax ist OK, Fehler ist vermutlich auf @types zurueckzufuehren
      log4js.addAppender(log4js.appenders.console(log4js.layouts
                                                      .patternLayout("%[" + LoggerService.stdPattern + "%] %m")));
      log4js.replaceConsole();
    }
  }

  private static instance;
  private static logFileName: string;
  private static stdPattern = "%d{ISO8601} %-5p [%c] ";

  /**
   * LOG4JS initialisieren, sofern noch nicht geschehen
   */
  private static check() {
    if (!this.instance) {
      this.instance = new this();
    }
  }

  private constructor() {
    log4js.configure( {
      appenders: [
        {
          type: "file",
          filename: LoggerService.logFileName || "server.log",
          maxLogSize: 10000000,
          backups: 10,
          layout: {
            type: "pattern",
            pattern: LoggerService.stdPattern + "%m",
          },
        },
      ],
      levels: {
        "[all]": "TRACE",
      },
    } );
  }

}
