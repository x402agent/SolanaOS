export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
  label?: string;
}
export interface SessionUsageTimeSeries {
  points: TimeSeriesPoint[];
  resolution: number;
  startMs: number;
  endMs: number;
  metric?: "tokens" | "cost" | "messages" | "latency";
}
