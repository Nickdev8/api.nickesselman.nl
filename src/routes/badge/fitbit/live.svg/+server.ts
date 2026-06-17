import type { RequestHandler } from './$types';
import { createFitbitBadgeResponse } from '$lib/server/badgeResponses';

export const GET: RequestHandler = async () => createFitbitBadgeResponse();
