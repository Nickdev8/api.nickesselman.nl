import type { RequestHandler } from './$types';
import { createGithubCommitBadgeResponse } from '$lib/server/badgeResponses';

export const GET: RequestHandler = async () => createGithubCommitBadgeResponse();
