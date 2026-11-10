import { IUser } from "./user";

export interface IUserSecureInfo
{
    id: number;
    username: string;
    email: string;
    name: string;
    pictureUrl: string | null;
}

export class UserSecureInfo implements IUserSecureInfo {
    constructor(
        public id: number,
        public username: string,
        public email: string,
        public name: string,
        public pictureUrl: string | null,
    )
    {}

    static FromUser(user: IUser)
    {
        return new UserSecureInfo(user.id, user.username, user.email, user.name, user.pictureUrl);
    }
}

