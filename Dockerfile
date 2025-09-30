# syntax=docker/dockerfile:1

##########  deps  ##########
FROM node:20-alpine AS deps
WORKDIR /app

# For Prisma binary on Alpine (musl)
RUN apk add --no-cache openssl libc6-compat

# Install deps first for better caching
COPY package*.json ./
RUN npm ci

##########  build  ##########
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client and compile TS -> JS
RUN npx prisma generate
RUN npm run build

##########  runtime  ##########
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Needed by Prisma query engine on Alpine
RUN apk add --no-cache openssl libc6-compat

# Copy only what's needed to run
COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/dist         ./dist
COPY --from=build /app/prisma       ./prisma

# Entrypoint will run migrations and launch the app
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80
CMD ["/entrypoint.sh"]
