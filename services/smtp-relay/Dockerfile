FROM node:24-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.mjs healthcheck.mjs ./

USER node
EXPOSE 2526

CMD ["node", "server.mjs"]
