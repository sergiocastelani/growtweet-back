import express from 'express';
import cors from 'cors';
import user_controller from './controllers/user_controller';
import tweet_controller from './controllers/tweet_controller';
import like_controller from './controllers/like_controller';
import auth_controller from './controllers/auth_contoller';
import visit_controller from './controllers/visit_controller';

export function createApp()
{
    const app = express();
    app.use(express.json());
    app.use(cors());

    app.use(user_controller);
    app.use(tweet_controller);
    app.use(like_controller);
    app.use(auth_controller);
    app.use(visit_controller);

    return app;
}