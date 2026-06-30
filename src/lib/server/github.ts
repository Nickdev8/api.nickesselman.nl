export type GithubCommit = {
	sha: string;
	commitUrl: string;
	repoName: string;
	commit: {
		author: { name: string; date: string };
		message: string;
	};
};

type PushEvent = {
	type: string;
	created_at: string;
	repo?: { name?: string };
	actor?: { login?: string };
	payload?: {
		commits?: { sha?: string; message?: string; url?: string }[];
	};
};

type CommitApiItem = {
	sha?: string;
	html_url?: string;
	author?: { login?: string };
	committer?: { date?: string };
	commit?: {
		author?: { name?: string; date?: string };
		committer?: { date?: string };
		message?: string;
	};
};

const GITHUB_OWNER = (process.env.GITHUB_OWNER ?? process.env.VITE_GITHUB_OWNER ?? '').trim();
const GITHUB_TOKEN = (process.env.GITHUB_TOKEN ?? process.env.VITE_GITHUB_TOKEN ?? '').trim();
const GITHUB_FEED_REPOS = (process.env.GITHUB_FEED_REPOS ?? process.env.VITE_GITHUB_FEED_REPOS ?? '')
	.split(',')
	.map((value) => value.trim())
	.filter(Boolean);
const GITHUB_USE_REPO_FEED = ['1', 'true', 'yes', 'on'].includes(
	(process.env.GITHUB_USE_REPO_FEED ?? process.env.VITE_GITHUB_USE_REPO_FEED ?? '').toLowerCase()
);

const API_BASE = 'https://api.github.com';
const RECENT_CACHE_DURATION = 1000 * 60 * 5;
const TRACKED_REPO_CACHE_DURATION = 1000 * 60 * 10;
const REPO_FETCH_CONCURRENCY = 4;
const ownerLower = GITHUB_OWNER.toLowerCase();

const recentCache: { timestamp: number; data: GithubCommit[] } = { timestamp: 0, data: [] };
const repoCache = new Map<string, { timestamp: number; data: GithubCommit[] }>();
const trackedRepoCache: { timestamp: number; repos: string[] } = { timestamp: 0, repos: [] };

const buildHeaders = (): Record<string, string> => {
	const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
	if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
	return headers;
};

const apiCommitToHtml = (url: string | undefined): string =>
	url?.replace('api.github.com/repos', 'github.com').replace('/commits/', '/commit/') || '#';

const useRepoFeed = (): boolean => GITHUB_FEED_REPOS.length > 0 || GITHUB_USE_REPO_FEED;

const fetchPushEventCommits = async (limit: number, maxPages = 4): Promise<GithubCommit[]> => {
	if (!GITHUB_OWNER) return [];

	const commits: GithubCommit[] = [];
	for (let page = 1; page <= maxPages && commits.length < limit; page += 1) {
		const response = await fetch(`${API_BASE}/users/${GITHUB_OWNER}/events/public?per_page=100&page=${page}`, {
			headers: buildHeaders()
		});

		if (!response.ok) {
			console.error('Failed to fetch GitHub events', response.status, await response.text());
			break;
		}

		const events: PushEvent[] = await response.json();
		if (!events.length) break;

		for (const event of events) {
			if (event.type !== 'PushEvent') continue;

			const repoName = event.repo?.name || 'unknown-repo';
			const authorName = event.actor?.login || GITHUB_OWNER || 'unknown';
			for (const commit of event.payload?.commits ?? []) {
				commits.push({
					sha: commit.sha ?? '',
					repoName,
					commitUrl: apiCommitToHtml(commit.url),
					commit: {
						author: { name: authorName, date: event.created_at },
						message: commit.message || 'Commit'
					}
				});
				if (commits.length >= limit) break;
			}
			if (commits.length >= limit) break;
		}
	}

	return commits;
};

