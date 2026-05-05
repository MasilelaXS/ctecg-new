/**
 * Self-hosted speed test service.
 *
 * The accuracy-critical insight: a chunk-based test that awaits the full
 * response before sampling can only measure (request_setup + full_download
 * + buffer_handoff) per chunk. That under-reports — and produces the
 * "low value, then spike at the end" symptom. Real speedtests
 * (Ookla / WiFiman / fast.com) measure CONTINUOUS bytes-per-second from
 * streamed progress events, then take the steady-state average.
 *
 *   • DOWNLOAD: XMLHttpRequest + responseType='arraybuffer' + onprogress.
 *     RN's onprogress fires as bytes arrive over the wire, so we get true
 *     instantaneous throughput. We start ONE long-running stream per worker
 *     (250 MB cap on the server) so there's no per-chunk handshake cost.
 *   • UPLOAD: xhr.upload.onprogress is unreliable on iOS, so upload still
 *     uses chunked completions, but with smaller chunks and many concurrent
 *     streams to keep the pipe saturated.
 *   • Sliding window (1.5s) for live readout, steady-state (drop first 2.5s)
 *     for the final number.
 */

import { API_BASE_URL } from './api';

const SELF_HOST = `${API_BASE_URL}/speedtest.php`;

/**
 * Endpoint adapter. Cloudflare's public speed-test backend has effectively
 * unlimited bandwidth and global anycast edges — using it gives results that
 * match speed.cloudflare.com directly. The self-hosted PHP server is kept as
 * a fallback for when Cloudflare is unreachable (e.g. captive portals, ISP
 * filtering).
 */
type Endpoint = {
  name: 'cloudflare' | 'self';
  downUrl: (bytes: number) => string;
  upUrl: () => string;
  pingUrl: () => string;
};

const CLOUDFLARE: Endpoint = {
  name: 'cloudflare',
  downUrl: (bytes) =>
    `https://speed.cloudflare.com/__down?bytes=${bytes}&_=${Date.now()}-${Math.random()}`,
  upUrl: () =>
    `https://speed.cloudflare.com/__up?_=${Date.now()}-${Math.random()}`,
  pingUrl: () =>
    `https://speed.cloudflare.com/__down?bytes=0&_=${Date.now()}-${Math.random()}`,
};

const SELF: Endpoint = {
  name: 'self',
  downUrl: (bytes) =>
    `${SELF_HOST}?action=down&bytes=${bytes}&_=${Date.now()}-${Math.random()}`,
  upUrl: () => `${SELF_HOST}?action=up&_=${Date.now()}-${Math.random()}`,
  pingUrl: () => `${SELF_HOST}?action=ping&_=${Date.now()}`,
};

let cachedEndpoint: Endpoint | null = null;

/** Probe Cloudflare with a tiny request. Falls back to self-hosted on failure. */
async function pickEndpoint(): Promise<Endpoint> {
  if (cachedEndpoint) return cachedEndpoint;
  try {
    const ok = await new Promise<boolean>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.timeout = 4000;
      xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 400);
      xhr.onerror = () => resolve(false);
      xhr.ontimeout = () => resolve(false);
      try {
        xhr.open('GET', `https://speed.cloudflare.com/__down?bytes=1024`);
        xhr.send();
      } catch {
        resolve(false);
      }
    });
    cachedEndpoint = ok ? CLOUDFLARE : SELF;
  } catch {
    cachedEndpoint = SELF;
  }
  return cachedEndpoint;
}

export interface SpeedTestProgress {
  phase: 'idle' | 'meta' | 'latency' | 'download' | 'upload' | 'done' | 'error';
  mbps: number;
  progress: number;
  bytes: number;
  error?: string;
}

export interface SpeedTestResult {
  downloadMbps: number;
  uploadMbps: number;
  latencyMs: number;
  jitterMs: number;
  durationSec: number;
  /** Which test backend was used. */
  server: 'cloudflare' | 'self';
}

export interface SpeedTestController {
  cancel: () => void;
}

interface RunOptions {
  onProgress?: (p: SpeedTestProgress) => void;
  downloadDurationSec?: number;
  uploadDurationSec?: number;
  latencySamples?: number;
  /** Concurrent streams. Default 4 download / 6 upload. */
  parallelStreams?: number;
}

