import { Router } from 'express';
import { requestController } from '../controllers/request.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/requireRole';
import { uploadPhoto } from '../middleware/upload';

export const requestRouter = Router();

requestRouter.use(authenticate);

requestRouter.get('/', requestController.list);
requestRouter.get('/:id', requestController.get);

// FR-2: создавать заявки может только житель; фото — необязательное поле multipart
requestRouter.post('/', requireRole('RESIDENT'), uploadPhoto, requestController.create);

// FR-3, FR-4: оператор ведёт заявку до «Проверена»/«Отклонена», исполнитель — до «Выполнена» (матрица v2)
requestRouter.patch('/:id/status', requireRole('OPERATOR', 'EXECUTOR'), requestController.changeStatus);

// BL-R1: подтверждение результата и возврат в работу — только автор-житель
requestRouter.post('/:id/confirm', requireRole('RESIDENT'), requestController.confirm);
requestRouter.post('/:id/reopen', requireRole('RESIDENT'), requestController.reopen);
