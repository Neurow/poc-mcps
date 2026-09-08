FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
COPY entrypoint.sh ./

RUN npx prisma generate
RUN npm run build
RUN chmod +x entrypoint.sh

EXPOSE 4001
CMD ["./entrypoint.sh"]
