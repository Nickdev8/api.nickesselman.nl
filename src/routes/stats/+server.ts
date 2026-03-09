import { createStatsResponse } from '$lib/server/response';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => createStatsResponse();
