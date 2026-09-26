# Build stage: needs devDependencies (the Nest CLI) to compile TypeScript.
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Runtime stage: compiled output and production dependencies only, so the
# image carries neither the TypeScript toolchain nor the source tree.
FROM node:22-alpine AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# Railway and Render inject PORT; main.ts falls back to 3000 for local runs.
EXPOSE 3000

CMD ["node", "dist/main"]
