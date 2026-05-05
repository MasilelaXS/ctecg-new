import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing } from '../constants/Design';
import {
  runSpeedtest,
  parsePlanSpeed,
  SpeedTestController,
  SpeedTestProgress,
  SpeedTestResult,
} from '../services/cloudflareSpeedtest';
import { apiService } from '../services/api';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Phase = SpeedTestProgress['phase'];

const PHASE_LABEL: Record<Phase, string> = {
  idle: 'Ready',
  meta: 'Connecting…',
  latency: 'Measuring latency',
  download: 'Testing download',
  upload: 'Testing upload',
  done: 'Test complete',
  error: 'Test failed',
};

interface PlanInfo {
  downloadMbps: number;
  uploadMbps: number;
  label?: string;
}

interface Sample {
  mbps: number;
}

const SCREEN_W = Dimensions.get('window').width;
const CHART_W = Math.min(SCREEN_W - 32 - 24, 520);
const CHART_H = 130;
const MAX_SAMPLES = 60;

function gaugeMaxFor(value: number, planMax?: number): number {
  const target = Math.max(value * 1.25, planMax ? planMax * 1.25 : 0, 25);
  const tiers = [25, 50, 100, 200, 500, 1000, 2000, 5000];
  return tiers.find((t) => t >= target) ?? Math.ceil(target / 100) * 100;
}

