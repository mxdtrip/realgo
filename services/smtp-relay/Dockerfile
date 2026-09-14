FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.mjs healthcheck.mjs ./
USER node
EXPOSE 2526
CMD ["node", "server.mjs"]
