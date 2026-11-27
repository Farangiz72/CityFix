import type { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { asyncHandler } from '../utils/asyncHandler';
import { currentUser } from '../utils/currentUser';

export const authController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body as Record<string, unknown>);
    res.status(201).json(result);
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body as Record<string, unknown>);
    res.json(result);
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    const user = currentUser(req);
    res.json({ user: await authService.me(user.id) });
  }),
};
