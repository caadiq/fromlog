/**
 * FCM 푸시 발송 서비스
 * - 운영 알림(ops): X 세션 만료, 봇 오류 등 관리자 기기 대상
 * - 향후 팬 알림(컴백·일정 등)은 sendToTopic으로 확장
 *
 * 서비스 계정 키는 FIREBASE_SERVICE_ACCOUNT(경로) 또는 기본 경로에서 로드.
 * 키가 없으면 발송을 조용히 건너뛴다(개발 환경에서 크래시 방지).
 */
import { readFileSync, existsSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const KEY_PATH =
  process.env.FIREBASE_SERVICE_ACCOUNT || '/app/firebase-service-account.json';

let messaging = null;
let initError = null;

/** firebase-admin 지연 초기화 (키 없으면 null) */
function getMessaging() {
  if (messaging || initError) return messaging;
  try {
    if (!existsSync(KEY_PATH)) {
      initError = new Error(`서비스 계정 키 없음: ${KEY_PATH}`);
      return null;
    }
    const admin = require('firebase-admin');
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(readFileSync(KEY_PATH, 'utf8'))),
      });
    }
    messaging = admin.messaging();
    return messaging;
  } catch (err) {
    initError = err;
    return null;
  }
}

/** 초기화 가능 여부 (헬스체크·진단용) */
export function isPushAvailable() {
  return getMessaging() !== null;
}

export function getPushInitError() {
  return initError ? initError.message : null;
}

/**
 * 지정 토큰들로 푸시 발송. 무효 토큰은 DB에서 자동 정리.
 * @param {object} db
 * @param {string[]} tokens
 * @param {{title: string, body: string, data?: object}} payload
 */
export async function sendToTokens(db, tokens, payload) {
  const fcm = getMessaging();
  if (!fcm || tokens.length === 0) {
    return { sent: 0, failed: 0, skipped: !fcm };
  }

  const message = {
    notification: { title: payload.title, body: payload.body },
    data: Object.fromEntries(
      Object.entries(payload.data || {}).map(([k, v]) => [k, String(v)])
    ),
    android: {
      priority: 'high',
      notification: { channelId: 'fromis9_default' },
    },
    tokens,
  };

  const res = await fcm.sendEachForMulticast(message);

  // 무효 토큰 정리 (앱 삭제·토큰 만료)
  const dead = [];
  res.responses.forEach((r, i) => {
    const code = r.error?.code || '';
    if (
      code.includes('registration-token-not-registered') ||
      code.includes('invalid-registration-token') ||
      code.includes('invalid-argument')
    ) {
      dead.push(tokens[i]);
    }
  });
  if (dead.length > 0) {
    await db.query('DELETE FROM device_tokens WHERE token IN (?)', [dead]);
  }

  return { sent: res.successCount, failed: res.failureCount, removed: dead.length };
}

/**
 * 운영 알림 발송 (관리자 기기 전체)
 * @param {object} db
 * @param {{title: string, body: string, data?: object}} payload
 */
export async function sendOpsAlert(db, payload) {
  const [rows] = await db.query(
    'SELECT token FROM device_tokens WHERE is_admin = 1'
  );
  const tokens = rows.map((r) => r.token);
  return sendToTokens(db, tokens, {
    ...payload,
    data: { ...(payload.data || {}), kind: 'ops' },
  });
}
