import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import config from '../config/index.js';
import { createLogger } from '../utils/logger.js';
import { extractThemeColor } from './theme.js';

const logger = createLogger('S3');

// S3 클라이언트 생성
const s3Client = new S3Client({
  endpoint: config.s3.endpoint,
  region: 'us-east-1',
  credentials: {
    accessKeyId: config.s3.accessKey,
    secretAccessKey: config.s3.secretKey,
  },
  forcePathStyle: true,
});

const BUCKET = config.s3.bucket;
const PUBLIC_URL = config.s3.publicUrl;

// 이미지 처리 설정
const { medium, thumb } = config.image;

/**
 * 이미지를 3가지 해상도로 변환
 * @param {Buffer} buffer - 원본 이미지 버퍼
 * @param {boolean} includeMetadata - 메타데이터 포함 여부
 * @returns {Promise<{originalBuffer, mediumBuffer, thumbBuffer, metadata?}>}
 */
async function processImage(buffer, includeMetadata = false) {
  const image = sharp(buffer);

  // 메타데이터가 필요한 경우 먼저 조회 (중복 sharp 인스턴스 생성 방지)
  const metadata = includeMetadata ? await image.metadata() : null;

  const [originalBuffer, mediumBuffer, thumbBuffer] = await Promise.all([
    image.clone().webp({ lossless: true }).toBuffer(),
    image.clone()
      .resize(medium.width, null, { withoutEnlargement: true })
      .webp({ quality: medium.quality })
      .toBuffer(),
    image.clone()
      .resize(thumb.width, null, { withoutEnlargement: true })
      .webp({ quality: thumb.quality })
      .toBuffer(),
  ]);

  const result = { originalBuffer, mediumBuffer, thumbBuffer };
  if (metadata) {
    result.metadata = metadata;
  }
  return result;
}

/**
 * S3에 이미지 업로드
 */
async function uploadToS3(key, buffer, contentType = 'image/webp') {
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  return `${PUBLIC_URL}/${BUCKET}/${key}`;
}

/**
 * S3에서 이미지 삭제
 */
async function deleteFromS3(key) {
  try {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }));
  } catch (err) {
    logger.error(`삭제 오류 (${key}): ${err.message}`);
  }
}

/**
 * 멤버 프로필 이미지 업로드
 * @param {string} name - 멤버 이름
 * @param {Buffer} buffer - 이미지 버퍼
 * @returns {Promise<{originalUrl: string, mediumUrl: string, thumbUrl: string}>}
 */
export async function uploadMemberImage(name, buffer) {
  const { originalBuffer, mediumBuffer, thumbBuffer } = await processImage(buffer);

  const basePath = `member/${name}`;
  const filename = `${name}.webp`;

  // 병렬 업로드
  const [originalUrl, mediumUrl, thumbUrl] = await Promise.all([
    uploadToS3(`${basePath}/original/${filename}`, originalBuffer),
    uploadToS3(`${basePath}/medium_800/${filename}`, mediumBuffer),
    uploadToS3(`${basePath}/thumb_400/${filename}`, thumbBuffer),
  ]);

  return { originalUrl, mediumUrl, thumbUrl };
}

/**
 * 멤버 프로필 이미지 삭제
 * @param {string} name - 멤버 이름
 */
export async function deleteMemberImage(name) {
  const basePath = `member/${name}`;
  const filename = `${name}.webp`;
  const sizes = ['original', 'medium_800', 'thumb_400'];

  await Promise.all(
    sizes.map(size => deleteFromS3(`${basePath}/${size}/${filename}`))
  );
}

/**
 * 앨범 커버 이미지 업로드
 * @param {string} folderName - 앨범 폴더명
 * @param {Buffer} buffer - 이미지 버퍼
 * @returns {Promise<{originalUrl: string, mediumUrl: string, thumbUrl: string}>}
 */
