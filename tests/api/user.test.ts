import request from "supertest";
import { createApp } from "../../src/create_server";
import { IUser, User } from "../../src/models/user";
import { prismaMock } from "../config/prisma.mock";

const createTestUser = (): IUser => 
{
    return new User(
        1,
        "username",
        "email",
        "name",
        "password",
        "pictureUrl"
    );
}

describe('User endpoints', () => 
{
    test("/user must succeed", async () => {
        const server = createApp();
        const testUser = createTestUser();
        prismaMock.user.findUnique.mockResolvedValue(testUser);

        const result = await request(server).get("/user/1").send();

        expect(result.statusCode).toBe(200);
        expect(result.body).toHaveProperty("success");
        expect(result.body.success).toEqual(true);
        expect(result.body).toHaveProperty("data");
        const { password, ...publicUser } = testUser;
        expect(result.body.data).toEqual(publicUser);
        expect(result.body.data).not.toHaveProperty("password");
    });

    test("/user/:id must fail on inexistent user", async () => {
        const server = createApp();
        const testUser = createTestUser();
        prismaMock.user.findUnique.mockResolvedValue(null);

        const result = await request(server).get("/user/1").send();

        expect(result.statusCode).toBe(404);
        expect(result.body).toHaveProperty("success");
        expect(result.body.success).toEqual(false);
        expect(result.body).not.toHaveProperty("data");
    });

});

