import type { RequestHandler } from './$types';
import { createPhoneBadgeResponse } from '$lib/server/badgeResponses';

export const GET: RequestHandler = async () => createPhoneBadgeResponse();
