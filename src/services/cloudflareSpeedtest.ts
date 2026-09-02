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
import {
  cacheDirectory,
  createDownloadResumable,
  createUploadTask,
  deleteAsync,
  DownloadResumable,
  FileSystemUploadType,
  UploadTask,
} from 'expo-file-system/legacy';
import { File, Paths } from 'expo-file-system';

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
  latencyMs?: number;
  jitterMs?: number;
  packetLossPercent?: number;
  error?: string;
}

export interface SpeedTestResult {
  downloadMbps: number;
  uploadMbps: number;
  latencyMs: number;
  jitterMs: number;
  packetLossPercent: number;
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
  const activeFetches = new Set<AbortController>();
  const activeNativeDownloads = new Set<DownloadResumable>();
  const activeNativeUploads = new Set<UploadTask>();

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
      for (const abortController of activeFetches) {
        abortController.abort();
      }
      activeFetches.clear();
      for (const download of activeNativeDownloads) {
        void download.cancelAsync().catch(() => undefined);
      }
      activeNativeDownloads.clear();
      for (const upload of activeNativeUploads) {
        void upload.cancelAsync().catch(() => undefined);
      }
      activeNativeUploads.clear();
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
      const latencyStats = calculateLatencyStats(pings, i + 1);
      emit({
        phase: 'latency',
        mbps: 0,
        progress: (i + 1) / latencySamples,
        bytes: 0,
        ...latencyStats,
      });
    }
    if (pings.length < Math.max(3, Math.ceil(latencySamples / 2))) {
      throw new Error('Unable to measure a stable connection. Please try again.');
    }
    const { latencyMs, jitterMs, packetLossPercent } = calculateLatencyStats(
      pings,
      latencySamples,
    );

    // Download — streamed progress events.
    emit({ phase: 'download', mbps: 0, progress: 0, bytes: 0 });
    // Download needs more parallel flows than upload on mobile. React Native
    // materializes each response across the native/JS boundary, and a small
    // number of flows can become CPU/latency bound before the line is full.
    const downloadStreams = Math.min(12, Math.max(8, parallelStreams * 2));
    const downloadMbps = await measureDownloadStreamed({
      endpoint,
      durationSec: downloadDurationSec,
      streams: downloadStreams,
      isCancelled: () => cancelled,
      trackXhr,
      trackFetch: (abortController) => {
        activeFetches.add(abortController);
        return () => activeFetches.delete(abortController);
      },
      trackNativeDownload: (download) => {
        activeNativeDownloads.add(download);
        return () => activeNativeDownloads.delete(download);
      },
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
      trackNativeUpload: (upload) => {
        activeNativeUploads.add(upload);
        return () => activeNativeUploads.delete(upload);
      },
      onTick: (mbps, progress, bytes) =>
        emit({ phase: 'upload', mbps, progress, bytes }),
    });
    if (cancelled) throw new Error('cancelled');

    const durationSec = (Date.now() - t0) / 1000;
    const final: SpeedTestResult = {
      downloadMbps,
      uploadMbps,
      latencyMs: Math.round(latencyMs),
      jitterMs: roundTo(jitterMs, 1),
      packetLossPercent: roundTo(packetLossPercent, 1),
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
  steadyBytes: number;
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
    steadyBytes: 0,
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
  if (now - ws.start >= ws.rampMs) {
    ws.steadyEntries.push(e);
    ws.steadyBytes += delta;
  }

  const cutoff = now - ws.windowMs;
  while (ws.entries.length && ws.entries[0].t < cutoff) ws.entries.shift();

  const winBytes = ws.entries.reduce((a, x) => a + x.bytes, 0);
  // Use the real wall-clock observation window. Measuring only between the
  // first and last progress event omits the final transfer interval and can
  // materially overstate throughput, especially on fast connections.
  const winSpan = Math.min(ws.windowMs, Math.max(1, now - ws.start));
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
    const span = Date.now() - (ws.start + ws.rampMs);
    const steadyMbps =
      span > 0 ? (ws.steadyBytes * 8) / (span / 1000) / 1_000_000 : 0;
    return steadyMbps;
  }
  const totalSpan = (Date.now() - ws.start) / 1000;
  return totalSpan > 0 ? (ws.totalBytes * 8) / totalSpan / 1_000_000 : 0;
}