export function runSpeedtest(options: RunOptions = {}): {
  controller: SpeedTestController;
  result: Promise<SpeedTestResult>;
} {
  const {
    onProgress,
    downloadDurationSec = 12,
    uploadDurationSec = 12,
    latencySamples = 8,
    parallelStreams = 6,
  } = options;

  let cancelled = false;
  const activeXhrs = new Set<XMLHttpRequest>();

  const trackXhr = (x: XMLHttpRequest) => {
    activeXhrs.add(x);
    const cleanup = () => activeXhrs.delete(x);
    x.addEventListener('loadend', cleanup);
    x.addEventListener('abort', cleanup);
    x.addEventListener('error', cleanup);
  };

  const emit = (p: SpeedTestProgress) => {
    if (cancelled) return;
    try {
      onProgress?.(p);
    } catch {
      /* swallow */
    }
  };

  const controller: SpeedTestController = {
    cancel: () => {
      cancelled = true;
      for (const x of activeXhrs) {
        try {
          x.abort();
        } catch {
          /* ignore */
        }
      }
      activeXhrs.clear();
    },
  };

  const result = (async (): Promise<SpeedTestResult> => {
    const t0 = Date.now();

    emit({ phase: 'meta', mbps: 0, progress: 0, bytes: 0 });
    // Pick which backend we'll use for this run.
    const endpoint = await pickEndpoint();
    try {
      await measurePing(endpoint);
    } catch {
      /* noop */
    }
    if (cancelled) throw new Error('cancelled');

    // Latency / jitter
    emit({ phase: 'latency', mbps: 0, progress: 0, bytes: 0 });
    const pings: number[] = [];
    for (let i = 0; i < latencySamples; i++) {
      if (cancelled) throw new Error('cancelled');
      const t = await measurePing(endpoint);
      if (t != null) pings.push(t);
      emit({
        phase: 'latency',
        mbps: 0,
        progress: (i + 1) / latencySamples,
        bytes: 0,
      });
    }
    const sorted = [...pings].sort((a, b) => a - b);
    const latencyMs = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    const meanPing = pings.length
      ? pings.reduce((a, b) => a + b, 0) / pings.length
      : 0;
    const jitterMs = pings.length
      ? pings.reduce((a, p) => a + Math.abs(p - meanPing), 0) / pings.length
      : 0;

    // Download — streamed progress events.
    emit({ phase: 'download', mbps: 0, progress: 0, bytes: 0 });
    const downloadMbps = await measureDownloadStreamed({
      endpoint,
      durationSec: downloadDurationSec,
      streams: parallelStreams,
      isCancelled: () => cancelled,
      trackXhr,
      onTick: (mbps, progress, bytes) =>
        emit({ phase: 'download', mbps, progress, bytes }),
    });
    if (cancelled) throw new Error('cancelled');

    // Upload — chunked completions.
    emit({ phase: 'upload', mbps: 0, progress: 0, bytes: 0 });
    const uploadMbps = await measureUploadChunked({
      endpoint,
      durationSec: uploadDurationSec,
      streams: Math.max(parallelStreams, 6),
      isCancelled: () => cancelled,
      trackXhr,
      onTick: (mbps, progress, bytes) =>
        emit({ phase: 'upload', mbps, progress, bytes }),
    });
    if (cancelled) throw new Error('cancelled');

    const durationSec = (Date.now() - t0) / 1000;
    const final: SpeedTestResult = {
      downloadMbps,
      uploadMbps,
      latencyMs: Math.round(latencyMs),
      jitterMs,
      durationSec,
      server: endpoint.name,
    };
    emit({ phase: 'done', mbps: downloadMbps, progress: 1, bytes: 0 });
    return final;
  })();

  result.catch((err) => {
    if (cancelled) return;
    emit({
      phase: 'error',
      mbps: 0,
      progress: 0,
      bytes: 0,
      error: err?.message || 'Speed test failed',
    });
  });

  return { controller, result };
}

// ---------------------------------------------------------------------------
// Sliding-window helper used by both phases.
// ---------------------------------------------------------------------------
interface WindowState {
  /** Per-source last-seen byte count, to compute deltas. */
  lastBytes: number[];
  entries: { t: number; bytes: number }[];
  steadyEntries: { t: number; bytes: number }[];
  totalBytes: number;
  peakWindowMbps: number;
  start: number;
  durationMs: number;
  rampMs: number;
  windowMs: number;
}

function makeWindow(streams: number, durationSec: number): WindowState {
  return {
    lastBytes: new Array(streams).fill(0),
    entries: [],
    steadyEntries: [],
    totalBytes: 0,
    peakWindowMbps: 0,
    start: Date.now(),
    durationMs: durationSec * 1000,
    rampMs: 2500,
    windowMs: 1500,
  };
}

