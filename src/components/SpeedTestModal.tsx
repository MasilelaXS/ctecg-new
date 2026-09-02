import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { BorderRadius, Colors, Spacing, Typography } from '../constants/Design';
import { apiService } from '../services/api';
import {
  parsePlanSpeed,
  runSpeedtest,
  SpeedTestController,
  SpeedTestProgress,
  SpeedTestResult,
} from '../services/cloudflareSpeedtest';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Phase = SpeedTestProgress['phase'];

interface PlanInfo {
  downloadMbps: number;
  uploadMbps: number;
  label?: string;
}

const RUNNING_PHASES: Phase[] = ['meta', 'latency', 'download', 'upload'];
const DOWNLOAD_COLOR = Colors.primary;
const UPLOAD_COLOR = '#9146D8';
const GRAPH_POINTS = 48;

export default function SpeedTestModal({ visible, onClose }: Props) {
  const { width } = useWindowDimensions();
  const compact = width < 370;
  const [phase, setPhase] = useState<Phase>('idle');
  const [liveMbps, setLiveMbps] = useState(0);
  const [latency, setLatency] = useState<number | null>(null);
  const [jitter, setJitter] = useState<number | null>(null);
  const [packetLoss, setPacketLoss] = useState<number | null>(null);
  const [result, setResult] = useState<SpeedTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [samples, setSamples] = useState<number[]>([]);

  const controllerRef = useRef<SpeedTestController | null>(null);
  const runIdRef = useRef(0);
  const samplePhaseRef = useRef<Phase>('idle');
  const targetMbpsRef = useRef(0);
  const displayedMbpsRef = useRef(0);

  const reset = () => {
    setPhase('idle');
    setLiveMbps(0);
    setLatency(null);
    setJitter(null);
    setPacketLoss(null);
    setResult(null);
    setError(null);
    setSamples([]);
    samplePhaseRef.current = 'idle';
    targetMbpsRef.current = 0;
    displayedMbpsRef.current = 0;
  };

  const stop = () => {
    runIdRef.current += 1;
    controllerRef.current?.cancel();
    controllerRef.current = null;
  };

  const start = () => {
    stop();
    reset();
    const runId = runIdRef.current;
    const { controller, result: pending } = runSpeedtest({
      latencySamples: 10,
      downloadDurationSec: 15,
      uploadDurationSec: 12,
      parallelStreams: 6,
      onProgress: (update) => {
        if (runId !== runIdRef.current) return;
        setPhase(update.phase);
        if (update.latencyMs != null) setLatency(update.latencyMs);
        if (update.jitterMs != null) setJitter(update.jitterMs);
        if (update.packetLossPercent != null) setPacketLoss(update.packetLossPercent);
        if (update.phase === 'error') setError(update.error || 'Please check your connection and try again.');

        if (samplePhaseRef.current !== update.phase) {
          samplePhaseRef.current = update.phase;
          targetMbpsRef.current = 0;
          displayedMbpsRef.current = 0;
          setLiveMbps(0);
          setSamples([]);
        }
        if (update.phase === 'download' || update.phase === 'upload') {
          const measured = Math.max(0, update.mbps);
          const previousTarget = targetMbpsRef.current;
          targetMbpsRef.current = previousTarget <= 0
            ? measured
            : previousTarget * 0.62 + measured * 0.38;
        }
      },
    });
    controllerRef.current = controller;
    pending.then((completed) => {
      if (runId !== runIdRef.current) return;
      controllerRef.current = null;
      setResult(completed);
      setLatency(completed.latencyMs);
      setJitter(completed.jitterMs);
      setPacketLoss(completed.packetLossPercent);
      setPhase('done');
    }).catch(() => {
      // Errors are presented through onProgress.
    });
  };

  const cancel = () => {
    stop();
    reset();
  };

  const close = () => {
    stop();
    reset();
    onClose();
  };

  useEffect(() => {
    if (!visible) return undefined;
    let active = true;
    reset();
    setPlanLoading(true);
    apiService.getDetailedUsageData().then((response) => {
      if (!active) return;
      const info = (response?.data as any)?.summary?.package_info;
      if (!info) return;
      const download = Number(info.download_speed_mbps);
      const upload = Number(info.upload_speed_mbps);
      if (Number.isFinite(download) && download > 0) {
        setPlan({ downloadMbps: download, uploadMbps: Number.isFinite(upload) && upload > 0 ? upload : download, label: info.speed_description || info.name });
      } else {
        const parsed = parsePlanSpeed(info.speed_description || info.name);
        if (parsed) setPlan({ ...parsed, label: info.speed_description || info.name });
      }
    }).catch(() => {
      // Package comparison is optional.
    }).finally(() => {
      if (active) setPlanLoading(false);
    });
    return () => {
      active = false;
      stop();
    };
    // Modal visibility owns the lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Network progress callbacks arrive in bursts, especially for uploads.
  // Render on a steady clock and ease toward the latest measured value so
  // the number and graph remain fluid without changing the final result.
  useEffect(() => {
    if (phase !== 'download' && phase !== 'upload') return undefined;

    const timer = setInterval(() => {
      const current = displayedMbpsRef.current;
      const target = targetMbpsRef.current;
      const difference = target - current;
      const next = Math.abs(difference) < 0.01
        ? target
        : current + difference * 0.24;

      displayedMbpsRef.current = next;
      setLiveMbps(next);
      if (next > 0) {
        setSamples((existing) => [
          ...existing.slice(-(GRAPH_POINTS - 1)),
          next,
        ]);
      }
    }, 100);

    return () => clearInterval(timer);
  }, [phase]);

  const running = RUNNING_PHASES.includes(phase);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={close} accessibilityLabel="Close speed test" />
        <SafeAreaView style={[styles.sheet, (phase === 'idle' || phase === 'error') && styles.sheetCompact]} edges={['bottom']}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <TouchableOpacity style={styles.close} onPress={close} accessibilityRole="button" accessibilityLabel="Close speed test"><Ionicons name="close" size={25} color={Colors.text} /></TouchableOpacity>
            <View style={styles.headerCopy}><Text style={styles.headerTitle}>Speed test</Text><Text style={styles.headerSubtitle}>CTECG connection check</Text></View>
            {running ? <TouchableOpacity onPress={cancel} accessibilityRole="button"><Text style={styles.stopText}>Stop test</Text></TouchableOpacity> : <View style={styles.headerEnd} />}
          </View>

          <ScrollView contentContainerStyle={[styles.content, (phase === 'idle' || phase === 'error') && styles.contentCompact]} showsVerticalScrollIndicator={false}>
            {phase === 'idle' && <ReadyState onStart={start} plan={plan} loading={planLoading} />}
            {running && <LiveState phase={phase} value={liveMbps} samples={samples} compact={compact} />}
            {phase === 'done' && result && <ResultState result={result} plan={plan} />}
            {phase === 'error' && <ErrorState message={error} onRetry={start} />}

            {phase !== 'idle' && phase !== 'error' && (
              <ConnectionLine phase={phase} latency={latency} jitter={jitter} packetLoss={packetLoss} server={result?.server} />
            )}

            {phase === 'done' && <TouchableOpacity style={styles.primaryButton} onPress={start}><Ionicons name="refresh-outline" size={20} color={Colors.textInverse} /><Text style={styles.primaryButtonText}>Test again</Text></TouchableOpacity>}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function ReadyState({ onStart, plan, loading }: { onStart: () => void; plan: PlanInfo | null; loading: boolean }) {
  return <View style={styles.ready}>
    <View style={styles.networkLine}><Ionicons name="globe-outline" size={22} color={Colors.textMuted} /><Ionicons name="arrow-forward" size={16} color={Colors.textMuted} /><Text style={styles.networkText}>This device</Text></View>
    <Text style={styles.readyTitle}>Internet speed test</Text>
    <Text style={styles.readyText}>{loading ? 'Checking your package…' : plan ? `Your package  ·  ${plan.label || `${formatNumber(plan.downloadMbps)} Mbps`}` : 'Measure your CTECG connection'}</Text>
    <TouchableOpacity style={styles.startButton} onPress={onStart} accessibilityRole="button" accessibilityLabel="Start speed test"><Text style={styles.startButtonText}>Start test</Text></TouchableOpacity>
    <View style={styles.readyHintRow}><Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} /><Text style={styles.readyHint}>Pause other downloads for the most accurate result.</Text></View>
  </View>;
}

function LiveState({ phase, value, samples, compact }: { phase: Phase; value: number; samples: number[]; compact: boolean }) {
  const isUpload = phase === 'upload';
  const color = isUpload ? UPLOAD_COLOR : DOWNLOAD_COLOR;
  const label = phase === 'meta' ? 'Connecting' : phase === 'latency' ? 'Ping' : isUpload ? 'Upload' : 'Download';
  const shownValue = phase === 'latency' || phase === 'meta' ? '—' : formatNumber(value);
  return <View style={styles.live}>
    <Text style={[styles.liveLabel, { color }]}>{label}</Text>
    <View style={styles.liveValueRow}><Text style={[styles.liveValue, compact && styles.liveValueCompact]} adjustsFontSizeToFit numberOfLines={1}>{shownValue}</Text>{shownValue !== '—' && <Text style={styles.liveUnit}>Mbps</Text>}</View>
    <View style={styles.path}><Ionicons name="globe-outline" size={25} color={Colors.textMuted} /><View style={styles.pathDots}><View style={[styles.pathDot, { backgroundColor: color }]} /><View style={[styles.pathDot, { backgroundColor: color, opacity: 0.7 }]} /><View style={[styles.pathDot, { backgroundColor: color, opacity: 0.45 }]} /></View><Ionicons name="phone-portrait-outline" size={25} color={Colors.textMuted} /></View>
    <AreaGraph values={samples} color={color} />
  </View>;
}

function AreaGraph({ values, color }: { values: number[]; color: string }) {
  const { width } = useWindowDimensions();
  const graphWidth = Math.min(width, 620);
  const graphHeight = 260;
  const max = Math.max(1, ...values) * 1.08;
  const displayed = values.slice(-GRAPH_POINTS);
  const points = displayed.map((value, index) => ({
    x: (index / Math.max(1, GRAPH_POINTS - 1)) * graphWidth,
    y: graphHeight - Math.max(4, (value / max) * (graphHeight * 0.82)),
  }));
  const linePath = createSmoothPath(points);
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${graphHeight} L 0 ${graphHeight} Z`
    : '';

  return <View style={[styles.graph, { backgroundColor: `${color}0B` }]}>
    <Svg width="100%" height="100%" viewBox={`0 0 ${graphWidth} ${graphHeight}`} preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="speedFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.9} />
          <Stop offset="0.62" stopColor={color} stopOpacity={0.48} />
          <Stop offset="1" stopColor={color} stopOpacity={0.08} />
        </LinearGradient>
      </Defs>
      {areaPath ? <Path d={areaPath} fill="url(#speedFill)" /> : null}
      {linePath ? <Path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" /> : null}
    </Svg>
  </View>;
}

function createSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (!points.length) return '';
  if (points.length === 1) return `M 0 ${points[0].y} L ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const midpointX = (previous.x + current.x) / 2;
    path += ` C ${midpointX} ${previous.y}, ${midpointX} ${current.y}, ${current.x} ${current.y}`;
  }
  return path;
}

function ResultState({ result, plan }: { result: SpeedTestResult; plan: PlanInfo | null }) {
  const max = Math.max(result.downloadMbps, result.uploadMbps, plan?.downloadMbps || 0, 1);
  return <View style={styles.summary}>
    <View style={styles.networkLine}><Ionicons name="globe-outline" size={22} color={Colors.textMuted} /><Ionicons name="arrow-forward" size={16} color={Colors.textMuted} /><Text style={styles.networkText}>This device</Text></View>
    <SpeedBar color={DOWNLOAD_COLOR} icon="arrow-down" value={result.downloadMbps} max={max} />
    <SpeedBar color={UPLOAD_COLOR} icon="arrow-up" value={result.uploadMbps} max={max} />
    <Text style={styles.pingText}>Ping: {formatNumber(result.latencyMs)} ms</Text>
    <View style={styles.summaryDetails}>
      <Detail label="Jitter" value={`${formatNumber(result.jitterMs)} ms`} />
      <Detail label="Packet loss" value={`${formatNumber(result.packetLossPercent)}%`} />
      <Detail label="Test server" value={result.server === 'self' ? 'CTECG server' : 'Automatic edge'} />
    </View>
  </View>;
}

function SpeedBar({ color, icon, value, max }: { color: string; icon: 'arrow-down' | 'arrow-up'; value: number; max: number }) {
  return <View style={styles.speedBarRow}><View style={styles.speedBarTrack}><View style={[styles.speedBarFill, { width: `${Math.max(4, (value / max) * 100)}%`, backgroundColor: color }]} /></View><Ionicons name={icon} size={19} color={color} /><Text style={styles.speedBarValue}>{formatNumber(value)} Mbps</Text></View>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

function ConnectionLine({ phase, latency, jitter, packetLoss, server }: { phase: Phase; latency: number | null; jitter: number | null; packetLoss: number | null; server?: SpeedTestResult['server'] }) {
  return <View style={styles.connection}><Text style={styles.connectionText}>Connected via CTECG Internet Service Provider</Text><Text style={styles.connectionText}>to {server === 'self' ? 'CTECG test server' : 'automatic test server'}</Text>{phase === 'done' && <Text style={styles.connectionFine}>Ping {formatOptional(latency)} ms  ·  Jitter {formatOptional(jitter)} ms  ·  Loss {formatOptional(packetLoss)}%</Text>}</View>;
}

function ErrorState({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return <View style={styles.error}>
    <View style={styles.errorIcon}><Ionicons name="cloud-offline-outline" size={32} color={Colors.primary} /></View>
    <Text style={styles.errorTitle}>Test could not finish</Text>
    <Text style={styles.errorMessage}>{message || 'Please check your connection and try again.'}</Text>
    <TouchableOpacity style={styles.retryButton} onPress={onRetry} accessibilityRole="button"><Ionicons name="refresh-outline" size={19} color={Colors.textInverse} /><Text style={styles.retryButtonText}>Try again</Text></TouchableOpacity>
  </View>;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0.00';
  return value >= 100 ? value.toFixed(2) : value.toFixed(2);
}

function formatOptional(value: number | null): string {
  return value == null ? '—' : formatNumber(value);
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: { minHeight: '78%', maxHeight: '94%', backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  sheetCompact: { height: '64%', minHeight: 0, maxHeight: '70%' },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginTop: 9 },
  header: { height: 66, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md },
  close: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.backgroundAlt },
  headerCopy: { flex: 1, marginLeft: Spacing.sm },
  headerTitle: { fontSize: Typography.xl, fontWeight: Typography.weights.bold, color: Colors.text },
  headerSubtitle: { fontSize: Typography.xs, color: Colors.textSecondary },
  headerEnd: { width: 62 },
  stopText: { fontSize: Typography.sm, color: Colors.textSecondary, padding: Spacing.sm },
  content: { flexGrow: 1, width: '100%', maxWidth: 620, alignSelf: 'center', paddingBottom: Spacing.xl },
  contentCompact: { paddingBottom: Spacing.md },
  ready: { flex: 1, minHeight: 390, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  networkLine: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  networkText: { fontSize: Typography.sm, color: Colors.textSecondary },
  readyTitle: { fontSize: Typography.xxl, fontWeight: Typography.weights.bold, color: Colors.text },
  readyText: { maxWidth: 340, fontSize: Typography.sm, color: Colors.textSecondary, marginTop: Spacing.sm, textAlign: 'center' },
  startButton: { width: '100%', maxWidth: 340, height: 52, paddingHorizontal: Spacing.xl, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.md, backgroundColor: Colors.primary, marginTop: Spacing.xl },
  startButtonText: { fontSize: Typography.md, fontWeight: Typography.weights.bold, color: Colors.textInverse },
  readyHintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: Spacing.md },
  readyHint: { flexShrink: 1, fontSize: Typography.xs, color: Colors.textMuted, textAlign: 'center' },
  live: { minHeight: 570, alignItems: 'center', paddingTop: Spacing.xxl },
  liveLabel: { fontSize: Typography.xxl, fontWeight: Typography.weights.bold },
  liveValueRow: { height: 115, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: Spacing.md },
  liveValue: { maxWidth: '78%', fontSize: 88, lineHeight: 102, fontWeight: Typography.weights.bold, letterSpacing: -4, color: Colors.text },
  liveValueCompact: { fontSize: 72, lineHeight: 86 },
  liveUnit: { fontSize: Typography.xxl, color: Colors.textMuted, marginBottom: 18, marginLeft: 5 },
  path: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  pathDots: { flexDirection: 'row', gap: 4 },
  pathDot: { width: 6, height: 6, borderRadius: 3 },
  graph: { alignSelf: 'stretch', height: 260, marginTop: Spacing.lg, overflow: 'hidden' },
  summary: { minHeight: 470, paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  speedBarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  speedBarTrack: { flex: 1, height: 15, borderRadius: 8, overflow: 'hidden', backgroundColor: Colors.border, marginRight: Spacing.sm },
  speedBarFill: { height: '100%', borderRadius: 8 },
  speedBarValue: { width: 120, fontSize: Typography.sm, fontWeight: Typography.weights.bold, color: Colors.text, marginLeft: 4 },
  pingText: { fontSize: Typography.sm, color: Colors.text, marginTop: Spacing.sm },
  summaryDetails: { marginTop: Spacing.xxl, paddingTop: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.md },
  detailLabel: { fontSize: Typography.sm, fontWeight: Typography.weights.semibold, color: Colors.text },
  detailValue: { fontSize: Typography.sm, color: Colors.textSecondary },
  connection: { alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  connectionText: { fontSize: Typography.xs, lineHeight: 19, color: Colors.textMuted, textAlign: 'center' },
  connectionFine: { fontSize: 10, color: Colors.textMuted, marginTop: Spacing.sm, textAlign: 'center' },
  primaryButton: { height: 50, marginHorizontal: Spacing.lg, marginTop: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  primaryButtonText: { fontSize: Typography.sm, fontWeight: Typography.weights.bold, color: Colors.textInverse },
  error: { flex: 1, minHeight: 390, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  errorIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: `${Colors.primary}0D`, marginBottom: Spacing.md },
  errorTitle: { fontSize: Typography.xl, fontWeight: Typography.weights.bold, color: Colors.text },
  errorMessage: { maxWidth: 360, fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 20, textAlign: 'center', marginTop: Spacing.sm },
  retryButton: { width: '100%', maxWidth: 340, height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: Colors.primary, marginTop: Spacing.xl },
  retryButtonText: { fontSize: Typography.sm, fontWeight: Typography.weights.bold, color: Colors.textInverse },
});
