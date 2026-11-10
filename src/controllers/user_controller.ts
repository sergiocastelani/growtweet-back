import express from 'express'
import { processAndRespond } from './controller_utils';
import { IUser } from '../models/user';
import { UserSecureInfo } from '../models/user_secure_info';
import { UserUpdateRequest } from '../models/requests/user_update_request';
import { authMiddleware } from './middlewares/auth_middleware';
import { AuthService } from '../services/auth_service';
import { ApiError, SuccessResult } from '../services/services_types';
import { UserService } from '../services/user_service';

const user_controller = express.Router()
export default user_controller;

user_controller.get('/user/:id', async (req, res) => 
{
    processAndRespond(res, async () => 
    {
        const userResult = await (new UserService()).getById(parseInt(req.params.id));
        if (!userResult.success)
            return userResult;

        return SuccessResult(userResult.message, UserSecureInfo.FromUser(userResult.data!));
    });
})

user_controller.post('/user', (req, res) => {
    processAndRespond(res, async () => 
    {
        const user : IUser = req.body;

        const userResult = await (new UserService()).create(user);
        if (!userResult.success)
            return userResult;

        const userSecureInfo = new UserSecureInfo(
            userResult.data!.id,
            userResult.data!.username,
            userResult.data!.email,
            userResult.data!.name,
            userResult.data!.pictureUrl
        );

        return SuccessResult(userResult.message, userSecureInfo, 201);
    });
})

user_controller.put('/user', authMiddleware, (req, res) => 
{
    processAndRespond(res, async () => 
    {
        const newUserData : UserUpdateRequest = req.body;
        const user : UserSecureInfo = res.locals.user;
 
        const updateResult = await new UserService().update(user.id, newUserData);

        if (!updateResult.success)
            throw new ApiError(updateResult.statusCode, updateResult.message);
 
        const token = new AuthService().createToken(updateResult.data!);

        return { 
            statusCode: 200,
            success: true,
            message: "User updated",
            data: token
        }
    });
})


