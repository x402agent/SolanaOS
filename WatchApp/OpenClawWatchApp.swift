import SwiftUI

@main
struct OpenClawWatchApp: App {
    @StateObject private var walletState = WalletState()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(walletState)
        }
    }
}
