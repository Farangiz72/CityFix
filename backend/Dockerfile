# CityFix API — production image
FROM node:20-alpine

WORKDIR /app

# Prisma требует openssl на alpine
RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

COPY docker-entrypoint.sh ./
RUN mkdir -p /app/uploads /app/data

ENV NODE_ENV=production
ENV PORT=4000
ENV UPLOAD_DIR=/app/uploads

EXPOSE 4000

CMD ["sh", "./docker-entrypoint.sh"]
