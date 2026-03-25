import Foundation

enum SolanaOSInstallHandoff {
    private struct BundlePayload: Decodable {
        struct Gateway: Decodable {
            let url: String
            let secret: String?
        }

        let gateway: Gateway
    }

    private static let bundleURL =
        URL(fileURLWithPath: NSHomeDirectory())
        .appendingPathComponent(".nanosolana/connect/solanaos-connect.json")

    @MainActor
    static func applyIfNeeded(userDefaults: UserDefaults = .standard) {
        let currentURL = userDefaults.string(forKey: solanaOSGatewayURLKey)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let currentSecret = userDefaults.string(forKey: solanaOSGatewaySecretKey)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        let urlIsCustom = !currentURL.isEmpty && currentURL != solanaOSDefaultGatewayURL
        let secretIsCustom = !currentSecret.isEmpty
        if urlIsCustom && secretIsCustom {
            return
        }

        guard let data = try? Data(contentsOf: self.bundleURL) else { return }
        guard let payload = try? JSONDecoder().decode(BundlePayload.self, from: data) else { return }

        let gatewayURL = payload.gateway.url.trimmingCharacters(in: .whitespacesAndNewlines)
        let gatewaySecret = payload.gateway.secret?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        if !urlIsCustom && !gatewayURL.isEmpty {
            userDefaults.set(gatewayURL, forKey: solanaOSGatewayURLKey)
        }
        if !secretIsCustom && !gatewaySecret.isEmpty {
            userDefaults.set(gatewaySecret, forKey: solanaOSGatewaySecretKey)
        }
    }
}