// ---------------------------------------------------------------------------
// Download — XHR with onprogress for true streamed measurement.
// ---------------------------------------------------------------------------
interface DownloadMeasurementOptions {
  endpoint: Endpoint;
  durationSec: number;
  streams: number;
  isCancelled: () => boolean;
  trackXhr: (x: XMLHttpRequest) => void;
  trackFetch: (controller: AbortController) => () => void;
  trackNativeDownload: (download: DownloadResumable) => () => void;
  onTick: (mbps: number, progress: number, bytes: number) => void;
}

async function measureDownloadStreamed(
  opts: DownloadMeasurementOptions,
): Promise<number> {
  if (cacheDirectory) {
    return measureDownloadNative(opts);
  }
  if (typeof fetch !== 'function' || typeof AbortController === 'undefined') {
    return measureDownloadStreamedLegacy(opts);
  }

  const {
    endpoint,
    durationSec,
    streams,
    isCancelled,
    trackFetch,
    onTick,
  } = opts;
  const ws = makeWindow(streams, durationSec);
  const stopAt = Date.now() + durationSec * 1000;
  const sharedSize = { value: 256 * 1024 };
  const MIN_BYTES = 128 * 1024;
  // Keep completions frequent enough for a fluid graph. Concurrency, rather
  // than very large individual buffers, is what saturates faster links.
  const MAX_BYTES = 2 * 1024 * 1024;

  const worker = async (idx: number) => {
    let cumulativeBytes = 0;
    while (!isCancelled() && Date.now() < stopAt) {
      const bytesRequested = sharedSize.value;
      const startedAt = Date.now();
      const abortController = new AbortController();
      const untrack = trackFetch(abortController);
      const remainingMs = Math.max(1, stopAt - Date.now());
      const deadline = setTimeout(() => abortController.abort(), remainingMs);

      try {
        const response = await fetch(endpoint.downUrl(bytesRequested), {
          method: 'GET',
          cache: 'no-store',
          signal: abortController.signal,
        });
        if (!response.ok) {
          throw new Error(`download HTTP ${response.status}`);
        }
        const body = await response.arrayBuffer();
        if (isCancelled()) return;

        const receivedBytes = body.byteLength > 0
          ? body.byteLength
          : bytesRequested;
        cumulativeBytes += receivedBytes;
        const sample = addSample(ws, idx, cumulativeBytes);
        onTick(sample.liveMbps, sample.progress, sample.totalBytes);

        const elapsedMs = Date.now() - startedAt;
        if (elapsedMs < 450) {
          sharedSize.value = Math.min(MAX_BYTES, bytesRequested * 2);
        } else if (elapsedMs > 1800) {
          sharedSize.value = Math.max(MIN_BYTES, Math.floor(bytesRequested / 2));
        }
      } catch {
        if (isCancelled() || Date.now() >= stopAt) return;
        await new Promise((resolve) => setTimeout(resolve, 80));
      } finally {
        clearTimeout(deadline);
        untrack();
      }
    }
  };

  await Promise.all(Array.from({ length: streams }, (_, index) => worker(index)));
  const finalMbps = finalizeWindow(ws);
  onTick(finalMbps, 1, ws.totalBytes);
  return roundTo(finalMbps, 2);
}

async function measureDownloadNative(
  opts: DownloadMeasurementOptions,
): Promise<number> {
  const {
    endpoint,
    durationSec,
    streams,
    isCancelled,
    trackNativeDownload,
    onTick,
  } = opts;
  const ws = makeWindow(streams, durationSec);
  const stopAt = Date.now() + durationSec * 1000;
  const sharedSize = { value: 512 * 1024 };
  const MIN_BYTES = 256 * 1024;
  const MAX_BYTES = 16 * 1024 * 1024;
  let requestSequence = 0;
  const nativeDownloads = new Set<DownloadResumable>();

  const worker = async (idx: number) => {
    while (!isCancelled() && Date.now() < stopAt) {
      const requestedBytes = sharedSize.value;
      const startedAt = Date.now();
      const sequence = requestSequence++;
      const fileUri = `${cacheDirectory}ctecg-speedtest-${Date.now()}-${idx}-${sequence}.bin`;
      ws.lastBytes[idx] = 0;

      const download = createDownloadResumable(
        endpoint.downUrl(requestedBytes),
        fileUri,
        { cache: false },
        ({ totalBytesWritten }) => {
          if (isCancelled()) return;
          const sample = addSample(ws, idx, totalBytesWritten);
          onTick(sample.liveMbps, sample.progress, sample.totalBytes);
        },
      );
      nativeDownloads.add(download);
      const untrack = trackNativeDownload(download);

      try {
        const completed = await download.downloadAsync();
        if (!completed || isCancelled()) return;

        const elapsedMs = Date.now() - startedAt;
        if (elapsedMs < 650) {
          sharedSize.value = Math.min(MAX_BYTES, requestedBytes * 2);
        } else if (elapsedMs > 2400) {
          sharedSize.value = Math.max(MIN_BYTES, Math.floor(requestedBytes / 2));
        }
      } catch {
        if (isCancelled() || Date.now() >= stopAt) return;
        await new Promise((resolve) => setTimeout(resolve, 80));
      } finally {
        nativeDownloads.delete(download);
        untrack();
        void deleteAsync(fileUri, { idempotent: true }).catch(() => undefined);
      }
    }
  };

  const deadline = setTimeout(() => {
    for (const download of nativeDownloads) {
      void download.cancelAsync().catch(() => undefined);
    }
    nativeDownloads.clear();
  }, durationSec * 1000);
  await Promise.all(Array.from({ length: streams }, (_, index) => worker(index)));
  clearTimeout(deadline);
  const finalMbps = finalizeWindow(ws);
  onTick(finalMbps, 1, ws.totalBytes);
  return roundTo(finalMbps, 2);
}