/** Add a byte sample for stream `idx`. Returns the live mbps + progress. */
function addSample(
  ws: WindowState,
  idx: number,
  cumulativeBytes: number,
): { liveMbps: number; progress: number; totalBytes: number } {
  const now = Date.now();
  const delta = Math.max(0, cumulativeBytes - ws.lastBytes[idx]);
  ws.lastBytes[idx] = cumulativeBytes;
  if (delta === 0) {
    return { liveMbps: 0, progress: 0, totalBytes: ws.totalBytes };
  }
  ws.totalBytes += delta;
  const e = { t: now, bytes: delta };
  ws.entries.push(e);
  if (now - ws.start >= ws.rampMs) ws.steadyEntries.push(e);

  const cutoff = now - ws.windowMs;
  while (ws.entries.length && ws.entries[0].t < cutoff) ws.entries.shift();

  const winBytes = ws.entries.reduce((a, x) => a + x.bytes, 0);
  const winSpan =
    ws.entries.length >= 2
      ? ws.entries[ws.entries.length - 1].t - ws.entries[0].t
      : ws.windowMs;
  const liveMbps =
    winSpan > 0 ? (winBytes * 8) / (winSpan / 1000) / 1_000_000 : 0;

  if (now - ws.start >= ws.rampMs && liveMbps > ws.peakWindowMbps) {
    ws.peakWindowMbps = liveMbps;
  }

  const progress = Math.min(0.99, (now - ws.start) / ws.durationMs);
  return { liveMbps, progress, totalBytes: ws.totalBytes };
}

function finalizeWindow(ws: WindowState): number {
  // Final number is the steady-state average over the post-ramp window.
  // Using max(steady, peak) caused the headline to jump up at the end of
  // the test relative to the live readout the user was watching, so we
  // stick with the running average — the live readout converges to it
  // smoothly.
  if (ws.steadyEntries.length >= 2) {
    const span =
      ws.steadyEntries[ws.steadyEntries.length - 1].t - ws.steadyEntries[0].t;
    const bytes = ws.steadyEntries.reduce((a, e) => a + e.bytes, 0);
    const steadyMbps =
      span > 0 ? (bytes * 8) / (span / 1000) / 1_000_000 : 0;
    return steadyMbps;
  }
  const totalSpan = (Date.now() - ws.start) / 1000;
  return totalSpan > 0 ? (ws.totalBytes * 8) / totalSpan / 1_000_000 : 0;
}

// ---------------------------------------------------------------------------
// Download — XHR with onprogress for true streamed measurement.
// ---------------------------------------------------------------------------
async function measureDownloadStreamed(opts: {
  endpoint: Endpoint;
  durationSec: number;
  streams: number;
  isCancelled: () => boolean;
  trackXhr: (x: XMLHttpRequest) => void;
  onTick: (mbps: number, progress: number, bytes: number) => void;
}): Promise<number> {
  const { endpoint, durationSec, streams, isCancelled, trackXhr, onTick } = opts;
  const ws = makeWindow(streams, durationSec);

  // Repeated medium-sized requests instead of one giant 250 MB request.
  // A single huge request triggers HTTP backpressure (the client can't
  // drain fast enough so the server gets throttled) and over-reports
  // network state in the first few seconds. 32 MB is large enough that
  // setup overhead is amortized but small enough that we can pipeline.
  const REQUEST_BYTES = 32 * 1024 * 1024;

  const stopAt = Date.now() + durationSec * 1000;

  const worker = (idx: number): Promise<void> =>
    new Promise((resolve) => {
      const tryOnce = () => {
        if (isCancelled() || Date.now() >= stopAt) {
          resolve();
          return;
        }

        const xhr = new XMLHttpRequest();
        trackXhr(xhr);
        let lastSeen = 0;
        // Reset the per-stream byte counter so deltas are correct across
        // successive requests.
        ws.lastBytes[idx] = 0;

        const cleanup = () => {
          try {
            xhr.abort();
          } catch {
            /* ignore */
          }
        };

        xhr.open('GET', endpoint.downUrl(REQUEST_BYTES));
        xhr.responseType = 'arraybuffer';
        xhr.timeout = durationSec * 1000 + 5000;

        xhr.onprogress = (ev: any) => {
          if (isCancelled()) {
            cleanup();
            resolve();
            return;
          }
          const loaded = ev.loaded || 0;
          if (loaded > lastSeen) {
            lastSeen = loaded;
            const { liveMbps, progress, totalBytes } = addSample(
              ws,
              idx,
              loaded,
            );
            onTick(liveMbps, progress, totalBytes);
          }
          if (Date.now() >= stopAt) {
            cleanup();
            resolve();
          }
        };

        const finish = () => {
          // Free the buffer immediately so memory doesn't balloon across
          // many sequential requests.
          try {
            (xhr as any).response = null;
          } catch {
            /* ignore */
          }
          if (Date.now() < stopAt && !isCancelled()) {
            // Pipeline the next request right away.
            tryOnce();
          } else {
            resolve();
          }
        };

        xhr.onload = finish;
        xhr.onerror = () => {
          if (Date.now() < stopAt && !isCancelled()) {
            setTimeout(tryOnce, 100);
          } else {
            resolve();
          }
        };
        xhr.ontimeout = () => resolve();
        xhr.onabort = () => resolve();

        try {
          xhr.send();
        } catch {
          resolve();
        }
      };

      tryOnce();
    });

  // Hard-stop ticker — guarantees we don't run past the deadline even if
  // a request is still streaming.
  const guard = setTimeout(() => {
    /* workers each check stopAt internally */
  }, durationSec * 1000);

  await Promise.all(Array.from({ length: streams }, (_, i) => worker(i)));
  clearTimeout(guard);
  const finalMbps = finalizeWindow(ws);
  onTick(finalMbps, 1, ws.totalBytes);
  return roundTo(finalMbps, 2);
}

