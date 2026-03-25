import AppKit
import Foundation

private struct SolanaOSConnectBundle: Decodable {
    struct Gateway: Decodable {
        let url: String
        let secret: String?
    }

    let gateway: Gateway
}

final class SolanaOSMenuBarController: NSObject, NSApplicationDelegate {
    private let port: Int
    private let pidFile: String
    private let launchURL = URL(string: "https://solanaos.net")!
    private let hubURL = URL(string: "https://seeker.solanaos.net")!
    private let soulsURL = URL(string: "https://souls.solanaos.net")!
    private let dashboardURL = URL(string: "https://seeker.solanaos.net/dashboard")!
    private let strategyURL = URL(string: "https://seeker.solanaos.net/strategy")!
    private let miningURL = URL(string: "https://seeker.solanaos.net/mining")!
    private let skillsURL = URL(string: "https://seeker.solanaos.net/skills")!
    private let agentsURL = URL(string: "https://seeker.solanaos.net/agents")!
    private let createSkillURL = URL(string: "https://seeker.solanaos.net/create")!
    private let setupGatewayURL = URL(string: "https://seeker.solanaos.net/setup/gateway")!
    private let setupTelegramURL = URL(string: "https://seeker.solanaos.net/setup/telegram")!
    private let setupMetaplexURL = URL(string: "https://seeker.solanaos.net/setup/metaplex")!
    private let setupMiningURL = URL(string: "https://seeker.solanaos.net/setup/mining")!
    private let setupExtensionURL = URL(string: "https://seeker.solanaos.net/setup/extension")!
    private let githubURL = URL(string: "https://github.com/x402agent/Solana-Os-Go")!
    private let setupCodePath = NSHomeDirectory() + "/.nanosolana/connect/setup-code.txt"
    private let connectBundlePath = NSHomeDirectory() + "/.nanosolana/connect/solanaos-connect.json"

    private var statusItem: NSStatusItem!
    private var statusMenuItem: NSMenuItem!
    private var detailMenuItem: NSMenuItem!
    private var timer: Timer?

    init(port: Int, pidFile: String) {
        self.port = port
        self.pidFile = pidFile
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)

        self.statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = self.statusItem.button {
          button.title = "◎"
          button.toolTip = "SolanaOS"
        }

        let menu = NSMenu()

        let header = NSMenuItem(title: "SolanaOS", action: nil, keyEquivalent: "")
        header.isEnabled = false
        menu.addItem(header)

        self.statusMenuItem = NSMenuItem(title: "Status: checking…", action: nil, keyEquivalent: "")
        self.statusMenuItem.isEnabled = false
        menu.addItem(self.statusMenuItem)

        self.detailMenuItem = NSMenuItem(title: "Gateway: waiting for /api/status", action: nil, keyEquivalent: "")
        self.detailMenuItem.isEnabled = false
        menu.addItem(self.detailMenuItem)

        menu.addItem(.separator())

