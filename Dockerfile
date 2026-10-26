# vibeboard – kollaboratives Whiteboard
FROM node:22-alpine

# pg_dump für die automatische Sicherung vor Datenbank-Upgrades
# (Version 17 kann auch ältere PostgreSQL-Server sichern)
RUN apk add --no-cache postgresql17-client

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server.js ./
COPY lib ./lib
COPY public ./public

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATA_DIR=/import \
    BACKUP_DIR=/backups

RUN mkdir -p /backups && chown node:node /backups
USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s CMD wget -qO- http://127.0.0.1:3000/healthz > /dev/null || exit 1

CMD ["node", "server.js"]
