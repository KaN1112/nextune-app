export class RingBuffer {
  constructor(capacity = 60) {
    this.capacity = capacity;
    this.values = [];
  }
  push(value) {
    this.values.push(value);
    if (this.values.length > this.capacity) this.values.shift();
  }
  pushTimed(value, timestamp = Date.now()) {
    if (this.lastTimestamp != null) {
      const gap = Math.min(
        this.capacity,
        Math.max(0, Math.round((timestamp - this.lastTimestamp) / 1000) - 1),
      );
      for (let i = 0; i < gap; i++) this.push(null);
    }
    this.lastTimestamp = timestamp;
    this.push(value);
  }
}
export const defaults = {
  welcomeComplete: false,
  theme: "dark",
  closeBackgroundApps: false,
  cleanTemporaryFiles: false,
  changePowerPlan: true,
  enableGameMode: true,
  exclusions: ["Discord.exe", "obs64.exe", "Spotify.exe"],
};
export const state = {
  settings: { ...defaults },
  info: null,
  snapshot: null,
  network: null,
  ping: null,
  optimization: null,
  cleaner: null,
  history: [],
  samples: new RingBuffer(),
  lastSample: null,
  errors: {},
};
// Missing evidence is not awarded points and is not treated as a failure. The score
// stays unavailable until all six categories have measurements, rather than inflating it.
export function gamingScore({
  cpu,
  ramPercent,
  diskFreePercent,
  ping,
  gameMode,
  backgroundCount,
}) {
  const points = [
    {
      name: "CPU負荷",
      max: 20,
      value:
        cpu == null ? null : cpu < 30 ? 20 : cpu < 60 ? 12 : cpu < 85 ? 6 : 0,
    },
    {
      name: "メモリの余裕",
      max: 20,
      value:
        ramPercent == null
          ? null
          : ramPercent < 65
            ? 20
            : ramPercent < 80
              ? 12
              : ramPercent < 90
                ? 6
                : 0,
    },
    {
      name: "ストレージ空き容量",
      max: 15,
      value:
        diskFreePercent == null
          ? null
          : diskFreePercent >= 20
            ? 15
            : diskFreePercent >= 10
              ? 8
              : 0,
    },
    {
      name: "ネットワークテスト",
      max: 20,
      value:
        ping?.average == null
          ? null
          : ping.packetLoss > 5
            ? 0
            : ping.average < 40 && ping.packetLoss === 0
              ? 20
              : ping.average < 80
                ? 12
                : 5,
    },
    {
      name: "Windowsゲームモード",
      max: 15,
      value: gameMode == null ? null : gameMode ? 15 : 0,
    },
    {
      name: "バックグラウンドアプリ候補",
      max: 10,
      value:
        backgroundCount == null
          ? null
          : backgroundCount === 0
            ? 10
            : backgroundCount <= 2
              ? 7
              : 3,
    },
  ];
  const known = points.filter((p) => p.value != null);
  const score =
    known.length === points.length
      ? known.reduce((sum, p) => sum + p.value, 0)
      : null;
  return {
    score,
    points,
    coverage: known.length,
    label:
      score == null
        ? "未確定"
        : score >= 90
          ? "非常に良好"
          : score >= 75
            ? "良好"
            : score >= 60
              ? "標準"
              : "確認が必要",
  };
}
export function currentScore() {
  const s = state.snapshot,
    info = state.info;
  const freshPing =
    state.ping && Date.now() - Date.parse(state.ping.measuredAt) < 300000
      ? state.ping
      : null;
  return gamingScore({
    cpu: s?.cpu,
    ramPercent: s?.ramTotal ? (s.ramUsed / s.ramTotal) * 100 : null,
    diskFreePercent: info?.diskTotal
      ? (info.diskAvailable / info.diskTotal) * 100
      : null,
    ping: freshPing,
    gameMode: state.optimization?.gameMode,
    backgroundCount: state.optimization?.processes?.length,
  });
}
