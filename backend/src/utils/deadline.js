// Bound waiting without hiding a late rejection. The operation itself may still finish.
export async function withDeadline(work, milliseconds) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(work),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Operation timed out')), milliseconds); }),
    ]);
  } finally { clearTimeout(timer); }
}
