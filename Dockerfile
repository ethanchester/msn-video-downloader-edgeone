FROM node:24-bookworm-slim

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js ./
COPY public ./public

EXPOSE 3000
CMD ["npm", "start"]