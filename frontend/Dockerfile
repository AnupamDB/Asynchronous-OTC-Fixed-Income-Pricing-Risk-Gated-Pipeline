FROM node:22-alpine AS build
WORKDIR /workspace/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /workspace/frontend
COPY frontend/server.cjs ./server.cjs
COPY --from=build /workspace/frontend/dist ./dist
EXPOSE 3000
CMD ["node", "server.cjs"]
