import { Router } from 'express';
import { authenticateUser } from '../../middleware/auth.js';
import { submitVerifiedReview, listUserReviews } from './reviews.controller.js';

export const reviewsRouter = Router();

reviewsRouter.post('/', authenticateUser(), submitVerifiedReview);
reviewsRouter.get('/user/:userId', authenticateUser(), listUserReviews);
