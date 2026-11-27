import { Router } from 'express';
import { requestController } from '../controllers/request.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/requireRole';

/** Справочник исполнителей нужен оператору при передаче заявки в службу (FR-3). */
export const userRouter = Router();

userRouter.use(authenticate, requireRole('OPERATOR', 'ADMIN'));
userRouter.get('/executors', requestController.executors);
