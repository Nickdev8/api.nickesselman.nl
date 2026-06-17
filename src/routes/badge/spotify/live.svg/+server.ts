import type { RequestHandler } from './$types';
import { createSpotifyBadgeResponse } from '$lib/server/badgeResponses';

export const GET: RequestHandler = async () => createSpotifyBadgeResponse();