export async function uploadAlbumCover(folderName, buffer) {
  const { originalBuffer, mediumBuffer, thumbBuffer } = await processImage(buffer);

  const basePath = `album/${folderName}/cover`;

  const [uploaded, themeColor] = await Promise.all([
    Promise.all([
      uploadToS3(`${basePath}/original/cover.webp`, originalBuffer),
      uploadToS3(`${basePath}/medium_800/cover.webp`, mediumBuffer),
      uploadToS3(`${basePath}/thumb_400/cover.webp`, thumbBuffer),
    ]),
    extractThemeColor(buffer),
  ]);

  const [originalUrl, mediumUrl, thumbUrl] = uploaded;
  return { originalUrl, mediumUrl, thumbUrl, themeColor };
}

/**
 * 앨범 커버 이미지 삭제
 * @param {string} folderName - 앨범 폴더명
 */
export async function deleteAlbumCover(folderName) {
  const basePath = `album/${folderName}/cover`;
  const sizes = ['original', 'medium_800', 'thumb_400'];

  await Promise.all(
    sizes.map(size => deleteFromS3(`${basePath}/${size}/cover.webp`))
  );
}

/**
 * 앨범 사진 업로드 (컨셉포토 또는 티저)
 * @param {string} folderName - 앨범 폴더명
 * @param {string} subFolder - 'photo' 또는 'teaser'
 * @param {string} filename - 파일명 (예: '01.webp')
 * @param {Buffer} buffer - 이미지 버퍼
 * @returns {Promise<{originalUrl: string, mediumUrl: string, thumbUrl: string, metadata: object}>}
 */
export async function uploadAlbumPhoto(folderName, subFolder, filename, buffer) {
  const { originalBuffer, mediumBuffer, thumbBuffer, metadata } = await processImage(buffer, true);

  const basePath = `album/${folderName}/${subFolder}`;

  const [originalUrl, mediumUrl, thumbUrl] = await Promise.all([
    uploadToS3(`${basePath}/original/${filename}`, originalBuffer),
    uploadToS3(`${basePath}/medium_800/${filename}`, mediumBuffer),
    uploadToS3(`${basePath}/thumb_400/${filename}`, thumbBuffer),
  ]);

  return {
    originalUrl,
    mediumUrl,
    thumbUrl,
    metadata: {
      width: metadata.width,
      height: metadata.height,
      size: originalBuffer.length,
    },
  };
}

/**
 * 앨범 사진 삭제
 * @param {string} folderName - 앨범 폴더명
 * @param {string} subFolder - 'photo' 또는 'teaser'
 * @param {string} filename - 파일명
 */
export async function deleteAlbumPhoto(folderName, subFolder, filename) {
  const basePath = `album/${folderName}/${subFolder}`;
  const sizes = ['original', 'medium_800', 'thumb_400'];

  await Promise.all(
    sizes.map(size => deleteFromS3(`${basePath}/${size}/${filename}`))
  );
}

/**
 * 앨범 비디오 업로드 (티저 전용)
 * @param {string} folderName - 앨범 폴더명
 * @param {string} filename - 파일명 (예: '01.mp4')
 * @param {Buffer} buffer - 비디오 버퍼
 * @returns {Promise<string>} - 비디오 URL
 */
export async function uploadAlbumVideo(folderName, filename, buffer) {
  const key = `album/${folderName}/teaser/video/${filename}`;
  return await uploadToS3(key, buffer, 'video/mp4');
}

/**
 * 앨범 비디오 삭제
 * @param {string} folderName - 앨범 폴더명
 * @param {string} filename - 파일명
 */
export async function deleteAlbumVideo(folderName, filename) {
  await deleteFromS3(`album/${folderName}/teaser/video/${filename}`);
}

/**
 * 콘서트 포스터 업로드
 * @param {number} seriesId - 콘서트 시리즈 ID
 * @param {Buffer} buffer - 이미지 버퍼
 * @returns {Promise<{originalUrl: string, mediumUrl: string, thumbUrl: string}>}
 */
export async function uploadConcertPoster(seriesId, buffer) {
  const { originalBuffer, mediumBuffer, thumbBuffer } = await processImage(buffer);

  const basePath = `concert/${seriesId}/poster`;

  const [originalUrl, mediumUrl, thumbUrl] = await Promise.all([
    uploadToS3(`${basePath}/original/poster.webp`, originalBuffer),
    uploadToS3(`${basePath}/medium_800/poster.webp`, mediumBuffer),
    uploadToS3(`${basePath}/thumb_400/poster.webp`, thumbBuffer),
  ]);

  return { originalUrl, mediumUrl, thumbUrl };
}

