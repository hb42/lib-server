import { SearchOptions } from "ldapjs";
export declare class ADService {
    private client;
    private log;
    constructor();
    bind(ldapUrl: string, ldapUser: string, ldapPwd: string): Promise<boolean>;
    unbind(): void;
    query(base: string, opts: SearchOptions): Promise<any[]>;
}