export default function SpeedTestModal({ visible, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [liveMbps, setLiveMbps] = useState(0);
  const [phaseProgress, setPhaseProgress] = useState(0);
  const [bytesNow, setBytesNow] = useState(0);
  const [result, setResult] = useState<SpeedTestResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [planLoading, setPlanLoading] = useState(true);

  const [downSamples, setDownSamples] = useState<Sample[]>([]);
  const [upSamples, setUpSamples] = useState<Sample[]>([]);

  const controllerRef = useRef<SpeedTestController | null>(null);
  // Throttle chart sample appends — onProgress fires very frequently now
  // (every XHR progress event) and unthrottled the bars would race past.
  const lastSampleAtRef = useRef<{ download: number; upload: number }>({
    download: 0,
    upload: 0,
  });
  const SAMPLE_INTERVAL_MS = 300;

  // ---- Plan lookup ------------------------------------------------------
  // Source of truth is getDetailedUsageData() -> data.summary.package_info.
  // The shorter getUsageData() does NOT carry plan speeds.
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    (async () => {
      setPlanLoading(true);
      try {
        const res = await apiService.getDetailedUsageData();
        if (!alive) return;
        const info = (res?.data as any)?.summary?.package_info;
        if (info) {
          const dlNum = Number(info.download_speed_mbps);
          const upNum = Number(info.upload_speed_mbps);
          if (Number.isFinite(dlNum) && dlNum > 0) {
            setPlan({
              downloadMbps: dlNum,
              uploadMbps:
                Number.isFinite(upNum) && upNum > 0 ? upNum : dlNum,
              label: info.speed_description || info.name,
            });
            return;
          }
          const parsed = parsePlanSpeed(info.speed_description);
          if (parsed) {
            setPlan({
              ...parsed,
              label: info.speed_description || info.name,
            });
            return;
          }
        }
      } catch {
        /* plan info is optional */
      } finally {
        if (alive) setPlanLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [visible]);

  // ---- Test lifecycle ---------------------------------------------------
  const reset = () => {
    setPhase('idle');
    setLiveMbps(0);
    setPhaseProgress(0);
    setBytesNow(0);
    setResult(null);
    setErrorMsg(null);
    setDownSamples([]);
    setUpSamples([]);
    lastSampleAtRef.current = { download: 0, upload: 0 };
  };

  const start = () => {
    reset();
    const { controller, result: pending } = runSpeedtest({
      onProgress: (p) => {
        setPhase(p.phase);
        setLiveMbps(p.mbps);
        setPhaseProgress(p.progress);
        setBytesNow(p.bytes || 0);
        if (p.phase === 'error') setErrorMsg(p.error || 'Test failed');

        const now = Date.now();
        if (p.phase === 'download' && p.mbps > 0) {
          if (now - lastSampleAtRef.current.download >= SAMPLE_INTERVAL_MS) {
            lastSampleAtRef.current.download = now;
            setDownSamples((prev) => {
              const next =
                prev.length >= MAX_SAMPLES ? prev.slice(1) : prev.slice();
              next.push({ mbps: p.mbps });
              return next;
            });
          }
        } else if (p.phase === 'upload' && p.mbps > 0) {
          if (now - lastSampleAtRef.current.upload >= SAMPLE_INTERVAL_MS) {
            lastSampleAtRef.current.upload = now;
            setUpSamples((prev) => {
              const next =
                prev.length >= MAX_SAMPLES ? prev.slice(1) : prev.slice();
              next.push({ mbps: p.mbps });
              return next;
            });
          }
        }
      },
    });
    controllerRef.current = controller;
    pending
      .then((r) => {
        setResult(r);
        setPhase('done');
        setPhaseProgress(1);
      })
      .catch(() => {
        /* surfaced via onProgress */
      });
  };

  const cancel = () => {
    controllerRef.current?.cancel();
    controllerRef.current = null;
    setPhase('idle');
    setLiveMbps(0);
    setPhaseProgress(0);
  };

  const handleClose = () => {
    controllerRef.current?.cancel();
    controllerRef.current = null;
    reset();
    onClose();
  };

  useEffect(() => {
    if (visible) start();
    else {
      controllerRef.current?.cancel();
      controllerRef.current = null;
    }
    return () => {
      controllerRef.current?.cancel();
      controllerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ---- Derived ---------------------------------------------------------
  const isRunning =
    phase === 'meta' ||
    phase === 'latency' ||
    phase === 'download' ||
    phase === 'upload';

  const isUpload = phase === 'upload';
  const activeSamples = isUpload ? upSamples : downSamples;
  const planForPhase = isUpload ? plan?.uploadMbps : plan?.downloadMbps;

  const headlineMbps = (() => {
    if (phase === 'done' && result) return result.downloadMbps;
    if (phase === 'upload' || phase === 'download') return liveMbps;
    return 0;
  })();

  const peakInPhase = useMemo(() => {
    if (!activeSamples.length) return 0;
    return activeSamples.reduce((m, s) => (s.mbps > m ? s.mbps : m), 0);
  }, [activeSamples]);

  const chartMax = useMemo(
    () => gaugeMaxFor(Math.max(headlineMbps, peakInPhase), planForPhase),
    [headlineMbps, peakInPhase, planForPhase],
  );

  const accent =
    phase === 'error'
      ? Colors.error
      : isUpload
      ? '#3B82F6'
      : phase === 'done'
      ? Colors.success
      : Colors.primary;

  const planComparison = (() => {
    if (!plan || !result) return null;
    const dlPct = Math.round((result.downloadMbps / plan.downloadMbps) * 100);
    const upPct = Math.round((result.uploadMbps / plan.uploadMbps) * 100);
    return { dlPct, upPct };
  })();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={handleClose}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Speed Test</Text>
            <Text style={styles.headerSubtitle}>Live network performance</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Plan card — always visible, prominent */}
          <View style={styles.planCard}>
            <Text style={styles.planCardLabel}>YOUR SUBSCRIPTION</Text>
            {planLoading ? (
              <Text style={styles.planCardLoading}>
                Looking up your plan…
              </Text>
            ) : plan ? (
              <>
                {plan.label && (
                  <Text style={styles.planCardName} numberOfLines={1}>
                    {plan.label}
                  </Text>
                )}
                <View style={styles.planCardSpeedsRow}>
                  <View style={styles.planCardSpeedBlock}>
                    <Text style={styles.planCardSpeedNum}>
                      {plan.downloadMbps}
                    </Text>
                    <Text style={styles.planCardSpeedUnit}>Mbps</Text>
                    <Text style={styles.planCardSpeedDir}>DOWNLOAD</Text>
                  </View>
                  <View style={styles.planCardDivider} />
                  <View style={styles.planCardSpeedBlock}>
                    <Text style={styles.planCardSpeedNum}>
                      {plan.uploadMbps}
                    </Text>
                    <Text style={styles.planCardSpeedUnit}>Mbps</Text>
                    <Text style={styles.planCardSpeedDir}>UPLOAD</Text>
                  </View>
                </View>
              </>
            ) : (
              <Text style={styles.planCardLoading}>
                Plan info unavailable
              </Text>
            )}
          </View>

          {/* Live chart card */}
          <View style={[styles.chartCard, { borderColor: accent + '40' }]}>
            <View style={styles.chartHeaderRow}>
              <Text style={[styles.chartPhase, { color: accent }]}>
                {isUpload ? 'UPLOAD' : 'DOWNLOAD'}
              </Text>
              <Text style={styles.chartPhaseLabel}>{PHASE_LABEL[phase]}</Text>
            </View>

            <View style={styles.chartNumberRow}>
              <Text
                style={styles.chartNumber}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {headlineMbps.toFixed(headlineMbps >= 100 ? 0 : 1)}
              </Text>
              <View style={styles.chartUnitWrap}>
                <Text style={styles.chartUnit}>Mbps</Text>
                {peakInPhase > 0 && phase !== 'done' && (
                  <Text style={styles.chartPeak}>
                    peak {peakInPhase.toFixed(peakInPhase >= 100 ? 0 : 1)}
                  </Text>
                )}
              </View>
            </View>

            <BarChart
              samples={activeSamples}
              max={chartMax}
              color={accent}
              planMbps={planForPhase}
            />

            <View style={styles.phaseProgressTrack}>
              <View
                style={[
                  styles.phaseProgressFill,
                  {
                    backgroundColor: accent,
                    width: `${phaseProgress * 100}%`,
                  },
                ]}
              />
            </View>

            {(phase === 'download' || phase === 'upload') && bytesNow > 0 && (
              <Text style={styles.bytesText}>
                {formatBytes(bytesNow)} transferred
              </Text>
            )}
          </View>

          {/* Stats grid */}
          <View style={styles.statsGrid}>
            <Stat
              label="Download"
              value={
                result
                  ? formatMbps(result.downloadMbps)
                  : phase === 'download'
                  ? formatMbps(liveMbps)
                  : '—'
              }
              unit="Mbps"
              tint={Colors.primary}
              active={phase === 'download'}
              planMbps={plan?.downloadMbps}
              actualMbps={
                result?.downloadMbps ??
                (phase === 'download' ? liveMbps : null)
              }
            />
            <Stat
              label="Upload"
              value={
                result
                  ? formatMbps(result.uploadMbps)
                  : phase === 'upload'
                  ? formatMbps(liveMbps)
                  : '—'
              }
              unit="Mbps"
              tint="#3B82F6"
              active={phase === 'upload'}
              planMbps={plan?.uploadMbps}
              actualMbps={
                result?.uploadMbps ?? (phase === 'upload' ? liveMbps : null)
              }
            />
            <Stat
              label="Ping"
              value={result ? `${result.latencyMs}` : '—'}
              unit="ms"
              tint={Colors.success}
              active={phase === 'latency'}
            />
            <Stat
              label="Jitter"
              value={result ? result.jitterMs.toFixed(1) : '—'}
              unit="ms"
              tint={Colors.warning}
            />
          </View>

          {/* Verdict */}
          {planComparison && (
            <View
              style={[
                styles.verdictCard,
                {
                  backgroundColor:
                    (planComparison.dlPct >= 90
                      ? Colors.success
                      : planComparison.dlPct >= 70
                      ? Colors.warning
                      : Colors.error) + '12',
                  borderColor:
                    (planComparison.dlPct >= 90
                      ? Colors.success
                      : planComparison.dlPct >= 70
                      ? Colors.warning
                      : Colors.error) + '40',
                },
              ]}
            >
              <Text
                style={[
                  styles.verdictTitle,
                  {
                    color:
                      planComparison.dlPct >= 90
                        ? Colors.success
                        : planComparison.dlPct >= 70
                        ? Colors.warning
                        : Colors.error,
                  },
                ]}
              >
                {planComparison.dlPct >= 100
                  ? 'Excellent connection'
                  : planComparison.dlPct >= 90
                  ? 'Good connection'
                  : planComparison.dlPct >= 70
                  ? 'Below expected'
                  : 'Connection issue'}
              </Text>
              <Text style={styles.verdictText}>
                {planComparison.dlPct >= 100
                  ? `You're getting ${planComparison.dlPct - 100}% extra above your subscribed speed.`
                  : planComparison.dlPct >= 90
                  ? `You're getting ${planComparison.dlPct}% of your subscribed download speed.`
                  : planComparison.dlPct >= 70
                  ? `Only ${planComparison.dlPct}% of your plan.`
                  : `Only ${planComparison.dlPct}% of your plan. Contact CTECG support if this persists.`}
              </Text>
            </View>
          )}

          {phase === 'error' && errorMsg && (
            <View style={styles.errorRow}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.button,
              isRunning ? styles.buttonSecondary : styles.buttonPrimary,
            ]}
            onPress={isRunning ? cancel : start}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.buttonText,
                { color: isRunning ? Colors.primary : Colors.textInverse },
              ]}
            >
              {isRunning
                ? 'Cancel test'
                : result || phase === 'error'
                ? 'Run again'
                : 'Start test'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.footer}>
            For the most accurate result, connect to your CTECG Wi-Fi and pause
            other downloads during the test.
            {result?.server === 'cloudflare'
              ? '\nTested against Cloudflare global edge.'
              : result?.server === 'self'
              ? '\nTested against CTECG server (Cloudflare unreachable).'
              : ''}
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// BarChart — vertical bars, one per sample, with a plan reference line.
// ---------------------------------------------------------------------------
function BarChart({
  samples,
  max,
  color,
  planMbps,
}: {
  samples: Sample[];
  max: number;
  color: string;
  planMbps?: number;
}) {
  const slots = MAX_SAMPLES;
  const gap = 2;
  const barWidth = Math.max(2, (CHART_W - gap * (slots - 1)) / slots);

  const padded: (Sample | null)[] = [
    ...new Array(Math.max(0, slots - samples.length)).fill(null),
    ...samples.slice(-slots),
  ];

  const planY =
    planMbps != null && planMbps > 0 && planMbps <= max
      ? CHART_H * (1 - planMbps / max)
      : null;

  return (
    <View style={[styles.chart, { width: CHART_W, height: CHART_H + 18 }]}>
      <View style={[styles.chartInner, { width: CHART_W, height: CHART_H }]}>
        {planY != null && (
          <>
            <View
              style={[
                styles.planLine,
                { top: planY, width: CHART_W, borderColor: Colors.text },
              ]}
            />
            <View style={[styles.planTagWrap, { top: planY - 9 }]}>
              <Text style={styles.planTag}>
                PLAN {Math.round(planMbps as number)}
              </Text>
            </View>
          </>
        )}

        <View style={styles.barsRow}>
          {padded.map((s, i) => {
            if (!s) {
              return (
                <View
                  key={`b-${i}`}
                  style={{
                    width: barWidth,
                    marginRight: i < slots - 1 ? gap : 0,
                  }}
                />
              );
            }
            const h = Math.max(2, (s.mbps / max) * (CHART_H - 4));
            const isOver = planMbps != null && s.mbps > planMbps;
            return (
              <View
                key={`b-${i}`}
                style={{
                  width: barWidth,
                  height: h,
                  borderRadius: 1.5,
                  backgroundColor: isOver ? Colors.success : color,
                  marginRight: i < slots - 1 ? gap : 0,
                  opacity: i === slots - 1 ? 1 : 0.55 + (i / slots) * 0.45,
                }}
              />
            );
          })}
        </View>

      </View>

      <Text style={styles.axisLabel}>oldest    →    newest</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stat tile — clean, no decorative icon.
// ---------------------------------------------------------------------------
function Stat({
  label,
  value,
  unit,
  tint,
  active = false,
  planMbps,
  actualMbps,
}: {
  label: string;
  value: string;
  unit: string;
  tint: string;
  active?: boolean;
  planMbps?: number;
  actualMbps?: number | null;
}) {
  const pct =
    planMbps && planMbps > 0 && actualMbps != null
      ? Math.round((actualMbps / planMbps) * 100)
      : null;
  const overPlan = pct != null && pct >= 100;
  const pctColor = overPlan
    ? Colors.success
    : pct != null && pct >= 90
    ? tint
    : pct != null && pct >= 70
    ? Colors.warning
    : Colors.error;

  return (
    <View
      style={[
        styles.stat,
        active && {
          borderColor: tint,
          backgroundColor: tint + '08',
        },
      ]}
    >
      <View style={styles.statTopRow}>
        <Text style={[styles.statLabel, { color: tint }]}>{label}</Text>
        {pct != null && (
          <View
            style={[
              styles.statPctBadge,
              { backgroundColor: pctColor + '18' },
            ]}
          >
            <Text style={[styles.statPctText, { color: pctColor }]}>
              {pct}%
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.statValue}>
        {value}
        <Text style={styles.statUnit}> {unit}</Text>
      </Text>
      {planMbps != null && (
        <Text style={styles.statPlanHint}>of {planMbps} Mbps plan</Text>
      )}
    </View>
  );
}

function formatMbps(value: number): string {
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
  },

  // ---- Plan card ----
  planCard: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    shadowColor: Colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  planCardLabel: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  planCardName: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.semibold,
    color: Colors.textInverse,
    marginBottom: Spacing.sm,
  },
  planCardLoading: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: Typography.weights.medium,
    marginTop: 4,
  },
  planCardSpeedsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 4,
  },
  planCardSpeedBlock: {
    alignItems: 'center',
    flex: 1,
  },
  planCardSpeedNum: {
    fontSize: 32,
    fontWeight: Typography.weights.bold,
    color: Colors.textInverse,
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  planCardSpeedUnit: {
    fontSize: 11,
    fontWeight: Typography.weights.semibold,
    color: 'rgba(255,255,255,0.85)',
    marginTop: -2,
  },
  planCardSpeedDir: {
    fontSize: 9,
    fontWeight: Typography.weights.bold,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1.2,
    marginTop: 4,
  },
  planCardDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },

  // ---- Chart card ----
  chartCard: {
    borderRadius: 18,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    marginBottom: Spacing.md,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  chartPhase: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1.5,
  },
  chartPhaseLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: Typography.weights.medium,
  },
  chartNumberRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: Spacing.sm,
  },
  chartNumber: {
    fontSize: 56,
    lineHeight: 60,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
    letterSpacing: -1.5,
  },
  chartUnitWrap: {
    marginLeft: 10,
    paddingBottom: 6,
  },
  chartUnit: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.semibold,
    color: Colors.textSecondary,
  },
  chartPeak: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: Typography.weights.medium,
    marginTop: 2,
  },

  chart: {
    alignSelf: 'center',
    position: 'relative',
  },
  chartInner: {
    position: 'relative',
    backgroundColor: 'transparent',
    borderRadius: 10,
    overflow: 'hidden',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    height: 1,
    backgroundColor: Colors.border,
    opacity: 0.4,
  },
  gridLabel: {
    position: 'absolute',
    left: 6,
    fontSize: 9,
    color: Colors.textMuted,
    fontWeight: Typography.weights.medium,
    backgroundColor: 'transparent',
  },
  planLine: {
    position: 'absolute',
    left: 0,
    height: 0,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    opacity: 0.85,
  },
  planTagWrap: {
    position: 'absolute',
    right: 6,
    backgroundColor: Colors.text,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
  },
  planTag: {
    fontSize: 8,
    fontWeight: Typography.weights.bold,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  barsRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: CHART_H,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  axisLabel: {
    fontSize: 9,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    fontWeight: Typography.weights.medium,
    letterSpacing: 0.3,
  },

  phaseProgressTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: '#EDEDED',
    overflow: 'hidden',
    marginTop: Spacing.sm,
  },
  phaseProgressFill: {
    height: '100%',
    borderRadius: 999,
  },
  bytesText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 6,
    textAlign: 'right',
  },

  // ---- Stats grid ----
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.md,
  },
  stat: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  statPctBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statPctText: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: Typography.lg,
    color: Colors.text,
    fontWeight: Typography.weights.bold,
  },
  statUnit: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontWeight: Typography.weights.regular,
  },
  statPlanHint: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 3,
  },

  // ---- Verdict ----
  verdictCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  verdictTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.weights.bold,
    marginBottom: 4,
  },
  verdictText: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },

  // ---- Error ----
  errorRow: {
    marginBottom: Spacing.sm,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.error + '12',
  },
  errorText: {
    fontSize: Typography.sm,
    color: Colors.error,
  },

  // ---- Button ----
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonPrimary: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  buttonSecondary: {
    backgroundColor: Colors.primary + '15',
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  buttonText: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.semibold,
  },

  footer: {
    textAlign: 'center',
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 16,
    marginTop: Spacing.md,
  },
});
