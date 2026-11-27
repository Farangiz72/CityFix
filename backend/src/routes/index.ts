import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { requestController } from '../controllers/request.controller';
import { authenticate } from '../middleware/authenticate';
import { authRouter } from './auth.routes';
import { requestRouter } from './request.routes';
import { userRouter } from './user.routes';
import { adminRouter } from './admin.routes';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'cityfix-api', uptime: process.uptime() });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/requests', requestRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/admin', adminRouter);

/** BL-T4 / FR-26: счётчики главной страницы — открыты всем, только агрегаты (NFR-3). */
apiRouter.get('/public/stats', requestController.publicStats);

/** BL-T1 / TC-26: активные категории для формы жителя (отключённые не предлагаются). */
apiRouter.get('/categories', authenticate, adminController.activeCategories);
