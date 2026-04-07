import SwiftUI
import WidgetKit

struct SolBalanceComplication: Widget {
    let kind = "SolBalance"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: SolBalanceProvider()) { entry in
            SolBalanceEntryView(entry: entry)
        }
        .configurationDisplayName("SOL Balance")
        .description("Shows your current SOL balance.")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryInline,
            .accessoryRectangular,
            .accessoryCorner,
        ])
    }
}

struct SolBalanceEntry: TimelineEntry {
    let date: Date
    let balance: Double
}

struct SolBalanceProvider: TimelineProvider {
    func placeholder(in context: Context) -> SolBalanceEntry {
        SolBalanceEntry(date: .now, balance: 0.0)
    }

    func getSnapshot(in context: Context, completion: @escaping (SolBalanceEntry) -> Void) {
        completion(SolBalanceEntry(date: .now, balance: 0.0))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SolBalanceEntry>) -> Void) {
        let entry = SolBalanceEntry(date: .now, balance: 0.0)
        let timeline = Timeline(entries: [entry], policy: .after(.now.addingTimeInterval(900)))
        completion(timeline)
    }
}

struct SolBalanceEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: SolBalanceEntry

    var body: some View {
        switch family {
        case .accessoryInline:
            Text("◎ \(String(format: "%.2f", entry.balance)) SOL")
        case .accessoryCircular:
            VStack(spacing: 1) {
                Image(systemName: "bitcoinsign.circle")
                    .font(.title3)
                Text(String(format: "%.2f", entry.balance))
                    .font(.caption2)
                    .fontDesign(.monospaced)
            }
        case .accessoryRectangular:
            VStack(alignment: .leading) {
                Text("SolanaOS")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text(String(format: "%.4f SOL", entry.balance))
                    .font(.headline)
                    .fontDesign(.monospaced)
            }
        default:
            Text(String(format: "%.2f", entry.balance))
        }
    }
}
