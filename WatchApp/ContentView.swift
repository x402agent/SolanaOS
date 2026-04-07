import SwiftUI

struct ContentView: View {
    @EnvironmentObject var walletState: WalletState

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    BalanceCard(
                        sol: walletState.solBalance,
                        usd: walletState.usdValue
                    )

                    if !walletState.recentTransactions.isEmpty {
                        TransactionList(transactions: walletState.recentTransactions)
                    }

                    if let lastUpdate = walletState.lastUpdate {
                        Text("Updated \(lastUpdate, style: .relative) ago")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.horizontal)
            }
            .navigationTitle("SolanaOS")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: { walletState.requestRefresh() }) {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
        }
    }
}

struct BalanceCard: View {
    let sol: Double
    let usd: Double

    var body: some View {
        VStack(spacing: 4) {
            Text(String(format: "%.4f", sol))
                .font(.title2)
                .fontWeight(.bold)
                .fontDesign(.monospaced)

            Text("SOL")
                .font(.caption)
                .foregroundStyle(.secondary)

            Text(String(format: "$%.2f", usd))
                .font(.caption)
                .foregroundStyle(.green)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }
}

struct TransactionList: View {
    let transactions: [WatchTransaction]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Recent")
                .font(.caption)
                .foregroundStyle(.secondary)

            ForEach(transactions.prefix(5)) { tx in
                HStack {
                    Image(systemName: tx.type == "receive" ? "arrow.down.left" : "arrow.up.right")
                        .foregroundStyle(tx.type == "receive" ? .green : .orange)
                        .font(.caption)

                    Text(String(format: "%.4f SOL", tx.amount))
                        .font(.caption2)
                        .fontDesign(.monospaced)

                    Spacer()

                    Text(tx.timestamp, style: .relative)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(WalletState())
}
