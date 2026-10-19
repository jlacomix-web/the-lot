# Build context is the project root (see docker-compose.yml).
FROM node:20-alpine
WORKDIR /app
COPY server/package.json ./
RUN npm install --omit=dev
COPY server/src ./src
COPY server/db ./db
COPY server/scripts ./scripts
COPY client/assets/avatar-options.json ./shared/avatar-options.json
COPY client/assets/world.json ./shared/world.json
USER node
EXPOSE 3000
CMD ["node", "src/index.js"]