async function measureDownloadStreamedLegacy(
  opts: DownloadMeasurementOptions,
): Promise<number> {
  const { endpoint, durationSec, streams, isCancelled, trackXhr, onTick } = opts;
  const ws = makeWindow(streams, durationSec);

  // Repeated medium-sized requests instead of one giant 250 MB request.
  // A single huge request triggers HTTP backpressure (the client can't
  // drain fast enough so the server gets throttled) and over-reports
  // network state in the first few seconds. 32 MB is large enough that
  // setup overhead is amortized but small enough that we can pipeline.
  // Begin with small requests so slow connections still complete a sample,
  // then grow quickly to reduce request overhead on fast links.
  const requestSize = { value: 128 * 1024 };
  const MAX_REQUEST_BYTES = 4 * 1024 * 1024;

  const stopAt = Date.now() + durationSec * 1000;
  const activeDownloads = new Set<XMLHttpRequest>();

  const worker = (idx: number): Promise<void> =>
    new Promise((resolve) => {
      const tryOnce = () => {
        if (isCancelled() || Date.now() >= stopAt) {
          resolve();
          return;
        }

        const xhr = new XMLHttpRequest();
        activeDownloads.add(xhr);
        trackXhr(xhr);
        const requestBytes = requestSize.value;
        const requestStartedAt = Date.now();
        let lastSeen = 0;
        let settled = false;
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

        xhr.open('GET', endpoint.downUrl(requestBytes));
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
          if (settled) return;
          settled = true;
          activeDownloads.delete(xhr);

          // Some React Native versions emit no incremental progress events
          // for arraybuffer responses. Count the completed response as the
          // fallback so a successful transfer cannot produce a zero result.
          const bufferedResponseBytes =
            xhr.response && typeof xhr.response.byteLength === 'number'
              ? xhr.response.byteLength
              : 0;
          // React Native can expose a completed arraybuffer response without
          // byteLength on some Android builds. A successful load means the
          // requested fixed-length payload was received in full, so the
          // requested size is the reliable fallback measurement.
          const responseBytes = bufferedResponseBytes > 0
            ? bufferedResponseBytes
            : (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300))
              ? requestBytes
              : 0;
          if (responseBytes > lastSeen) {
            lastSeen = responseBytes;
            const sample = addSample(ws, idx, responseBytes);
            onTick(sample.liveMbps, sample.progress, sample.totalBytes);
          }

          const requestDuration = Date.now() - requestStartedAt;
          if (requestDuration < 350) {
            requestSize.value = Math.min(MAX_REQUEST_BYTES, requestBytes * 2);
          } else if (requestDuration > 1500) {
            requestSize.value = Math.max(64 * 1024, Math.floor(requestBytes / 2));
          }

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
          if (settled) return;
          settled = true;
          activeDownloads.delete(xhr);
          if (Date.now() < stopAt && !isCancelled()) {
            setTimeout(tryOnce, 100);
          } else {
            resolve();
          }
        };
        xhr.ontimeout = () => {
          if (settled) return;
          settled = true;
          activeDownloads.delete(xhr);
          resolve();
        };
        xhr.onabort = () => {
          if (settled) return;
          settled = true;
          activeDownloads.delete(xhr);
          resolve();
        };

        try {
          xhr.send();
        } catch {
          settled = true;
          activeDownloads.delete(xhr);
          resolve();
        }
      };

      tryOnce();
    });

  // Hard-stop ticker — guarantees we don't run past the deadline even if
  // a request is still streaming.
  const guard = setTimeout(() => {
    for (const xhr of activeDownloads) {
      try {
        xhr.abort();
      } catch {
        /* request may already have completed */
      }
    }
    activeDownloads.clear();
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
  trackNativeUpload: (upload: UploadTask) => () => void;
  onTick: (mbps: number, progress: number, bytes: number) => void;
}): Promise<number> {
  const { endpoint, durationSec, streams, isCancelled, trackNativeUpload, onTick } = opts;
  const ws = makeWindow(streams, durationSec);

  const INITIAL = 512 * 1024;
  const MAX = 4 * 1024 * 1024;
  const sharedSize = { value: INITIAL };

  const stopAt = Date.now() + durationSec * 1000;
  const isDone = () => isCancelled() || Date.now() >= stopAt;
  const nativeUploads = new Set<UploadTask>();
  let uploadSequence = 0;

  const worker = async (idx: number) => {
    while (!isDone()) {
      const size = sharedSize.value;
      const payload = createUploadPayload(size);
      const file = new File(
        Paths.cache,
        `ctecg-speedtest-upload-${Date.now()}-${idx}-${uploadSequence++}.bin`,
      );
      file.create({ overwrite: true });
      file.write(payload);
      ws.lastBytes[idx] = 0;

      const upload = createUploadTask(
        endpoint.upUrl(),
        file.uri,
        {
          httpMethod: 'POST',
          uploadType: FileSystemUploadType.BINARY_CONTENT,
          headers: { 'Content-Type': 'application/octet-stream' },
        },
        ({ totalBytesSent }) => {
          if (isCancelled()) return;
          const sample = addSample(ws, idx, totalBytesSent);
          onTick(sample.liveMbps, sample.progress, sample.totalBytes);
        },
      );
      nativeUploads.add(upload);
      const untrack = trackNativeUpload(upload);
      const t0 = Date.now();
      try {
        const completed = await upload.uploadAsync();
        if (!completed || completed.status < 200 || completed.status >= 300) {
          throw new Error(`upload HTTP ${completed?.status ?? 0}`);
        }
        // Count a chunk that completed at the deadline. Dropping it would
        // exclude bytes that genuinely crossed the network and bias upload
        // results downward on slower connections.
        if (isCancelled()) return;
        const ms = Date.now() - t0;

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
      } finally {
        nativeUploads.delete(upload);
        untrack();
        try {
          file.delete();
        } catch {
          /* cache cleanup is best-effort */
        }
      }
    }
  };

  const deadline = setTimeout(() => {
    for (const upload of nativeUploads) {
      void upload.cancelAsync().catch(() => undefined);
    }
    nativeUploads.clear();
  }, durationSec * 1000);
  await Promise.all(Array.from({ length: streams }, (_, i) => worker(i)));
  clearTimeout(deadline);
  const finalMbps = finalizeWindow(ws);
  onTick(finalMbps, 1, ws.totalBytes);
  return roundTo(finalMbps, 2);
}

