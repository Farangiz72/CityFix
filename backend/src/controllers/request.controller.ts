import type { Request, Response } from 'express';
import { requestService } from '../services/request.service';
import { asyncHandler } from '../utils/asyncHandler';
import { currentUser, paramId } from '../utils/currentUser';

export const requestController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const user = currentUser(req);
    const result = await requestService.list(user, req.query as Record<string, unknown>);
    res.json(result);
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const user = currentUser(req);
    res.json(await requestService.get(user, paramId(req)));
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const user = currentUser(req);
    const created = await requestService.create(user, req.body as Record<string, unknown>, req.file);
    res.status(201).json(created);
  }),

  changeStatus: asyncHandler(async (req: Request, res: Response) => {
    const user = currentUser(req);
    const updated = await requestService.changeStatus(user, paramId(req), req.body as Record<string, unknown>);
    res.json(updated);
  }),

  /** BL-R1: подтверждение результата жителем (флаг `confirmedAt`). */
  confirm: asyncHandler(async (req: Request, res: Response) => {
    const user = currentUser(req);
    res.json(await requestService.confirm(user, paramId(req)));
  }),

  /** BL-R1: «Проблема осталась» — возврат заявки в работу. */
  reopen: asyncHandler(async (req: Request, res: Response) => {
    const user = currentUser(req);
    res.json(await requestService.reopen(user, paramId(req), req.body as Record<string, unknown>));
  }),

  stats: asyncHandler(async (_req: Request, res: Response) => {
    res.json(await requestService.stats());
  }),

  /** BL-T4: счётчики главной страницы — без токена и без персональных данных. */
  publicStats: asyncHandler(async (_req: Request, res: Response) => {
    res.json(await requestService.publicStats());
  }),

  executors: asyncHandler(async (_req: Request, res: Response) => {
    res.json({ items: await requestService.executors() });
  }),
};
