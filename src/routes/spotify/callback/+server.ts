import type { RequestHandler } from './$types';
import { completeSpotifyAuthorization } from '$lib/server/spotify';

const htmlPage = (title: string, body: string) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 2rem; }
    .card { max-width: 46rem; padding: 1rem 1.25rem; border: 1px solid #d0d7de; border-radius: 10px; }
    code { background: #f6f8fa; padding: 0.15rem 0.35rem; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${body}</p>
  </div>
</body>
</html>`;

export const GET: RequestHandler = async ({ url }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const error = url.searchParams.get('error');

	const result = await completeSpotifyAuthorization(code, state, error);
	if (!result.ok) {
		return new Response(htmlPage('Spotify Connect Failed', result.message), {
			status: 400,
			headers: {
				'access-control-allow-origin': '*',
				'cache-control': 'no-store',
				'content-type': 'text/html; charset=utf-8'
			}
		});
	}

	return new Response(
		htmlPage('Spotify Connected', `${result.message} You can now call <code>/spotify/currently-playing</code>.`),
		{
			status: 200,
			headers: {
				'access-control-allow-origin': '*',
				'cache-control': 'no-store',
				'content-type': 'text/html; charset=utf-8'
			}
		}
	);
};
