FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm install

FROM node:22-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN DATABASE_URL="postgresql://x:x@localhost:5432/x" npm --workspace @game-game/api run prisma:generate
RUN npm --workspace @game-game/api run build

FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/src ./apps/api/src
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/package.json ./package.json

WORKDIR /app/apps/api

EXPOSE 8000

CMD ["node", "dist/main.js"]
