// 카테고리 ID 상수
export const CATEGORY_IDS = {
  ETC: 1,
  YOUTUBE: 2,
  X: 3,
  COMEBACK: 4,
  FANSIGN: 5,
  CONCERT: 6,
  TICKETING: 7,
  VARIETY: 10,
  BIRTHDAY: 8,
  DEBUT: 9,
  EVENT: 11,
  ALBUM: 17,
};

// 데뷔일 (fromis_9: 2018년 1월 24일)
export const DEBUT_DATE = {
  year: 2018,
  month: 1,
  day: 24,
};

// 필수 환경변수 검증
const requiredEnvVars = ['JWT_SECRET'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`필수 환경변수 ${envVar}가 설정되지 않았습니다.`);
  }
}

export default {
  server: {
    port: parseInt(process.env.PORT) || 80,
    host: '0.0.0.0',
  },
  image: {
    medium: { width: 800, quality: 85 },
    thumb: { width: 400, quality: 80 },
  },
  x: {
    defaultUsername: 'realfromis_9',
  },
  db: {
    host: process.env.DB_HOST || 'mariadb',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'fromis9',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'fromis9',
    connectionLimit: 10,
    waitForConnections: true,
  },
  redis: {
    host: process.env.REDIS_HOST || 'fromlog-redis',
    port: parseInt(process.env.REDIS_PORT) || 6379,
  },
  google: {
    apiKey: process.env.GOOGLE_API_KEY,
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '30d',
  },
  s3: {
    endpoint: process.env.RUSTFS_ENDPOINT,
    accessKey: process.env.RUSTFS_ACCESS_KEY,
    secretKey: process.env.RUSTFS_SECRET_KEY,
    bucket: process.env.RUSTFS_BUCKET || 'fromis-9',
    publicUrl: process.env.RUSTFS_PUBLIC_URL,
  },
  meilisearch: {
    host: process.env.MEILI_HOST || 'http://fromlog-meilisearch:7700',
    apiKey: process.env.MEILI_MASTER_KEY,
    minScore: 0.5,
  },
};
