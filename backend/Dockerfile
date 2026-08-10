# 개발 모드
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache ffmpeg
CMD ["sh", "-c", "npm install && npm run dev"]

# 배포 모드 (사용 시 위 개발 모드를 주석처리)
# FROM node:20-alpine
# WORKDIR /app
# RUN apk add --no-cache ffmpeg
# COPY package*.json ./
# RUN npm install --production
# COPY . .
# EXPOSE 3000
# CMD ["npm", "start"]
