export interface GuideRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}
const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, Math.max(min, max)));
export function placeGuide(
  target: GuideRect,
  viewport: { width: number; height: number },
  card: { width: number; height: number },
) {
  const gap = 16;
  const width = Math.min(card.width, viewport.width - 32);
  const height = Math.min(card.height, viewport.height - 32);
  let left: number;
  let top: number;
  if (target.left + target.width + gap + width <= viewport.width - 16) {
    left = target.left + target.width + gap;
    top = clamp(target.top, 16, viewport.height - height - 16);
  } else if (target.top + target.height + gap + height <= viewport.height - 16) {
    left = clamp(target.left, 16, viewport.width - width - 16);
    top = target.top + target.height + gap;
  } else if (target.top - gap - height >= 16) {
    left = clamp(target.left, 16, viewport.width - width - 16);
    top = target.top - gap - height;
  } else {
    left = clamp(target.left - width - gap, 16, viewport.width - width - 16);
    top = clamp(viewport.height - height - 16, 16, viewport.height - height - 16);
  }
  return {
    card: { left, top },
    highlight: {
      left: clamp(target.left - 6, 2, viewport.width - 4),
      top: clamp(target.top - 6, 2, viewport.height - 4),
      width: Math.max(
        0,
        Math.min(target.width + 12, viewport.width - Math.max(2, target.left - 6) - 2),
      ),
      height: Math.max(
        0,
        Math.min(target.height + 12, viewport.height - Math.max(2, target.top - 6) - 2),
      ),
    },
  };
}
export function findGuideTarget(target: string): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>('[data-guide]')].find((element) => {
    const rect = element.getBoundingClientRect();
    return (
      element.dataset.guide === target &&
      rect.width > 0 &&
      rect.height > 0 &&
      getComputedStyle(element).visibility !== 'hidden'
    );
  });
}
export function waitForGuideTarget(target: string, signal: AbortSignal): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const observer = new MutationObserver(check);
    function cleanup(): void {
      clearTimeout(timer);
      observer.disconnect();
      signal.removeEventListener('abort', abort);
    }
    function abort(): void {
      cleanup();
      reject(new DOMException('Cancelled', 'AbortError'));
    }
    function check(): void {
      const element = findGuideTarget(target);
      if (element) {
        cleanup();
        resolve(element);
      }
    }
    if (signal.aborted) {
      abort();
      return;
    }
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    signal.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => {
      cleanup();
      reject(new Error('暂时无法定位此功能。请重试，或继续查看下一步。'));
    }, 3000);
    check();
  });
}
