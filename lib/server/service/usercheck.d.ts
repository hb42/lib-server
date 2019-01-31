export interface UserCheck {
    authUser(uid: string, pwd?: string): Promise<string | null>;
    getUser(uid: string): Promise<any>;
    getJwtSecret(): string;
    getJwtTimeout(): number;
}
