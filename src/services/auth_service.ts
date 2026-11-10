import { userDAO } from "../daos/_setup";
import { IUserSecureInfo, UserSecureInfo } from "../models/user_secure_info";
import { ErrorResult, ServiceResponse, ServiceResponseAsync, SuccessResult } from "./services_types";
import { verifyPassword } from "./password_utils";
import jwt from "jsonwebtoken";

export class AuthService 
{
    public async login(email: string, password: string) : ServiceResponseAsync<string>
    {
        if(!email)
            return ErrorResult(400, "'email' field is required");

        if(!password)
            return ErrorResult(400, "'password' field is required");

        const user = await userDAO.getByEmail(email);
        if(!user || !(await verifyPassword(password, user.password)))
            return ErrorResult(400, "Invalid user/password");

        return { 
            statusCode: 200, 
            success: true, 
            message: "Logged in", 
            data: this.createToken(user)
        }
    }

    public validateToken(authToken: string) : ServiceResponse<IUserSecureInfo>
    {
        try
        {
            const payload = jwt.verify(authToken, process.env.JWT_PASSWORD!) as IUserSecureInfo;
            return SuccessResult("Authorized", payload);
        }
        catch(e)
        {
            return ErrorResult(401, "Unauthorized");
        }
    }

    public decodeToken(authToken: string) : IUserSecureInfo | null
    {
        return jwt.decode(authToken) as (IUserSecureInfo | null);
    }

    public createToken(user: UserSecureInfo) : string
    {
        return jwt.sign({
            id: user.id,
            username: user.username,
            email: user.email,
            name: user.name,
            pictureUrl: user.pictureUrl
        } as IUserSecureInfo, process.env.JWT_PASSWORD!, { expiresIn: "1d" });

    }
}
