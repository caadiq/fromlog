export function installShutdown(app, { target = process, exit = code => process.exit(code), timeoutMs = 20000 } = {}) {
  let closing = false;
  const shutdown = async signal => {
    if (closing) return;
    closing = true;
    app.log.info({ signal }, '서버 종료 시작');
    const timer = setTimeout(() => { app.log.error('서버 종료 제한 시간 초과'); exit(1); }, timeoutMs);
    try { await app.close(); clearTimeout(timer); exit(0); }
    catch (err) { clearTimeout(timer); app.log.error(err); exit(1); }
  };
  const term = () => { void shutdown('SIGTERM'); };
  const int = () => { void shutdown('SIGINT'); };
  target.on('SIGTERM', term); target.on('SIGINT', int);
  return () => { target.off('SIGTERM', term); target.off('SIGINT', int); };
}
