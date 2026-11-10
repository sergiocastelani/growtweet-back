import request from "supertest";
import { createApp } from "../../src/create_server";
import { IUser, User } from "../../src/models/user";
import { prismaMock } from "../config/prisma.mock";
import bcrypt from "bcryptjs";

const createTestUser = (): IUser => 
{
    return new User(
        1,
        "username",
        "email",
        "name",
        bcrypt.hashSync("password", 4),
        "pictureUrl"
    );
}

describe('Auth endpoints', () => 
{
    test("/auth/login must fail on wrong credentials", async () => {
        const server = createApp();
        prismaMock.user.findUnique.mockResolvedValue(createTestUser());

        const result = await request(server)
            .post("/auth/login")
            .send({email: "email", password: "password_wrong"});

        expect(result.statusCode).toBe(400);
        expect(result.body).toHaveProperty('success', false);
        expect(result.body).toHaveProperty('message', "Invalid user/password");
        expect(result.body).not.toHaveProperty('data');
    });

    test("/auth/login must succeed", async () => {
        const server = createApp();
        prismaMock.user.findUnique.mockResolvedValue(createTestUser());

        const result = await request(server)
            .post("/auth/login")
            .send({email: "email", password: "password"});

        expect(result.statusCode).toBe(200);
        expect(result.body).toHaveProperty('success', true);
        expect(result.body).toHaveProperty('message', "Logged in");
        expect(result.body).toHaveProperty('data');
        expect(result.body.data).toContain('eyJ');
    });

});