function createUploadPayload(bytes: number): Uint8Array {
  const payload = new Uint8Array(bytes);
  for (let index = 0; index < bytes; index += 4096) {
    payload[index] = (index & 0xff) ^ 0xa5;
  }
  return payload;
}

// ---------------------------------------------------------------------------
// Ping
// ---------------------------------------------------------------------------
function measurePing(endpoint: Endpoint): Promise<number | null> {
  return new Promise((resolve) => {
    const start = preciseNow();
    const xhr = new XMLHttpRequest();
    xhr.open('GET', endpoint.pingUrl());
    xhr.onload = () => resolve(preciseNow() - start);
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

function preciseNow(): number {
  return typeof globalThis.performance?.now === 'function'
    ? globalThis.performance.now()
    : Date.now();
}

function calculateLatencyStats(
  samples: number[],
  attempts: number,
): { latencyMs: number; jitterMs: number; packetLossPercent: number } {
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const latencyMs = sorted.length
    ? sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2
    : 0;

  let jitterMs = 0;
  if (samples.length > 1) {
    let variation = 0;
    for (let i = 1; i < samples.length; i++) {
      variation += Math.abs(samples[i] - samples[i - 1]);
    }
    jitterMs = variation / (samples.length - 1);
  }

  const packetLossPercent = attempts > 0
    ? ((attempts - samples.length) / attempts) * 100
    : 0;

  return { latencyMs, jitterMs, packetLossPercent };
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
