var background = (function() {
	//#region node_modules/wxt/dist/utils/define-background.mjs
	function defineBackground(arg) {
		if (arg == null || typeof arg === "function") return { main: arg };
		return arg;
	}
	//#endregion
	//#region src/agent/RemotePageController.background.ts
	/**
	* background logics for RemotePageController
	* - redirect messages from RemotePageController(Agent, extension pages) to ContentScript
	*/
	function handlePageControlMessage(message, sender, sendResponse) {
		const PREFIX = "[RemotePageController.background]";
		function debug(...messages) {
			console.debug(`\x1b[90m${PREFIX}\x1b[0m`, ...messages);
		}
		const { action, payload, targetTabId } = message;
		if (action === "get_my_tab_id") {
			debug("get_my_tab_id", sender.tab?.id);
			sendResponse({ tabId: sender.tab?.id || null });
			return;
		}
		chrome.tabs.sendMessage(targetTabId, {
			type: "PAGE_CONTROL",
			action,
			payload
		}).then((result) => {
			sendResponse(result);
		}).catch((error) => {
			console.error(PREFIX, error);
			sendResponse({
				success: false,
				error: error instanceof Error ? error.message : String(error)
			});
		});
		return true;
	}
	//#endregion
	//#region src/agent/TabsController.background.ts
	var PREFIX = "[TabsController.background]";
	function debug(...messages) {
		console.debug(`\x1b[90m${PREFIX}\x1b[0m`, ...messages);
	}
	function handleTabControlMessage(message, sender, sendResponse) {
		const { action, payload } = message;
		switch (action) {
			case "get_active_tab":
				debug("get_active_tab");
				chrome.tabs.query({
					active: true,
					currentWindow: true
				}).then((tabs) => {
					const tabId = tabs.length > 0 ? tabs[0].id || null : null;
					debug("get_active_tab: success", tabId);
					sendResponse({
						success: true,
						tabId
					});
				}).catch((error) => {
					sendResponse({ error: error instanceof Error ? error.message : String(error) });
				});
				return true;
			case "get_tab_info":
				debug("get_tab_info", payload);
				chrome.tabs.get(payload.tabId).then((tab) => {
					debug("get_tab_info: success", tab);
					sendResponse(tab);
				}).catch((error) => {
					sendResponse({ error: error instanceof Error ? error.message : String(error) });
				});
				return true;
			case "open_new_tab":
				debug("open_new_tab", payload);
				chrome.tabs.create({
					url: payload.url,
					active: false
				}).then((newTab) => {
					debug("open_new_tab: success", newTab);
					sendResponse({
						success: true,
						tabId: newTab.id
					});
				}).catch((error) => {
					sendResponse({ error: error instanceof Error ? error.message : String(error) });
				});
				return true;
			case "create_tab_group":
				debug("create_tab_group", payload);
				chrome.tabs.group({ tabIds: payload.tabIds }).then((groupId) => {
					debug("create_tab_group: success", groupId);
					sendResponse({
						success: true,
						groupId
					});
				}).catch((error) => {
					console.error(PREFIX, "Failed to create tab group", error);
					sendResponse({ error: error instanceof Error ? error.message : String(error) });
				});
				return true;
			case "update_tab_group":
				debug("update_tab_group", payload);
				chrome.tabGroups.update(payload.groupId, payload.properties).then(() => {
					sendResponse({ success: true });
				}).catch((error) => {
					sendResponse({ error: error instanceof Error ? error.message : String(error) });
				});
				return true;
			case "add_tab_to_group":
				debug("add_tab_to_group", payload);
				chrome.tabs.group({
					tabIds: payload.tabId,
					groupId: payload.groupId
				}).then(() => {
					sendResponse({ success: true });
				}).catch((error) => {
					sendResponse({ error: error instanceof Error ? error.message : String(error) });
				});
				return true;
			case "close_tab":
				debug("close_tab", payload);
				chrome.tabs.remove(payload.tabId).then(() => {
					sendResponse({ success: true });
				}).catch((error) => {
					sendResponse({ error: error instanceof Error ? error.message : String(error) });
				});
				return true;
			default:
				sendResponse({ error: `Unknown action: ${action}` });
				return;
		}
	}
	function setupTabChangeEvents() {
		console.log("[TabsController.background] setupTabChangeEvents");
		chrome.tabs.onCreated.addListener((tab) => {
			debug("onCreated", tab);
			chrome.runtime.sendMessage({
				type: "TAB_CHANGE",
				action: "created",
				payload: { tab }
			}).catch((error) => {
				debug("onCreated error:", error);
			});
		});
		chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
			debug("onRemoved", tabId, removeInfo);
			chrome.runtime.sendMessage({
				type: "TAB_CHANGE",
				action: "removed",
				payload: {
					tabId,
					removeInfo
				}
			}).catch((error) => {
				debug("onRemoved error:", error);
			});
		});
		chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
			debug("onUpdated", tabId, changeInfo);
			chrome.runtime.sendMessage({
				type: "TAB_CHANGE",
				action: "updated",
				payload: {
					tabId,
					changeInfo,
					tab
				}
			}).catch((error) => {
				debug("onUpdated error:", error);
			});
		});
	}
	//#endregion
	//#region src/entrypoints/background.ts
	var background_default = defineBackground(() => {
		console.log("[Background] SolanaOS Agent Service Worker started");
		setupTabChangeEvents();
		chrome.storage.local.get("PageAgentExtUserAuthToken").then((result) => {
			if (result.PageAgentExtUserAuthToken) return;
			const userAuthToken = crypto.randomUUID();
			chrome.storage.local.set({ PageAgentExtUserAuthToken: userAuthToken });
		});
		chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
			if (message.type === "TAB_CONTROL") return handleTabControlMessage(message, sender, sendResponse);
			else if (message.type === "PAGE_CONTROL") return handlePageControlMessage(message, sender, sendResponse);
			else if (message.type === "SOLANA_WALLET") {
				handleSolanaWalletMessage(message, sendResponse);
				return true;
			} else {
				sendResponse({ error: "Unknown message type" });
				return;
			}
		});
		chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
			if (message.type === "OPEN_HUB") {
				openOrFocusHubTab(message.wsPort).then(() => {
					if (sender.tab?.id) chrome.tabs.remove(sender.tab.id);
					sendResponse({ ok: true });
				});
				return true;
			}
		});
		chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
	});
	async function handleSolanaWalletMessage(message, sendResponse) {
		const { action, params } = message;
		try {
			const wallet = (await chrome.storage.local.get("solanaWallet")).solanaWallet || {};
			switch (action) {
				case "get_address":
					sendResponse({ address: wallet.publicKey || null });
					break;
				case "get_balance": {
					if (!wallet.publicKey) {
						sendResponse({ error: "No wallet connected" });
						break;
					}
					const rpcUrl = wallet.rpcUrl || "https://api.mainnet-beta.solana.com";
					const lamports = (await (await fetch(rpcUrl, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							jsonrpc: "2.0",
							id: 1,
							method: "getBalance",
							params: [wallet.publicKey]
						})
					})).json()).result?.value ?? 0;
					sendResponse({
						balance: lamports / 1e9,
						lamports
					});
					break;
				}
				case "save_wallet":
					await chrome.storage.local.set({ solanaWallet: params });
					sendResponse({ ok: true });
					break;
				default: sendResponse({ error: `Unknown wallet action: ${action}` });
			}
		} catch (err) {
			sendResponse({ error: err.message || String(err) });
		}
	}
	async function openOrFocusHubTab(wsPort) {
		const hubUrl = chrome.runtime.getURL("hub.html");
		const existing = await chrome.tabs.query({ url: `${hubUrl}*` });
		if (existing.length > 0 && existing[0].id) {
			await chrome.tabs.update(existing[0].id, {
				active: true,
				url: `${hubUrl}?ws=${wsPort}`
			});
			return;
		}
		await chrome.tabs.create({
			url: `${hubUrl}?ws=${wsPort}`,
			pinned: true
		});
	}
	globalThis.browser?.runtime?.id ? globalThis.browser : globalThis.chrome;
	//#endregion
	//#region node_modules/@webext-core/match-patterns/lib/index.js
	var _MatchPattern = class {
		constructor(matchPattern) {
			if (matchPattern === "<all_urls>") {
				this.isAllUrls = true;
				this.protocolMatches = [..._MatchPattern.PROTOCOLS];
				this.hostnameMatch = "*";
				this.pathnameMatch = "*";
			} else {
				const groups = /(.*):\/\/(.*?)(\/.*)/.exec(matchPattern);
				if (groups == null) throw new InvalidMatchPattern(matchPattern, "Incorrect format");
				const [_, protocol, hostname, pathname] = groups;
				validateProtocol(matchPattern, protocol);
				validateHostname(matchPattern, hostname);
				validatePathname(matchPattern, pathname);
				this.protocolMatches = protocol === "*" ? ["http", "https"] : [protocol];
				this.hostnameMatch = hostname;
				this.pathnameMatch = pathname;
			}
		}
		includes(url) {
			if (this.isAllUrls) return true;
			const u = typeof url === "string" ? new URL(url) : url instanceof Location ? new URL(url.href) : url;
			return !!this.protocolMatches.find((protocol) => {
				if (protocol === "http") return this.isHttpMatch(u);
				if (protocol === "https") return this.isHttpsMatch(u);
				if (protocol === "file") return this.isFileMatch(u);
				if (protocol === "ftp") return this.isFtpMatch(u);
				if (protocol === "urn") return this.isUrnMatch(u);
			});
		}
		isHttpMatch(url) {
			return url.protocol === "http:" && this.isHostPathMatch(url);
		}
		isHttpsMatch(url) {
			return url.protocol === "https:" && this.isHostPathMatch(url);
		}
		isHostPathMatch(url) {
			if (!this.hostnameMatch || !this.pathnameMatch) return false;
			const hostnameMatchRegexs = [this.convertPatternToRegex(this.hostnameMatch), this.convertPatternToRegex(this.hostnameMatch.replace(/^\*\./, ""))];
			const pathnameMatchRegex = this.convertPatternToRegex(this.pathnameMatch);
			return !!hostnameMatchRegexs.find((regex) => regex.test(url.hostname)) && pathnameMatchRegex.test(url.pathname);
		}
		isFileMatch(url) {
			throw Error("Not implemented: file:// pattern matching. Open a PR to add support");
		}
		isFtpMatch(url) {
			throw Error("Not implemented: ftp:// pattern matching. Open a PR to add support");
		}
		isUrnMatch(url) {
			throw Error("Not implemented: urn:// pattern matching. Open a PR to add support");
		}
		convertPatternToRegex(pattern) {
			const starsReplaced = this.escapeForRegex(pattern).replace(/\\\*/g, ".*");
			return RegExp(`^${starsReplaced}$`);
		}
		escapeForRegex(string) {
			return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		}
	};
	var MatchPattern = _MatchPattern;
	MatchPattern.PROTOCOLS = [
		"http",
		"https",
		"file",
		"ftp",
		"urn"
	];
	var InvalidMatchPattern = class extends Error {
		constructor(matchPattern, reason) {
			super(`Invalid match pattern "${matchPattern}": ${reason}`);
		}
	};
	function validateProtocol(matchPattern, protocol) {
		if (!MatchPattern.PROTOCOLS.includes(protocol) && protocol !== "*") throw new InvalidMatchPattern(matchPattern, `${protocol} not a valid protocol (${MatchPattern.PROTOCOLS.join(", ")})`);
	}
	function validateHostname(matchPattern, hostname) {
		if (hostname.includes(":")) throw new InvalidMatchPattern(matchPattern, `Hostname cannot include a port`);
		if (hostname.includes("*") && hostname.length > 1 && !hostname.startsWith("*.")) throw new InvalidMatchPattern(matchPattern, `If using a wildcard (*), it must go at the start of the hostname`);
	}
	function validatePathname(matchPattern, pathname) {}
	//#endregion
	//#region \0virtual:wxt-background-entrypoint?/Users/8bit/Downloads/nanosolana-go/chrome-extension/extension/src/entrypoints/background.ts
	function print(method, ...args) {}
	/** Wrapper around `console` with a "[wxt]" prefix */
	var logger = {
		debug: (...args) => print(console.debug, ...args),
		log: (...args) => print(console.log, ...args),
		warn: (...args) => print(console.warn, ...args),
		error: (...args) => print(console.error, ...args)
	};
	var result;
	try {
		result = background_default.main();
		if (result instanceof Promise) console.warn("The background's main() function return a promise, but it must be synchronous");
	} catch (err) {
		logger.error("The background crashed on startup!");
		throw err;
	}
	//#endregion
	return result;
})();
