import type { RequestHandler } from './$types';
import { createGithubContributionsBadgeResponse } from '$lib/server/badgeResponses';

export const GET: RequestHandler = async () => createGithubContributionsBadgeResponse(1);
