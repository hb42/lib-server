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

 */

/**
 * Hilfsklasse fuer log4js
 *
 * Momentan erst einmal nur als zentraler Ort fuer die Konfiguration. Die Klasse
 * muss einmalig mit einer Konfigurations-Datei initialisiert werden.
 */
export class LoggerService {

  /**
   * log4js mit der uebergebenen Config-Datei starten
   *
   * @param filename
   */
  public static init(filename: string) {
    this.shutdown();
    this.instance = new this(filename);
  }

  /**
   * Logger fuer eine Kategorie holen
   *
   * Die Kategorie wird zusammen mit den Meldungen ins Log geschrieben
   *
   * @param logname - Log-Kategorie
   * @returns {Logger}
   */
  public static get(logname: string): log4js.Logger {
    if (this.instance) {
      return log4js.getLogger(logname);
    } else {
      // noch nicht initialisiert => std logger (console)
      const logger: log4js.Logger = log4js.getLogger(logname);
      logger.level = "all";  // alles ausgeben
      return logger;
    }
  }

  /**
   * log4js geordnet beenden
   *
   */
  public static shutdown() {
    if (this.instance) {
      log4js.shutdown();
      this.instance = null;
    }
  }

  private static instance: LoggerService | null;

  private constructor(confFile: string) {
    log4js.configure(confFile);
  }

}
