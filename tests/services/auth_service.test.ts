import { AuthService } from "../../src/services/auth_service";
import { userDAO } from "../../src/daos/_setup";
import { User } from "../../src/models/user";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { UserSecureInfo } from "../../src/models/user_secure_info";

jest.mock('../../src/daos/_setup');
const userDAOMock = userDAO as jest.Mocked<typeof userDAO>;

beforeEach(() => jest.resetAllMocks());

describe('Test for AuthService class', () => 
{
    test('login() must fail on missing email field', async () => 
    {
        const sut = new AuthService();

        const email : any = undefined;
        const result = await sut.login(email, 'password');

        expect(result).toHaveProperty('success', false);
        expect(result).toHaveProperty('statusCode', 400);
        expect(result).toHaveProperty('message', "'email' field is required");
    });

    test('login() must fail on missing password field', async () => 
    {
        const sut = new AuthService();

        const password : any = undefined;
        const result = await sut.login('email', password);

        expect(result).toHaveProperty('success', false);
        expect(result).toHaveProperty('statusCode', 400);
        expect(result).toHaveProperty('message', "'password' field is required");
    });

    test('login() must fail on unregistered email', async () => 
    {
        const sut = new AuthService();
        userDAOMock.getByEmail.mockResolvedValue(null);

        const result = await sut.login('email', 'password');

        expect(userDAOMock.getByEmail).toHaveBeenCalled();
        expect(result).toHaveProperty('success', false);
        expect(result).toHaveProperty('statusCode', 400);
        expect(result).toHaveProperty('message', "Invalid user/password");
    });

    test('login() must fail on wrong password', async () => 
    {
        const sut = new AuthService();
        userDAOMock.getByEmail.mockResolvedValue(new User(
            0, //id
            'username', 
            'email@gmail.com', 
            'name', 
            bcrypt.hashSync('password-1234', 4), 
            'pictureUrl'
        ));

        const result = await sut.login('email@gmail.com', '123');

        expect(userDAOMock.getByEmail).toHaveBeenCalled();
        expect(result).toHaveProperty('success', false);
        expect(result).toHaveProperty('statusCode', 400);
        expect(result).toHaveProperty('message', "Invalid user/password");
    });

    test('login() must succeed on valid login data', async () => 
    {
        const sut = new AuthService();
        userDAOMock.getByEmail.mockResolvedValue(new User(
            0, //id
            'username', 
            'email@gmail.com', 
            'name', 
            bcrypt.hashSync('password-1234', 4), 
            'pictureUrl'
        ));

        const result = await sut.login('email@gmail.com', 'password-1234');

        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('statusCode', 200);
        expect(result).toHaveProperty('message', "Logged in");
        expect(result).toHaveProperty('data');
        expect(result.data).toContain('eyJ');
    });

    test('validateToken() must return error on invalid token', () => 
    {
        const sut = new AuthService();

        const result = sut.validateToken('');

        expect(result).toHaveProperty('success', false);
        expect(result).toHaveProperty('statusCode', 401);
        expect(result).toHaveProperty('message', "Unauthorized");
        expect(result).not.toHaveProperty('data');
    });

    test('validateToken() must succeed on valid token', () => 
    {
        const sut = new AuthService();
        jest.spyOn(jwt, 'verify').mockImplementation(() => new UserSecureInfo(
            0, //id
            'username',
            'email',
            'name',
            null
        ));

        const result = sut.validateToken('aaaaa');

        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('statusCode', 200);
        expect(result).toHaveProperty('message', "Authorized");
        expect(result).toHaveProperty('data');
        expect(result.data?.email).toBe('email');
    });

    test('decoteToken() can decode JWT token', () => 
    {
        const sut = new AuthService();

        const token = sut.decodeToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiSm9obiBEb2UifQ.DjwRE2jZhren2Wt37t5hlVru6Myq4AhpGLiiefF69u8');

        expect(token).toHaveProperty('name', 'John Doe');
    });
});