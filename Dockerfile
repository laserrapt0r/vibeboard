# vibeboard – kollaboratives Whiteboard

# Abhängigkeiten in einer eigenen Stufe bauen: Die Kerberos-Anbindung wird für Alpine kompiliert,
# die Werkzeuge dafür landen nicht im fertigen Image
FROM node:22-alpine AS deps
RUN apk add --no-cache python3 make g++ krb5-dev
WORKDIR /app
COPY package.json package-lock.json ./
# Die Canvas-Anbindung von pdf.js für Node wird im Server nicht gebraucht
RUN npm ci --omit=dev --build-from-source=kerberos && rm -rf node_modules/@napi-rs

FROM node:22-alpine

# pg_dump für die automatische Sicherung vor Datenbank-Upgrades
# (Version 17 kann auch ältere PostgreSQL-Server sichern)
RUN apk add --no-cache postgresql17-client krb5-libs

WORKDIR /app
COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules

COPY server.js ./
COPY lib ./lib
COPY public ./public
COPY LICENSE THIRD_PARTY_NOTICES.md ./

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATA_DIR=/import \
    BACKUP_DIR=/backups \
    KRB5RCACHEDIR=/tmp

RUN mkdir -p /backups && chown node:node /backups
USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s CMD wget -qO- http://127.0.0.1:3000/healthz > /dev/null || exit 1

CMD ["node", "server.js"]
