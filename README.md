# MSN Video Downloader

An authorized-use MSN video downloader with a static frontend and a Node/yt-dlp API.

## EdgeOne deployment

Connect this GitHub repository to EdgeOne Pages. Use the `Other` framework preset, leave the build command empty, and set the output directory to `public`.

The EdgeOne Pages deployment hosts only the frontend. The downloader requires the yt-dlp executable and must run as a Node service in a container host; EdgeOne Pages static hosting cannot run that process.

1. Deploy this repository's `Dockerfile` to a host that supports Docker and outbound HTTPS requests.
2. Set `ALLOWED_ORIGINS` on the backend to the exact EdgeOne site origin, such as `https://your-project.edgeone.app`.
3. Set `MSN_API_BASE` in `public/config.js` to the backend's HTTPS origin, with no trailing slash, then push the change so EdgeOne rebuilds the site.

For local use, leave `MSN_API_BASE` empty, run `npm ci` and `npm start`, then open `http://localhost:3000`.

## Backend configuration

- `PORT`: listening port; defaults to `3000`.
- `HOST`: listening address; defaults to `127.0.0.1`. The Docker image sets this to `0.0.0.0`.
- `ALLOWED_ORIGINS`: comma-separated allowed browser origins. The local defaults are `http://localhost:3000` and `http://127.0.0.1:3000`.

Do not set `ALLOWED_ORIGINS=*` for a public deployment. CORS is not authentication; protect the backend with your hosting provider's access controls if it should be private. Anyone permitted to call a public backend can consume its bandwidth.

Only download videos you own or have permission to save. Respect the creator's rights and MSN's terms.