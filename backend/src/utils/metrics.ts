export interface MetricsSnapshot {
  uptimeSeconds: number;
  activeConnections: number;
  counters: Record<string, number>;
}

const COUNTER_KEYS = [
  'socket_connections_total',
  'socket_connections_rejected_total',
  'socket_events_total',
  'socket_validation_errors_total',
  'rate_limit_rejected_total',
  'rooms_created_total',
  'rooms_terminated_total',
  'locks_acquired_total',
  'locks_acquire_failed_total',
  'locks_renew_failed_total',
  'locks_stale_write_blocked_total',
  'blunders_scheduled_total',
  'blunders_recovered_total',
  'blunders_resolved_timeout_total',
  'blunders_reverted_total',
  'blunders_challenged_total',
] as const;

export type MetricCounterName = (typeof COUNTER_KEYS)[number];

class MetricsRegistry {
  private counters = new Map<MetricCounterName, number>();
  private activeConnections = 0;

  constructor() {
    this.reset();
  }

  inc(name: MetricCounterName, by = 1): void {
    this.counters.set(name, (this.counters.get(name) || 0) + by);
  }

  setActiveConnections(count: number): void {
    this.activeConnections = Math.max(0, count);
  }

  incActiveConnections(): void {
    this.activeConnections += 1;
  }

  decActiveConnections(): void {
    this.activeConnections = Math.max(0, this.activeConnections - 1);
  }

  getActiveConnections(): number {
    return this.activeConnections;
  }

  getCounter(name: MetricCounterName): number {
    return this.counters.get(name) || 0;
  }

  snapshot(): MetricsSnapshot {
    const counters: Record<string, number> = {};
    for (const key of COUNTER_KEYS) {
      counters[key] = this.counters.get(key) || 0;
    }

    return {
      uptimeSeconds: Math.floor(process.uptime()),
      activeConnections: this.activeConnections,
      counters,
    };
  }

  toPrometheusText(): string {
    const snap = this.snapshot();
    const lines: string[] = [
      '# HELP crazy_uptime_seconds Process uptime in seconds',
      '# TYPE crazy_uptime_seconds gauge',
      `crazy_uptime_seconds ${snap.uptimeSeconds}`,
      '# HELP crazy_active_socket_connections Current active Socket.IO connections',
      '# TYPE crazy_active_socket_connections gauge',
      `crazy_active_socket_connections ${snap.activeConnections}`,
    ];

    for (const key of COUNTER_KEYS) {
      lines.push(`# TYPE crazy_${key} counter`);
      lines.push(`crazy_${key} ${snap.counters[key]}`);
    }

    return `${lines.join('\n')}\n`;
  }

  reset(): void {
    this.activeConnections = 0;
    for (const key of COUNTER_KEYS) {
      this.counters.set(key, 0);
    }
  }
}

export const metrics = new MetricsRegistry();
