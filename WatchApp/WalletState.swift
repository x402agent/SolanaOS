import Foundation
import WatchConnectivity

final class WalletState: NSObject, ObservableObject {
    @Published var solBalance: Double = 0.0
    @Published var usdValue: Double = 0.0
    @Published var lastUpdate: Date?
    @Published var isConnected: Bool = false
    @Published var recentTransactions: [WatchTransaction] = []

    private var session: WCSession?

    override init() {
        super.init()
        if WCSession.isSupported() {
            session = WCSession.default
            session?.delegate = self
            session?.activate()
        }
    }

    func requestRefresh() {
        guard let session, session.isReachable else { return }
        session.sendMessage(["action": "refresh"], replyHandler: { response in
            DispatchQueue.main.async {
                self.handleUpdate(response)
            }
        }, errorHandler: nil)
    }

    private func handleUpdate(_ data: [String: Any]) {
        if let sol = data["solBalance"] as? Double {
            solBalance = sol
        }
        if let usd = data["usdValue"] as? Double {
            usdValue = usd
        }
        if let txData = data["transactions"] as? [[String: Any]] {
            recentTransactions = txData.compactMap { WatchTransaction(from: $0) }
        }
        lastUpdate = Date()
    }
}

extension WalletState: WCSessionDelegate {
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async {
            self.isConnected = activationState == .activated
        }
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        DispatchQueue.main.async {
            self.handleUpdate(message)
        }
    }
}

struct WatchTransaction: Identifiable {
    let id: String
    let type: String
    let amount: Double
    let timestamp: Date

    init?(from dict: [String: Any]) {
        guard let id = dict["id"] as? String,
              let type = dict["type"] as? String,
              let amount = dict["amount"] as? Double,
              let ts = dict["timestamp"] as? TimeInterval else { return nil }
        self.id = id
        self.type = type
        self.amount = amount
        self.timestamp = Date(timeIntervalSince1970: ts)
    }
}
