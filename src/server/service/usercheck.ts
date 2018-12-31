/**
 * Created by hb on 07.08.16.
 */

export interface UserCheck {
  /**
   * check user/pwd
   *
   * returns Promise<string> -> UID || null/error
   *
   * @param uid - UserID for NTLM- or None- or Form-Auth
   * @param pwd - Password for Form-Auth
   */
  authUser(uid: string, pwd?: string): Promise<string | null>;

  /**
   * returns user object || null
   * (wird i.d.R. in authUser geholt)
   */
  getUser(uid: string): Promise<any>;

  /**
   * return key for JWT token
   *
   * @returns {string}
   */
  getJwtSecret(): string;

  /**
   * return timeout seconds for JWT token
   *
   */
  getJwtTimeout(): number;

}
