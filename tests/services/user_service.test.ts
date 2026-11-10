import { UserService } from "../../src/services/user_service";
import { userDAO } from "../../src/daos/_setup";
import { IUser, User } from "../../src/models/user";
import { ErrorResult, SuccessResult } from "../../src/services/services_types";
import { UserUpdateRequest } from "../../src/models/requests/user_update_request";
import { UserDisplay } from "../../src/models/user_display";
import bcrypt from "bcryptjs";

jest.mock('../../src/daos/_setup');
const userDAOMock = userDAO as jest.Mocked<typeof userDAO>;

beforeEach(() => jest.resetAllMocks());

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

const testUserPlainPassword = "password";

const createUpdateRequest = () => ({
    username: "username_changed",
    email: "email_changed",
    name: "name_changed",
    currentPassword: "password",
    newPassword: "newPassword",
    pictureUrl: "pictureUrl_changed"
});

describe('Test for UserService class', () => 
{
    test('User types constructors', () => 
    {
        const user = createTestUser()
        const userDisplay1 = new UserDisplay(1, "username", "name", null);
        const userDisplay2 = UserDisplay.FromUser(user);

        expect(user.email).toBe("email");
        expect(userDisplay1.username).toBe("username");
        expect(userDisplay2.username).toBe(user.username);
    });

    test('getById() must fail on inexistent user ID', async () => 
    {
        const sut = new UserService();
        userDAOMock.getById.mockResolvedValue(null);

        const result = await sut.getById(1);

        expect(userDAOMock.getById).toHaveBeenCalled();
        expect(result).toHaveProperty('success', false);
        expect(result).toHaveProperty('statusCode', 404);
        expect(result).toHaveProperty('message', "User not found");
        expect(result.data).toBeUndefined();
    });

    test('getById() must succeed on valid user ID', async () => 
    {
        const sut = new UserService();
        userDAOMock.getById.mockResolvedValue(createTestUser());

        const result = await sut.getById(1);

        expect(userDAOMock.getById).toHaveBeenCalled();
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('statusCode', 200);
        expect(result).toHaveProperty('message', "User found");
        expect(result.data).toBeDefined();
        expect(result.data!.id).toBe(1);
    });

    test('create() must fail on invalid inputs', async () => 
    {
        const sut = new UserService();
        jest.spyOn(sut, 'validateNewUser').mockResolvedValue(ErrorResult(400, "Bad input"));

        const result = await sut.create(createTestUser());

        expect(sut.validateNewUser).toHaveBeenCalled();
        expect(result).toHaveProperty('success', false);
        expect(result).toHaveProperty('statusCode', 400);
        expect(result).toHaveProperty('message', "Bad input");
        expect(result.data).toBeUndefined();
    });

    test('create() must succeed', async () => 
    {
        const sut = new UserService();
        jest.spyOn(sut, 'validateNewUser').mockResolvedValue(SuccessResult("Ok"));
        userDAOMock.insert.mockImplementation(async (user: IUser) => user);

        const result = await sut.create({...createTestUser(), password: testUserPlainPassword});

        expect(sut.validateNewUser).toHaveBeenCalled();
        expect(userDAOMock.insert).toHaveBeenCalled();
        const insertedUser = userDAOMock.insert.mock.calls[0][0];
        expect(insertedUser.password).not.toBe(testUserPlainPassword);
        expect(bcrypt.compareSync(testUserPlainPassword, insertedUser.password)).toBe(true);
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('statusCode', 200);
        expect(result).toHaveProperty('message', "User created");
        expect(result.data).toBeDefined();
        expect(result.data!.id).toBe(1);
    });

    test('update() must fail on invalid inputs', async () => 
    {
        const sut = new UserService();
        jest.spyOn(sut, 'validateUpdateRequest').mockResolvedValue(ErrorResult(400, "Bad input"));

        const testUser = createTestUser();
        userDAOMock.getById.mockResolvedValue(testUser);
        const updateRequest = createUpdateRequest();
        const result = await sut.update(testUser.id, updateRequest);

        expect(sut.validateUpdateRequest).toHaveBeenCalled();
        expect(result).toHaveProperty('success', false);
        expect(result).toHaveProperty('statusCode', 400);
        expect(result).toHaveProperty('message', "Bad input");
        expect(result.data).toBeUndefined();
    });

    test('update() must return updated user', async () => 
    {
        const sut = new UserService();
        const testUser = createTestUser();
        const updateRequest = createUpdateRequest();
        userDAOMock.getById.mockResolvedValue(testUser);
        userDAOMock.update.mockImplementation(async (user: IUser) => user);
        jest.spyOn(sut, 'validateUpdateRequest').mockResolvedValue(SuccessResult("Ok"));

        const result = await sut.update(testUser.id, updateRequest);

        expect(sut.validateUpdateRequest).toHaveBeenCalled();
        expect(userDAOMock.update).toHaveBeenCalled();
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('statusCode', 200);
        expect(result).toHaveProperty('message', "User updated");
        expect(result.data).toBeDefined();
        expect(result.data?.id).toBe(testUser.id);
        expect(result.data?.email).toBe(updateRequest.email);
        expect(result.data?.name).toBe(updateRequest.name);
        expect(result.data?.username).toBe(updateRequest.username);
        expect(result.data?.pictureUrl).toBe(updateRequest.pictureUrl);
        expect(result.data?.password).not.toBe(updateRequest.newPassword);
        expect(bcrypt.compareSync(updateRequest.newPassword, result.data!.password)).toBe(true);
    });

    test('update() must keep stored password hash when no new password is sent', async () => 
    {
        const sut = new UserService();
        const testUser = createTestUser();
        const { newPassword, ...updateRequest } = createUpdateRequest();
        userDAOMock.getById.mockResolvedValue(testUser);
        userDAOMock.update.mockImplementation(async (user: IUser) => user);
        jest.spyOn(sut, 'validateUpdateRequest').mockResolvedValue(SuccessResult("Ok"));

        const result = await sut.update(testUser.id, updateRequest);

        expect(result).toHaveProperty('success', true);
        expect(result.data?.password).toBe(testUser.password);
    });

    test('update() must fail on inexistent user ID', async () => 
    {
        const sut = new UserService();
        userDAOMock.getById.mockResolvedValue(null);

        const result = await sut.update(1, createUpdateRequest());

        expect(result).toHaveProperty('success', false);
        expect(result).toHaveProperty('statusCode', 404);
        expect(result).toHaveProperty('message', "User not found");
    });

    test('validateNewUser() must succeed', async () => 
    {
        const sut = new UserService();
        const testUser = createTestUser();

        const result = await sut.validateNewUser(testUser);

        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('statusCode', 200);
        expect(result).toHaveProperty('message', "Valid user");
        expect(result.data).toBeUndefined();
    });

    test('validateNewUser() must fail if email exists already', async () => 
    {
        const sut = new UserService();
        const testUser = createTestUser();
        userDAOMock.getByEmail.mockResolvedValue(testUser)

        const result = await sut.validateNewUser(testUser);

        expect(result).toHaveProperty('success', false);
        expect(result).toHaveProperty('statusCode', 400);
        expect(result).toHaveProperty('message', "This email is already being used");
        expect(result.data).toBeUndefined();
    });

    test('validateNewUser() must fail if username exists already', async () => 
    {
        const sut = new UserService();
        const testUser = createTestUser();
        userDAOMock.getByUsername.mockResolvedValue(testUser)

        const result = await sut.validateNewUser(testUser);

        expect(result).toHaveProperty('success', false);
        expect(result).toHaveProperty('statusCode', 400);
        expect(result).toHaveProperty('message', "This username is already being used");
        expect(result.data).toBeUndefined();
    });

    const validateNewUserCases = [
        //[error message, IUser]
        ["'username' field must be informed", {id: 1, username: "", email: "email", name: "name", password: "password", pictureUrl: null}],
        ["'email' field must be informed", {id: 1, username: "username", email: "", name: "name", password: "password", pictureUrl: null}],
        ["'name' field must be informed", {id: 1, username: "username", email: "email", name: "", password: "password", pictureUrl: null}],
        ["'password' field must be informed", {id: 1, username: "username", email: "email", name: "name", password: "", pictureUrl: null}],
    ];
    test.each(validateNewUserCases)('validateNewUser(): %s', async (errorMessage, user) => 
    {
        const sut = new UserService();

        const result = await sut.validateNewUser(user as IUser);

        expect(result).toHaveProperty('success', false);
        expect(result).toHaveProperty('statusCode', 400);
        expect(result).toHaveProperty('message', errorMessage);
        expect(result.data).toBeUndefined();
    });

    test('validateUpdateRequest() must succeed', async () => 
    {
        const sut = new UserService();
        const testUser = createTestUser();
        const updateRequest = createUpdateRequest();

        const result = await sut.validateUpdateRequest(testUser, updateRequest);

        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('statusCode', 200);
        expect(result).toHaveProperty('message', "Valid request");
        expect(result.data).toBeUndefined();
    });
    
    test('validateUpdateRequest() must fail if email is registered for another user', async () => 
    {
        const sut = new UserService();
        const testUser = createTestUser();
        const anotherTestUser = {...testUser, id: 2, email : 'email_changed'};
        const updateRequest = createUpdateRequest();
        userDAOMock.getByEmail.mockResolvedValue(anotherTestUser)

        const result = await sut.validateUpdateRequest(testUser, updateRequest);

        expect(userDAOMock.getByEmail).toHaveBeenCalled();
        expect(result).toHaveProperty('success', false);
        expect(result).toHaveProperty('statusCode', 400);
        expect(result).toHaveProperty('message', "This email is already being used");
        expect(result.data).toBeUndefined();
    });

    test('validateUpdateRequest() must fail if username is registered for another user', async () => 
    {
        const sut = new UserService();
        const testUser = createTestUser();
        const anotherTestUser = {...testUser, id: 2, username : 'username_changed'};
        const updateRequest = createUpdateRequest();
        userDAOMock.getByUsername.mockResolvedValue(anotherTestUser)

        const result = await sut.validateUpdateRequest(testUser, updateRequest);

        expect(userDAOMock.getByUsername).toHaveBeenCalled();
        expect(result).toHaveProperty('success', false);
        expect(result).toHaveProperty('statusCode', 400);
        expect(result).toHaveProperty('message', "This username is already being used");
        expect(result.data).toBeUndefined();
    });

    const validateUpdateRequestCases : [string, UserUpdateRequest][] = [
        //[error message, IUser]
        ["'username' field must be informed", {username: "", email: "email", name: "name", currentPassword: "password"}],
        ["'email' field must be informed", {username: "username", email: "", name: "name", currentPassword: "password"}],
        ["'name' field must be informed", {username: "username", email: "email", name: "", currentPassword: "password"}],
        ["'Current password' field must be informed", {username: "username", email: "email", name: "name", currentPassword: ""}],
        ["Wrong password", {username: "username", email: "email", name: "name", currentPassword: "wrongPassword"}],
        ["Password must have 4 characters at least", {username: "username", email: "email", name: "name", currentPassword: "password", newPassword: "123"}],
    ];
    test.each(validateUpdateRequestCases)('validateUpdateRequest(): %s', async (errorMessage, updateRequest) => 
    {
        const sut = new UserService();

        const result = await sut.validateUpdateRequest(createTestUser(), updateRequest);

        expect(result).toHaveProperty('success', false);
        expect(result).toHaveProperty('statusCode', 400);
        expect(result).toHaveProperty('message', errorMessage);
        expect(result.data).toBeUndefined();
    });

});