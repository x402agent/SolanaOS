import AppKit
import Foundation
import SwiftUI

@MainActor
struct SolanaOSGatewaySettings: View {
    @AppStorage(solanaOSGatewayURLKey) private var gatewayURL: String = solanaOSDefaultGatewayURL
    @AppStorage(solanaOSGatewaySecretKey) private var gatewaySecret: String = ""
    @State private var isChecking = false
    @State private var connectionState: SolanaOSConnectionState = .idle
    @State private var snapshot: SolanaOSGatewaySnapshot?
    @State private var lastCheckedAt: Date?

    var body: some View {
        ScrollView(.vertical) {
            VStack(alignment: .leading, spacing: 14) {
                Text("SolanaOS Gateway")
                    .font(.title3.weight(.semibold))

                Text("Connect this macOS app to your SolanaOS agent gateway (`nano-core`) and verify the framework is healthy.")
                    .font(.callout)
                    .foregroundStyle(.secondary)

                LabeledContent("Gateway URL") {
                    TextField("http://127.0.0.1:18790", text: self.$gatewayURL)
                        .textFieldStyle(.roundedBorder)
                        .frame(maxWidth: 420)
                }

                LabeledContent("Gateway secret") {
                    SecureField("optional NANO_GATEWAY_SECRET", text: self.$gatewaySecret)
                        .textFieldStyle(.roundedBorder)
                        .frame(maxWidth: 420)
                }

                HStack(spacing: 10) {
                    Button("Use local default") {
                        self.gatewayURL = nanoSolanaDefaultGatewayURL
                    }
                    .buttonStyle(.bordered)

                    Button {
                        Task { await self.testConnection() }
                    } label: {
                        if self.isChecking {
                            ProgressView().controlSize(.small)
                        } else {
                            Label("Test connection", systemImage: "bolt.horizontal.circle")
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(self.isChecking)

                    if let url = self.normalizedGatewayBaseURL() {
                        Button("Open") {
                            NSWorkspace.shared.open(url)
                        }
                        .buttonStyle(.bordered)
                    }
                }

                self.statusBanner

                if let snapshot {
                    self.snapshotCard(snapshot)
                }

                if let lastCheckedAt {
                    Text("Last checked: \(lastCheckedAt.formatted(date: .omitted, time: .standard))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Text("Expected gateway endpoints: `/health` and `/api/status`.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 22)
            .padding(.vertical, 18)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    @ViewBuilder
    private var statusBanner: some View {
        switch self.connectionState {
        case .idle:
            EmptyView()
        case .checking:
            Label("Checking gateway…", systemImage: "hourglass")
                .font(.callout)
                .foregroundStyle(.secondary)
        case let .connected(message):
            Label(message, systemImage: "checkmark.circle.fill")
                .font(.callout)
                .foregroundStyle(.green)
        case let .failed(message):
            Label(message, systemImage: "xmark.circle.fill")
                .font(.callout)
                .foregroundStyle(.red)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func snapshotCard(_ snapshot: SolanaOSGatewaySnapshot) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Connected agent")
                .font(.headline)

            Text("Endpoint: \(snapshot.endpoint)")
                .font(.caption.monospaced())
                .foregroundStyle(.secondary)

            Text("Agent ID: \(snapshot.agentID)")
                .font(.callout)

            Text("Wallet: \(snapshot.walletPublicKey)")
                .font(.callout)
                .textSelection(.enabled)

            if let balance = snapshot.walletBalance {
                Text("Balance: \(balance.formatted(.number.precision(.fractionLength(4)))) SOL")
                    .font(.callout)
            }

            HStack(spacing: 12) {
                Text("Connected agents: \(snapshot.connectedAgents)")
                if let uptimeSeconds = snapshot.uptimeSeconds {
                    Text("Uptime: \(self.formatUptime(uptimeSeconds))")
                }
            }
            .font(.caption)
            .foregroundStyle(.secondary)

            HStack(spacing: 12) {
                if let signals = snapshot.signalCount {
                    Text("Signals: \(signals)")
                }
                if let executions = snapshot.executionCount {
                    Text("Executions: \(executions)")
                }
                if let memories = snapshot.memoryCount {
                    Text("Memories: \(memories)")
                }
                if let lessons = snapshot.lessonCount {
                    Text("Lessons: \(lessons)")
                }
            }
            .font(.caption)
            .foregroundStyle(.secondary)

            if let frameworkName = snapshot.frameworkName {
                Text("Framework: \(frameworkName)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if !snapshot.frameworkFeatures.isEmpty {
                Text("Features: \(snapshot.frameworkFeatures.joined(separator: ", "))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if snapshot.authRequired {
                Text("Auth: gateway secret required")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                Text("Auth: open access (no gateway secret configured)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .background(Color.gray.opacity(0.08))
        .cornerRadius(10)
    }

    private func testConnection() async {
        guard let baseURL = self.normalizedGatewayBaseURL() else {
            self.connectionState = .failed("Enter a valid HTTP(S) gateway URL.")
            self.snapshot = nil
            return
        }

        self.isChecking = true
        self.connectionState = .checking
        defer {
            self.isChecking = false
            self.lastCheckedAt = Date()
        }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 8
        configuration.timeoutIntervalForResource = 8
        let session = URLSession(configuration: configuration)

        do {
            let healthRequest = self.makeRequest(baseURL: baseURL, path: "/health")
            let (healthData, healthResponse) = try await session.data(for: healthRequest)
            guard let healthHTTP = healthResponse as? HTTPURLResponse else {
                throw SolanaOSProbeError.invalidResponse
            }
            guard healthHTTP.statusCode == 200 else {
                throw SolanaOSProbeError.http(statusCode: healthHTTP.statusCode)
            }

            let statusRequest = self.makeRequest(baseURL: baseURL, path: "/api/status")
            let (statusData, statusResponse) = try await session.data(for: statusRequest)
            guard let statusHTTP = statusResponse as? HTTPURLResponse else {
                throw SolanaOSProbeError.invalidResponse
            }

            if statusHTTP.statusCode == 401 {
                throw SolanaOSProbeError.authRequired
            }
            guard statusHTTP.statusCode == 200 else {
                throw SolanaOSProbeError.http(statusCode: statusHTTP.statusCode)
            }

            let decoder = JSONDecoder()
            let health = try decoder.decode(SolanaOSHealthResponse.self, from: healthData)
            let status = try decoder.decode(SolanaOSStatusResponse.self, from: statusData)

            self.snapshot = SolanaOSGatewaySnapshot(health: health, status: status, endpoint: baseURL.absoluteString)
            self.connectionState = .connected("Gateway connected")
        } catch {
            self.snapshot = nil
            self.connectionState = .failed(self.friendlyMessage(for: error))
        }
    }

    private func makeRequest(baseURL: URL, path: String) -> URLRequest {
        let cleanedPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        var request = URLRequest(url: baseURL.appendingPathComponent(cleanedPath))
        request.timeoutInterval = 8
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let trimmedSecret = self.gatewaySecret.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedSecret.isEmpty {
            request.setValue(trimmedSecret, forHTTPHeaderField: "X-SolanaOS-Secret")
            request.setValue(trimmedSecret, forHTTPHeaderField: "X-NanoSolana-Secret")
            request.setValue("Bearer \(trimmedSecret)", forHTTPHeaderField: "Authorization")
        }

        return request
    }

    private func normalizedGatewayBaseURL() -> URL? {
        let trimmed = self.gatewayURL.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        let candidate = trimmed.contains("://") ? trimmed : "http://\(trimmed)"
        guard let rawURL = URL(string: candidate),
              let scheme = rawURL.scheme?.lowercased(),
              (scheme == "http" || scheme == "https"),
              let host = rawURL.host,
              !host.isEmpty
        else {
            return nil
        }

        guard var components = URLComponents(url: rawURL, resolvingAgainstBaseURL: false) else {
            return nil
        }
        components.query = nil
        components.fragment = nil
        let trimmedPath = components.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        components.path = trimmedPath.isEmpty ? "" : "/\(trimmedPath)"
        return components.url
    }

    private func friendlyMessage(for error: Error) -> String {
        if let probeError = error as? SolanaOSProbeError {
            return probeError.errorDescription
        }
        if let urlError = error as? URLError {
            switch urlError.code {
            case .cannotConnectToHost:
                return "Cannot connect to host. Is `nano run` or `nano gateway` running?"
            case .timedOut:
                return "Connection timed out. Check gateway URL/port and network access."
            case .notConnectedToInternet:
                return "No network connection available."
            default:
                return urlError.localizedDescription
            }
        }
        return error.localizedDescription
    }

    private func formatUptime(_ seconds: Double) -> String {
        let total = max(0, Int(seconds))
        let hours = total / 3600
        let minutes = (total % 3600) / 60
        let secs = total % 60
        if hours > 0 {
            return "\(hours)h \(minutes)m"
        }
        if minutes > 0 {
            return "\(minutes)m \(secs)s"
        }
        return "\(secs)s"
    }
}

private enum SolanaOSConnectionState: Equatable {
    case idle
    case checking
    case connected(String)
    case failed(String)
}

private enum SolanaOSProbeError: LocalizedError {
    case invalidResponse
    case authRequired
    case http(statusCode: Int)

    var errorDescription: String {
        switch self {
        case .invalidResponse:
            return "Gateway returned an invalid response."
        case .authRequired:
            return "Gateway rejected the request. Verify the gateway secret."
        case let .http(statusCode):
            return "Gateway returned HTTP \(statusCode)."
        }
    }
}

private struct SolanaOSHealthResponse: Decodable {
    let status: String?
    let agentId: String?
    let publicKey: String?
    let connectedAgents: Int?
    let authRequired: Bool?
    let uptime: Double?
}

private struct SolanaOSStatusResponse: Decodable {
    struct Wallet: Decodable {
        let publicKey: String?
        let balance: Double?
    }

    struct Memory: Decodable {
        let totalMemories: Int?
        let totalLessons: Int?
    }

    struct Trading: Decodable {
        let signals: Int?
        let executions: Int?
    }

    struct Framework: Decodable {
        let name: String?
        let features: [String]?
    }

    let wallet: Wallet?
    let memory: Memory?
    let trading: Trading?
    let framework: Framework?
}

private struct SolanaOSGatewaySnapshot {
    let endpoint: String
    let agentID: String
    let walletPublicKey: String
    let walletBalance: Double?
    let connectedAgents: Int
    let uptimeSeconds: Double?
    let signalCount: Int?
    let executionCount: Int?
    let memoryCount: Int?
    let lessonCount: Int?
    let frameworkName: String?
    let frameworkFeatures: [String]
    let authRequired: Bool

    init(health: SolanaOSHealthResponse, status: SolanaOSStatusResponse, endpoint: String) {
        self.endpoint = endpoint
        self.agentID = health.agentId ?? "unknown"
        self.walletPublicKey = status.wallet?.publicKey ?? health.publicKey ?? "unknown"
        self.walletBalance = status.wallet?.balance
        self.connectedAgents = health.connectedAgents ?? 0
        self.uptimeSeconds = health.uptime
        self.signalCount = status.trading?.signals
        self.executionCount = status.trading?.executions
        self.memoryCount = status.memory?.totalMemories
        self.lessonCount = status.memory?.totalLessons
        self.frameworkName = status.framework?.name
        self.frameworkFeatures = status.framework?.features ?? []
        self.authRequired = health.authRequired ?? false
    }
}

#if DEBUG
struct SolanaOSGatewaySettings_Previews: PreviewProvider {
    static var previews: some View {
        SolanaOSGatewaySettings()
            .frame(width: SettingsTab.windowWidth, height: SettingsTab.windowHeight)
    }
}
#endif
