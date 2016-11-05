/**
 * Created by hb on 07.08.16.
 */

export interface UserCheck {
  /**
   * check user/pwd
   *
   * returns Promise<string> -> UID || null/error
   *
   * @param uid - UserID from NTLM- or None- or Form-Auth
   * @param pwd - Password from Form-Auth
   */
  authUser(uid: string, pwd?: string): Promise<string>;

  /**
   * returns user data object
   * (wird i.d.R. in authUser geholt)
   */
  getUserData(): any;

  /**
   * save user data object
   *
   * @param id - record ID
   * @param data - user data
   */
  setUserData(id: string, data: any): Promise<any>;
}
