import type { BgOptions } from './types';

export interface RawImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

interface WorkerResponse extends RawImage {
  id: number;
  error?: string;
}

let worker: Worker | null = null;
let sequence = 0;
const pending = new Map<number, { resolve: (value: RawImage) => void; reject: (err: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('../workers/bgRemove.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const message = event.data;
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) {
      entry.reject(new Error(message.error));
    } else {
      entry.resolve({ width: message.width, height: message.height, data: message.data });
    }
  };
  worker.onerror = (event) => {
    const error = new Error(event.message || 'Background removal worker crashed');
    for (const entry of pending.values()) entry.reject(error);
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

export function removeBackground(image: RawImage, options: BgOptions): Promise<RawImage> {
  return new Promise((resolve, reject) => {
    const w = getWorker();
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    const copy = new Uint8ClampedArray(image.data);
    w.postMessage(
      {
        id,
        width: image.width,
        height: image.height,
        data: copy,
        options,
      },
      [copy.buffer],
    );
  });
}

export function disposeBackgroundWorker(): void {
  worker?.terminate();
  worker = null;
  pending.clear();
}
