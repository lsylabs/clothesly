import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { config } from './config.js';
import healthRouter from './routes/health.js';
import internalRouter from './routes/internal.js';
import uploadsRouter from './routes/uploads.js';

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin: config.allowedOrigins === '*' ? true : config.allowedOrigins.split(',').map((origin) => origin.trim())
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

app.use(healthRouter);
app.use(uploadsRouter);
app.use(internalRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

app.use((error, _req, res, _next) => {
  const message = error instanceof Error ? error.message : 'Unexpected server error';
  res.status(500).json({ error: 'Internal server error', message });
});

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Clothesly BFF listening on http://localhost:${config.port}`);
});

