const express = require('express');
const ytdlp = require('youtube-dl-exec');
const path = require('path');

const app = express();
const port = Number(process.env.PORT) || 3000;
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);

app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin && (allowedOrigins.has(origin) || allowedOrigins.has('*'))) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins.has('*') ? '*' : origin);
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.sendStatus(204);
  }
  next();
});
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/healthz', (req, res) => res.json({ ok: true }));

function parseAuthorizedVideoUrl(value, authorized) {
  if (authorized !== true) {
    const error = new Error('Confirm that you own or have permission to download this video.');
    error.appStatus = 403;
    throw error;
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    const error = new Error('Enter a valid MSN video page URL.');
    error.appStatus = 400;
    throw error;
  }

  if (url.protocol !== 'https:' || (url.hostname !== 'msn.com' && !url.hostname.endsWith('.msn.com'))) {
    const error = new Error('Enter a valid HTTPS video page URL from msn.com.');
    error.appStatus = 400;
    throw error;
  }

  return url.toString();
}

function sendError(res, error) {
  if (res.headersSent) {
    res.destroy(error);
    return;
  }

  res.removeHeader('Content-Disposition');
  res.removeHeader('Content-Length');
  const details = String(error.stderr || error.message || 'Unable to process this MSN video.')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(-800);
  res.status(error.appStatus || 502).json({ error: details });
}

async function getVideoInfo(videoUrl) {
  return ytdlp(videoUrl, {
    dumpSingleJson: true,
    noWarnings: true,
    noPlaylist: true,
    skipDownload: true
  });
}

function getMp4Formats(info) {
  return (info.formats || [])
    .filter((format) => format.ext === 'mp4' && format.vcodec !== 'none' && format.acodec !== 'none')
    .map((format) => ({
      formatId: format.format_id,
      quality: format.format_note || format.resolution || (format.height ? `${format.height}p` : 'MP4'),
      contentLength: format.filesize || format.filesize_approx || null
    }));
}

app.post('/api/info', async (req, res) => {
  try {
    const videoUrl = parseAuthorizedVideoUrl(req.body?.url, req.body?.authorized);
    const info = await getVideoInfo(videoUrl);
    const formats = getMp4Formats(info);

    if (!formats.length) {
      return res.status(422).json({ error: 'This MSN page has no MP4 format with both audio and video.' });
    }

    res.json({
      title: info.title || 'Untitled video',
      author: info.uploader || info.channel || 'MSN video',
      thumbnail: info.thumbnail || info.thumbnails?.at(-1)?.url || null,
      formats
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.get('/api/download', async (req, res) => {
  try {
    const videoUrl = parseAuthorizedVideoUrl(req.query.url, req.query.authorized === 'true');
    const info = await getVideoInfo(videoUrl);
    const format = getMp4Formats(info).find((item) => item.formatId === req.query.format);

    if (!format) {
      return res.status(400).json({ error: 'That MP4 format is not available for this MSN video.' });
    }

    const safeTitle = (info.title || 'msn-video')
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
      .trim()
      .slice(0, 180) || 'msn-video';

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.mp4"`);
    if (format.contentLength) res.setHeader('Content-Length', format.contentLength);

    const download = ytdlp.exec(videoUrl, {
      format: format.formatId,
      output: '-',
      noWarnings: true,
      noProgress: true,
      noPlaylist: true,
      quiet: true
    });
    download.stdout.pipe(res);
    download.catch((error) => sendError(res, error));
  } catch (error) {
    sendError(res, error);
  }
});

app.listen(port, process.env.HOST || '127.0.0.1', () => {
  console.log(`MSN video downloader running at http://localhost:${port}`);
});