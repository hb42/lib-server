"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jwt = require("jsonwebtoken");
const lib_common_1 = require("@hb42/lib-common");
class AuthService {
    constructor(secret, timeoutSec) {
        this.secret = secret;
        this.timeoutSec = timeoutSec;
    }
    newToken(payload) {
        return jwt.sign({ data: payload }, this.secret, { expiresIn: this.timeoutSec });
    }
    checkToken(req) {
        const token = req.get(lib_common_1.JwtHeader);
        let decoded = null;
        if (token) {
            try {
                decoded = jwt.verify(token, this.secret);
                if (!decoded) {
                    decoded = { data: {} };
                }
                if (!decoded.data) {
                    decoded.data = {};
                }
                req["session"] = decoded;
            }
            catch (err) {
                console.error("Error validating JWT-token " + err.message);
            }
        }
        return decoded !== null;
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.service.js.map