import type { Request, Response } from 'express';
import { adminService } from '../services/admin.service';
import { asyncHandler } from '../utils/asyncHandler';
import { currentUser, paramId } from '../utils/currentUser';

/** Администратор (BL-T1): пользователи, справочники, аудит, сводка и выгрузка. */
export const adminController = {
  users: asyncHandler(async (req: Request, res: Response) => {
    res.json(await adminService.listUsers(req.query as Record<string, unknown>));
  }),

  createUser: asyncHandler(async (req: Request, res: Response) => {
    const user = currentUser(req);
    res.status(201).json(await adminService.createUser(user, req.body as Record<string, unknown>));
  }),

  updateUser: asyncHandler(async (req: Request, res: Response) => {
    const user = currentUser(req);
    res.json(await adminService.updateUser(user, paramId(req), req.body as Record<string, unknown>));
  }),

  /** Новый пароль возвращается один раз и в журнал не попадает. */
  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    const user = currentUser(req);
    res.json(await adminService.resetPassword(user, paramId(req), req.body as Record<string, unknown>));
  }),

  services: asyncHandler(async (_req: Request, res: Response) => {
    res.json(await adminService.listServices());
  }),

  createService: asyncHandler(async (req: Request, res: Response) => {
    const user = currentUser(req);
    res.status(201).json(await adminService.createService(user, req.body as Record<string, unknown>));
  }),

  updateService: asyncHandler(async (req: Request, res: Response) => {
    const user = currentUser(req);
    res.json(await adminService.updateService(user, paramId(req), req.body as Record<string, unknown>));
  }),

  categories: asyncHandler(async (_req: Request, res: Response) => {
    res.json(await adminService.listCategories());
  }),

  /** Активные категории — публичный справочник для формы жителя (TC-26). */
  activeCategories: asyncHandler(async (_req: Request, res: Response) => {
    res.json(await adminService.activeCategories());
  }),

  createCategory: asyncHandler(async (req: Request, res: Response) => {
    const user = currentUser(req);
    res.status(201).json(await adminService.createCategory(user, req.body as Record<string, unknown>));
  }),

  updateCategory: asyncHandler(async (req: Request, res: Response) => {
    const user = currentUser(req);
    res.json(await adminService.updateCategory(user, paramId(req), req.body as Record<string, unknown>));
  }),

  changeRequestCategory: asyncHandler(async (req: Request, res: Response) => {
    const user = currentUser(req);
    res.json(await adminService.changeRequestCategory(user, paramId(req), req.body as Record<string, unknown>));
  }),

  audit: asyncHandler(async (req: Request, res: Response) => {
    res.json(await adminService.listAudit(req.query as Record<string, unknown>));
  }),

  /** CSV отдаётся файлом, поэтому тело ответа не JSON. */
  exportCsv: asyncHandler(async (req: Request, res: Response) => {
    const user = currentUser(req);
    const { csv, count } = await adminService.exportRequestsCsv(user, req.query as Record<string, unknown>);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="cityfix-requests-${stamp}.csv"`);
    res.setHeader('X-Total-Count', String(count));
    res.send(csv);
  }),
};
