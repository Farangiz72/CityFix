import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { requestController } from '../controllers/request.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/requireRole';

/**
 * Маршруты администратора (BL-T1).
 * Сводка доступна и оператору (FR-3), всё остальное закрыто `requireRole('ADMIN')` — серверно,
 * а не только в интерфейсе (NFR-2, TC-27).
 */
export const adminRouter = Router();

adminRouter.use(authenticate);

adminRouter.get('/stats', requireRole('OPERATOR', 'ADMIN'), requestController.stats);

adminRouter.use(requireRole('ADMIN'));

adminRouter.get('/users', adminController.users);
adminRouter.post('/users', adminController.createUser);
adminRouter.patch('/users/:id', adminController.updateUser);
adminRouter.post('/users/:id/reset-password', adminController.resetPassword);

adminRouter.get('/services', adminController.services);
adminRouter.post('/services', adminController.createService);
adminRouter.patch('/services/:id', adminController.updateService);

adminRouter.get('/categories', adminController.categories);
adminRouter.post('/categories', adminController.createCategory);
adminRouter.patch('/categories/:id', adminController.updateCategory);

/** BL-T1 п.3: администратор исправляет категорию (а значит и службу) заявки. */
adminRouter.patch('/requests/:id/category', adminController.changeRequestCategory);

adminRouter.get('/audit', adminController.audit);

/** BL-T1 п.6: CSV по текущему фильтру списка заявок. */
adminRouter.get('/export/requests.csv', adminController.exportCsv);
