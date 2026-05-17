FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json ./
COPY index.html ./
COPY ai.config.json ./
COPY server ./server
COPY src ./src
COPY scripts ./scripts
COPY vendor ./vendor
COPY docs ./docs

RUN chmod +x /app/vendor/scan/scan_31/scan_linux

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4173

EXPOSE 4173

CMD ["npm", "start"]
