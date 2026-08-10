import confetti from 'canvas-confetti';

/**
 * 데뷔/주년 폭죽 애니메이션
 * PC/Mobile 공용
 */
export function fireDebutConfetti() {
  const duration = 3000;
  const animationEnd = Date.now() + duration;
  const colors = ['#7a99c8', '#98b0d8', '#b8c8e8', '#ffffff', '#ffd700', '#c0c0c0'];

  const randomInRange = (min, max) => Math.random() * (max - min) + min;

  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      clearInterval(interval);
      return;
    }

    const particleCount = 50 * (timeLeft / duration);

    // 왼쪽에서 발사
    confetti({
      particleCount: Math.floor(particleCount),
      startVelocity: 30,
      spread: 60,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      colors,
      shapes: ['circle', 'square'],
      gravity: 1.2,
      scalar: randomInRange(0.8, 1.2),
      drift: randomInRange(-0.5, 0.5),
    });

    // 오른쪽에서 발사
    confetti({
      particleCount: Math.floor(particleCount),
      startVelocity: 30,
      spread: 60,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      colors,
      shapes: ['circle', 'square'],
      gravity: 1.2,
      scalar: randomInRange(0.8, 1.2),
      drift: randomInRange(-0.5, 0.5),
    });
  }, 250);

  // 초기 대형 폭죽
  confetti({
    particleCount: 100,
    spread: 100,
    origin: { x: 0.5, y: 0.6 },
    colors,
    shapes: ['circle', 'square'],
    startVelocity: 45,
  });
}

/**
 * 생일 폭죽 애니메이션
 * PC/Mobile 공용
 */
export function fireBirthdayConfetti() {
  const duration = 3000;
  const animationEnd = Date.now() + duration;
  const colors = ['#ff69b4', '#ff1493', '#da70d6', '#ba55d3', '#9370db', '#8a2be2', '#ffd700', '#ff6347'];

  const randomInRange = (min, max) => Math.random() * (max - min) + min;

  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      clearInterval(interval);
      return;
    }

    const particleCount = 50 * (timeLeft / duration);

    // 왼쪽에서 발사
    confetti({
      particleCount: Math.floor(particleCount),
      startVelocity: 30,
      spread: 60,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      colors,
      shapes: ['circle', 'square'],
      gravity: 1.2,
      scalar: randomInRange(0.8, 1.2),
      drift: randomInRange(-0.5, 0.5),
    });

    // 오른쪽에서 발사
    confetti({
      particleCount: Math.floor(particleCount),
      startVelocity: 30,
      spread: 60,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      colors,
      shapes: ['circle', 'square'],
      gravity: 1.2,
      scalar: randomInRange(0.8, 1.2),
      drift: randomInRange(-0.5, 0.5),
    });
  }, 250);

  // 초기 대형 폭죽
  confetti({
    particleCount: 100,
    spread: 100,
    origin: { x: 0.5, y: 0.6 },
    colors,
    shapes: ['circle', 'square'],
    startVelocity: 45,
  });
}
