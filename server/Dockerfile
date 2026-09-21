FROM node:20-alpine
WORKDIR /app
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server/ ./
EXPOSE 4000
CMD ["node", "src/index.js"]