/**
 * 콘서트 MD(굿즈) 이미지 업로드
 * @param {number} seriesId - 콘서트 시리즈 ID
 * @param {string} filename - 파일명 (예: '01.webp')
 * @param {Buffer} buffer - 이미지 버퍼
 * @returns {Promise<{originalUrl: string, mediumUrl: string, thumbUrl: string}>}
 */
export async function uploadConcertMerchandise(seriesId, filename, buffer) {
  const { originalBuffer, mediumBuffer, thumbBuffer } = await processImage(buffer);

  const basePath = `concert/${seriesId}/md`;

  const [originalUrl, mediumUrl, thumbUrl] = await Promise.all([
    uploadToS3(`${basePath}/original/${filename}`, originalBuffer),
    uploadToS3(`${basePath}/medium_800/${filename}`, mediumBuffer),
    uploadToS3(`${basePath}/thumb_400/${filename}`, thumbBuffer),
  ]);

  return { originalUrl, mediumUrl, thumbUrl };
}

/**
 * 행사 포스터 업로드
 * @param {number} scheduleId - 일정 ID
 * @param {string} filename - 파일명 (예: '01.webp')
 * @param {Buffer} buffer - 이미지 버퍼
 * @returns {Promise<{originalUrl: string, mediumUrl: string, thumbUrl: string}>}
 */
export async function uploadEventPoster(scheduleId, filename, buffer) {
  const { originalBuffer, mediumBuffer, thumbBuffer } = await processImage(buffer);

  const basePath = `event/${scheduleId}/poster`;

  const [originalUrl, mediumUrl, thumbUrl] = await Promise.all([
    uploadToS3(`${basePath}/original/${filename}`, originalBuffer),
    uploadToS3(`${basePath}/medium_800/${filename}`, mediumBuffer),
    uploadToS3(`${basePath}/thumb_400/${filename}`, thumbBuffer),
  ]);

  return { originalUrl, mediumUrl, thumbUrl };
}

/**
 * 기타(공용) 일정 포스터 업로드
 * @param {number} scheduleId - 일정 ID
 * @param {string} filename - 파일명
 * @param {Buffer} buffer - 이미지 버퍼
 * @returns {Promise<{originalUrl: string, mediumUrl: string, thumbUrl: string}>}
 */
export async function uploadEtcPoster(scheduleId, filename, buffer) {
  const { originalBuffer, mediumBuffer, thumbBuffer } = await processImage(buffer);

  const basePath = `etc/${scheduleId}/poster`;

  const [originalUrl, mediumUrl, thumbUrl] = await Promise.all([
    uploadToS3(`${basePath}/original/${filename}`, originalBuffer),
    uploadToS3(`${basePath}/medium_800/${filename}`, mediumBuffer),
    uploadToS3(`${basePath}/thumb_400/${filename}`, thumbBuffer),
  ]);

  return { originalUrl, mediumUrl, thumbUrl };
}

/**
 * 예능 일정 썸네일 업로드
 * @param {number} scheduleId - 일정 ID
 * @param {Buffer} buffer - 이미지 버퍼
 * @returns {Promise<{originalUrl: string, mediumUrl: string, thumbUrl: string}>}
 */
export async function uploadVarietyThumbnail(scheduleId, buffer) {
  const { originalBuffer, mediumBuffer, thumbBuffer } = await processImage(buffer);

  const basePath = `schedule/${scheduleId}/thumbnail`;

  const [originalUrl, mediumUrl, thumbUrl] = await Promise.all([
    uploadToS3(`${basePath}/original/thumbnail.webp`, originalBuffer),
    uploadToS3(`${basePath}/medium_800/thumbnail.webp`, mediumBuffer),
    uploadToS3(`${basePath}/thumb_400/thumbnail.webp`, thumbBuffer),
  ]);

  return { originalUrl, mediumUrl, thumbUrl };
}
