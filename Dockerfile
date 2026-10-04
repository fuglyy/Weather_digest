FROM node:22-alpine AS migration
WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY . .

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY reports ./reports
RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 3000
CMD ["node", "src/server.js"]