        menu.addItem(withTitle: "Open Local Control", action: #selector(openLocalControl), keyEquivalent: "o").target = self
        menu.addItem(withTitle: "Open Local Wallet", action: #selector(openLocalWallet), keyEquivalent: "w").target = self
        menu.addItem(withTitle: "Open Local Chat", action: #selector(openLocalChat), keyEquivalent: "c").target = self

        menu.addItem(.separator())

        // Hub surfaces
        let hubSubmenu = NSMenu()
        hubSubmenu.addItem(withTitle: "Dashboard", action: #selector(openDashboard), keyEquivalent: "d").target = self
        hubSubmenu.addItem(withTitle: "Mining Fleet", action: #selector(openMining), keyEquivalent: "").target = self
        hubSubmenu.addItem(withTitle: "Strategy Builder", action: #selector(openStrategy), keyEquivalent: "s").target = self
        hubSubmenu.addItem(withTitle: "Skills Registry", action: #selector(openSkills), keyEquivalent: "").target = self
        hubSubmenu.addItem(withTitle: "Agent Directory", action: #selector(openAgents), keyEquivalent: "").target = self
        hubSubmenu.addItem(withTitle: "Create Skill", action: #selector(openCreateSkill), keyEquivalent: "").target = self
        hubSubmenu.addItem(withTitle: "Souls Library", action: #selector(openSouls), keyEquivalent: "").target = self
        let hubItem = NSMenuItem(title: "SolanaOS Hub", action: nil, keyEquivalent: "h")
        hubItem.submenu = hubSubmenu
        menu.addItem(hubItem)

        // Setup guides
        let setupSubmenu = NSMenu()
        setupSubmenu.addItem(withTitle: "Gateway", action: #selector(openSetupGateway), keyEquivalent: "").target = self
        setupSubmenu.addItem(withTitle: "Telegram Bot", action: #selector(openSetupTelegram), keyEquivalent: "").target = self
        setupSubmenu.addItem(withTitle: "Metaplex Agent", action: #selector(openSetupMetaplex), keyEquivalent: "").target = self
        setupSubmenu.addItem(withTitle: "BitAxe Mining", action: #selector(openSetupMining), keyEquivalent: "").target = self
        setupSubmenu.addItem(withTitle: "Chrome Extension", action: #selector(openSetupExtension), keyEquivalent: "").target = self
        let setupItem = NSMenuItem(title: "Setup Guides", action: nil, keyEquivalent: "")
        setupItem.submenu = setupSubmenu
        menu.addItem(setupItem)

        menu.addItem(.separator())

        menu.addItem(withTitle: "Reveal Setup Code", action: #selector(revealSetupCode), keyEquivalent: "").target = self
        menu.addItem(withTitle: "Copy Setup Code", action: #selector(copySetupCode), keyEquivalent: "").target = self
        menu.addItem(withTitle: "Reveal Connect Bundle", action: #selector(revealConnectBundle), keyEquivalent: "").target = self

        menu.addItem(.separator())

        menu.addItem(withTitle: "Open GitHub", action: #selector(openGitHub), keyEquivalent: "g").target = self
        menu.addItem(withTitle: "Open Terminal", action: #selector(openTerminal), keyEquivalent: "t").target = self
        menu.addItem(withTitle: "Quit SolanaOS", action: #selector(quitApp), keyEquivalent: "q").target = self

        self.statusItem.menu = menu
        self.refreshStatus()
        self.timer = Timer.scheduledTimer(withTimeInterval: 15, repeats: true) { [weak self] _ in
            self?.refreshStatus()
        }
    }

    @objc private func openLocalControl() {
        self.openLocalURL(path: "")
    }

    @objc private func openLocalWallet() {
        self.openLocalURL(path: "#wallet")
    }

    @objc private func openLocalChat() {
        self.openLocalURL(path: "#chat")
    }

    @objc private func openHub() { NSWorkspace.shared.open(self.hubURL) }
    @objc private func openDashboard() { NSWorkspace.shared.open(self.dashboardURL) }
    @objc private func openStrategy() { NSWorkspace.shared.open(self.strategyURL) }
    @objc private func openSouls() { NSWorkspace.shared.open(self.soulsURL) }
    @objc private func openMining() { NSWorkspace.shared.open(self.miningURL) }
    @objc private func openSkills() { NSWorkspace.shared.open(self.skillsURL) }
    @objc private func openAgents() { NSWorkspace.shared.open(self.agentsURL) }
    @objc private func openCreateSkill() { NSWorkspace.shared.open(self.createSkillURL) }
    @objc private func openGitHub() { NSWorkspace.shared.open(self.githubURL) }

    // Setup guides
    @objc private func openSetupGateway() { NSWorkspace.shared.open(self.setupGatewayURL) }
    @objc private func openSetupTelegram() { NSWorkspace.shared.open(self.setupTelegramURL) }
    @objc private func openSetupMetaplex() { NSWorkspace.shared.open(self.setupMetaplexURL) }
    @objc private func openSetupMining() { NSWorkspace.shared.open(self.setupMiningURL) }
    @objc private func openSetupExtension() { NSWorkspace.shared.open(self.setupExtensionURL) }

    @objc private func revealSetupCode() {
        self.revealFile(at: self.setupCodePath)
    }

    @objc private func revealConnectBundle() {
        self.revealFile(at: self.connectBundlePath)
    }

    @objc private func copySetupCode() {
        guard let code = try? String(contentsOfFile: self.setupCodePath).trimmingCharacters(in: .whitespacesAndNewlines),
              !code.isEmpty else {
            return
        }

        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(code, forType: .string)
    }

    @objc private func openTerminal() {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/open")
        process.arguments = ["-a", "Terminal"]
        try? process.run()
    }

    @objc private func quitApp() {
        self.stopManagedNanoBotIfNeeded()
        NSApp.terminate(nil)
    }

    private func revealFile(at path: String) {
        guard FileManager.default.fileExists(atPath: path) else { return }
        NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: path)])
    }

    private func openLocalURL(path: String) {
        guard let url = URL(string: "http://127.0.0.1:\(self.port)/\(path)") else { return }
        NSWorkspace.shared.open(url)
    }

    private func refreshStatus() {
        let status = self.fetchStatus()
        let connectBundle = self.loadConnectBundle()

        DispatchQueue.main.async {
            let daemon = (status["daemon"] as? String) ?? "offline"
            let mode = (status["oodaMode"] as? String) ?? "unknown"
            let watchlist = (status["watchlistCount"] as? Int) ?? 0
            let honcho = (status["honchoEnabled"] as? Bool) == true ? "on" : "off"
            let gatewayLine = connectBundle?.gateway.url ?? "not paired"

            self.statusMenuItem.title = "Status: \(daemon) · \(mode) · watchlist \(watchlist) · honcho \(honcho)"
            self.detailMenuItem.title = "Gateway: \(gatewayLine)"

            switch daemon {
            case "alive", "running":
                self.statusItem.button?.title = "◎"
            case "starting":
                self.statusItem.button?.title = "◌"
            default:
                self.statusItem.button?.title = "⚠︎"
            }
        }
    }

    private func fetchStatus() -> [String: Any] {
        guard let url = URL(string: "http://127.0.0.1:\(self.port)/api/status"),
              let data = try? Data(contentsOf: url),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return [:]
        }
        return json
    }

    private func loadConnectBundle() -> SolanaOSConnectBundle? {
        guard let data = try? Data(contentsOf: URL(fileURLWithPath: self.connectBundlePath)) else {
            return nil
        }

        return try? JSONDecoder().decode(SolanaOSConnectBundle.self, from: data)
    }

    private func stopManagedNanoBotIfNeeded() {
        guard let pid = try? String(contentsOfFile: self.pidFile).trimmingCharacters(in: .whitespacesAndNewlines),
              !pid.isEmpty else {
            return
        }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/kill")
        process.arguments = [pid]
        try? process.run()
        try? FileManager.default.removeItem(atPath: self.pidFile)
    }
}

@main
struct SolanaOSMenuBarApp {
    static func main() {
        let port = Int(ProcessInfo.processInfo.environment["NANOBOT_PORT"] ?? "7777") ?? 7777
        let pidFile = ProcessInfo.processInfo.environment["NANOBOT_PIDFILE"] ?? "/tmp/nanobot-server.pid"

        let app = NSApplication.shared
        let delegate = SolanaOSMenuBarController(port: port, pidFile: pidFile)
        app.delegate = delegate
        app.run()
    }
}
