// 정적 봇 설정 (YouTube, X 봇은 DB에서 관리)
export default [
  {
    id: 'meilisearch-sync',
    type: 'meilisearch',
    name: 'Meilisearch 동기화',
    cron: '0 0 * * *', // 매일 00시 전체 동기화
    enabled: true,
  },
];