const fetchRepoCommits = async (repo: string, limit: number): Promise<GithubCommit[]> => {
	const cached = repoCache.get(repo);
	if (cached && Date.now() - cached.timestamp < RECENT_CACHE_DURATION) {
		return cached.data.slice(0, limit);
	}

	const url = new URL(`${API_BASE}/repos/${repo}/commits`);
	url.searchParams.set('per_page', String(Math.min(Math.max(limit * 2, 20), 100)));

	const response = await fetch(url, { headers: buildHeaders() });
	if (!response.ok) {
		console.error('Failed to fetch GitHub repo commits', repo, response.status, await response.text());
		return [];
	}

	const json: unknown = await response.json();
	const commits: GithubCommit[] = [];
	for (const item of Array.isArray(json) ? (json as CommitApiItem[]) : []) {
		const authorLogin = item.author?.login?.toLowerCase();
		if (ownerLower && authorLogin && authorLogin !== ownerLower) continue;

		const commitData = item.commit ?? {};
		commits.push({
			sha: item.sha ?? '',
			commitUrl: item.html_url ?? '#',
			repoName: repo,
			commit: {
				author: {
					name: commitData.author?.name || item.author?.login || GITHUB_OWNER || 'unknown',
					date: commitData.author?.date || commitData.committer?.date || item.committer?.date || new Date().toISOString()
				},
				message: commitData.message || 'Commit'
			}
		});

		if (commits.length >= limit) break;
	}

	repoCache.set(repo, { timestamp: Date.now(), data: commits });
	return commits;
};

const getTrackedRepos = async (max = 10): Promise<string[]> => {
	if (GITHUB_FEED_REPOS.length > 0) return GITHUB_FEED_REPOS.slice(0, max);
	if (!GITHUB_TOKEN) return [];

	const now = Date.now();
	if (trackedRepoCache.repos.length && now - trackedRepoCache.timestamp < TRACKED_REPO_CACHE_DURATION) {
		return trackedRepoCache.repos.slice(0, max);
	}

	const repos: string[] = [];
	const response = await fetch(
		`${API_BASE}/user/repos?per_page=100&page=1&sort=pushed&direction=desc&visibility=all&affiliation=owner,collaborator,organization_member`,
		{ headers: buildHeaders() }
	);

	if (!response.ok) {
		console.error('Failed to fetch GitHub repo list', response.status, await response.text());
		return [];
	}

	const json: unknown = await response.json();
	for (const repo of Array.isArray(json) ? json : []) {
		const fullName = typeof repo?.full_name === 'string' ? repo.full_name : null;
		if (fullName) repos.push(fullName);
		if (repos.length >= max) break;
	}

	trackedRepoCache.timestamp = now;
	trackedRepoCache.repos = repos;
	return repos.slice(0, max);
};

const fetchRepoFeedCommits = async (limit: number): Promise<GithubCommit[]> => {
	const repos = await getTrackedRepos(Math.max(limit, 5));
	const collected: GithubCommit[] = [];

	for (let i = 0; i < repos.length && collected.length < limit * 2; i += REPO_FETCH_CONCURRENCY) {
		const batch = repos.slice(i, i + REPO_FETCH_CONCURRENCY);
		const results = await Promise.all(
			batch.map(async (repo) => {
				try {
					return await fetchRepoCommits(repo, Math.max(3, Math.ceil(limit / 2)));
				} catch (error) {
					console.error('Failed to fetch GitHub commits for repo', repo, error);
					return [];
				}
			})
		);
		for (const repoCommits of results) collected.push(...repoCommits);
	}

	return collected
		.sort((a, b) => new Date(b.commit.author.date).getTime() - new Date(a.commit.author.date).getTime())
		.slice(0, limit);
};

export const fetchRecentGithubCommits = async (limit = 5): Promise<GithubCommit[]> => {
	const normalizedLimit = Math.min(Math.max(Math.floor(limit), 1), 20);
	const now = Date.now();
	if (recentCache.data.length && now - recentCache.timestamp < RECENT_CACHE_DURATION) {
		return recentCache.data.slice(0, normalizedLimit);
	}

	let commits = useRepoFeed() ? await fetchRepoFeedCommits(normalizedLimit * 2) : [];
	if (!commits.length) commits = await fetchPushEventCommits(normalizedLimit * 2);

	recentCache.timestamp = now;
	recentCache.data = commits;
	return commits.slice(0, normalizedLimit);
};
