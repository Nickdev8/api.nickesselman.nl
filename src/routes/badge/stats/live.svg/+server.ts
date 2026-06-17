import type { RequestHandler } from './$types';
import { createStatsBadgeResponse } from '$lib/server/badgeResponses';

export const GET: RequestHandler = async () => createStatsBadgeResponse();