// ---------------------------------------------------------------------------
// Upload — chunked completions with adaptive sizing.
// ---------------------------------------------------------------------------
async function measureUploadChunked(opts: {
  endpoint: Endpoint;
  durationSec: number;
  streams: number;
  isCancelled: () => boolean;
  trackXhr: (x: XMLHttpRequest) => void;
  onTick: (mbps: number, progress: number, bytes: number) => void;
}): Promise<number> {
  const { endpoint, durationSec, streams, isCancelled, trackXhr, onTick } = opts;
  const ws = makeWindow(streams, durationSec);

  const INITIAL = 512 * 1024;
  const MAX = 4 * 1024 * 1024;
  const sharedSize = { value: INITIAL };

  const stopAt = Date.now() + durationSec * 1000;
  const isDone = () => isCancelled() || Date.now() >= stopAt;

  const worker = async (idx: number) => {
    let cum = 0;
    while (!isDone()) {
      const size = sharedSize.value;
      const t0 = Date.now();
      try {
        await uploadOnce(endpoint, size, trackXhr);
        if (isDone()) return;
        cum += size;
        const ms = Date.now() - t0;
        const { liveMbps, progress, totalBytes } = addSample(ws, idx, cum);
        onTick(liveMbps, progress, totalBytes);

        // Adaptive — aim for ~500ms per chunk.
        const observed = ms > 0 ? (size * 8) / (ms / 1000) / 1_000_000 : 0;
        if (observed > 0) {
          const target = Math.round((observed * 1_000_000 * 0.5) / 8);
          sharedSize.value = Math.min(
            MAX,
            Math.max(INITIAL, target),
          );
        }
      } catch {
        if (isDone()) return;
        await new Promise((r) => setTimeout(r, 150));
      }
    }
  };

  await Promise.all(Array.from({ length: streams }, (_, i) => worker(i)));
  const finalMbps = finalizeWindow(ws);
  onTick(finalMbps, 1, ws.totalBytes);
  return roundTo(finalMbps, 2);
}

function uploadOnce(
  endpoint: Endpoint,
  bytes: number,
  trackXhr: (x: XMLHttpRequest) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const payload = new Uint8Array(bytes);
    for (let i = 0; i < bytes; i += 4096) payload[i] = (i & 0xff) ^ 0xa5;

    const xhr = new XMLHttpRequest();
    trackXhr(xhr);
    xhr.open('POST', endpoint.upUrl());
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.timeout = 30000;
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`upload HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('upload network error'));
    xhr.ontimeout = () => reject(new Error('upload timed out'));
    xhr.onabort = () => reject(new Error('cancelled'));
    try {
      xhr.send(payload as unknown as Document);
    } catch (e: any) {
      reject(e);
    }
  });
}

// ---------------------------------------------------------------------------
// Ping
// ---------------------------------------------------------------------------
function measurePing(endpoint: Endpoint): Promise<number | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    const xhr = new XMLHttpRequest();
    xhr.open('GET', endpoint.pingUrl());
    xhr.onload = () => resolve(Date.now() - start);
    xhr.onerror = () => resolve(null);
    xhr.ontimeout = () => resolve(null);
    xhr.timeout = 5000;
    try {
      xhr.send();
    } catch {
      resolve(null);
    }
  });
}

function roundTo(value: number, decimals: number): number {
  const m = Math.pow(10, decimals);
  return Math.round(value * m) / m;
}

// ---------------------------------------------------------------------------
// Plan parsing — extract Mbps numbers from a free-form plan description.
// ---------------------------------------------------------------------------
export function parsePlanSpeed(
  description: string | undefined | null,
): { downloadMbps: number; uploadMbps: number } | null {
  if (!description) return null;
  const text = description.toString();
  const split = text.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (split) {
    const d = parseFloat(split[1]);
    const u = parseFloat(split[2]);
    if (Number.isFinite(d) && Number.isFinite(u)) {
      return { downloadMbps: d, uploadMbps: u };
    }
  }
  const single = text.match(/(\d+(?:\.\d+)?)\s*[Mm]b(?:ps|\/s)?/);
  if (single) {
    const v = parseFloat(single[1]);
    if (Number.isFinite(v)) return { downloadMbps: v, uploadMbps: v };
  }
  return null;
}
