import { D as require_react, E as require_client, O as __toESM, T as createLucideIcon, _ as require_jsx_runtime, a as StatusDot, c as EventCard, i as MotionOverlay, l as useAgent, m as Button, p as ErrorBoundary, r as Logo, s as ActivityCard, t as Switch, v as UnfoldVertical, x as FoldVertical, y as Square } from "./assets-RBZS4ghb.js";
var PlugZap = createLucideIcon("plug-zap", [
	["path", {
		d: "M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z",
		key: "goz73y"
	}],
	["path", {
		d: "m2 22 3-3",
		key: "19mgm9"
	}],
	["path", {
		d: "M7.5 13.5 10 11",
		key: "7xgeeb"
	}],
	["path", {
		d: "M10.5 16.5 13 14",
		key: "10btkg"
	}],
	["path", {
		d: "m18 3-4 4h6l-4 4",
		key: "16psg9"
	}]
]);
var Plug = createLucideIcon("plug", [
	["path", {
		d: "M12 22v-5",
		key: "1ega77"
	}],
	["path", {
		d: "M15 8V2",
		key: "18g5xt"
	}],
	["path", {
		d: "M17 8a1 1 0 0 1 1 1v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1z",
		key: "1xoxul"
	}],
	["path", {
		d: "M9 8V2",
		key: "14iosj"
	}]
]);
var Unplug = createLucideIcon("unplug", [
	["path", {
		d: "m19 5 3-3",
		key: "yk6iyv"
	}],
	["path", {
		d: "m2 22 3-3",
		key: "19mgm9"
	}],
	["path", {
		d: "M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z",
		key: "goz73y"
	}],
	["path", {
		d: "M7.5 13.5 10 11",
		key: "7xgeeb"
	}],
	["path", {
		d: "M10.5 16.5 13 14",
		key: "10btkg"
	}],
	["path", {
		d: "m12 6 6 6 2.3-2.3a2.4 2.4 0 0 0 0-3.4l-2.6-2.6a2.4 2.4 0 0 0-3.4 0Z",
		key: "1snsnr"
	}]
]);
//#endregion
//#region src/entrypoints/hub/hub-ws.ts
var import_client = /* @__PURE__ */ __toESM(require_client(), 1);
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
/**
* Framework-agnostic WebSocket client for Hub.
* Connects to an external WS server, receives tasks, dispatches to handlers,
* and sends results back. No React, no DOM.
*/
var HubWs = class {
	#ws = null;
	#state = "disconnected";
	#busy = false;
	#approved = false;
	#handlers;
	#port;
	#onStateChange;
	constructor(port, handlers, onStateChange) {
		this.#port = port;
		this.#handlers = handlers;
		this.#onStateChange = onStateChange;
	}
	get state() {
		return this.#state;
	}
	get busy() {
		return this.#busy;
	}
	connect() {
		if (this.#ws) return;
		this.#setState("connecting");
		const ws = new WebSocket(`ws://localhost:${this.#port}`);
		this.#ws = ws;
		ws.addEventListener("open", () => {
			this.#setState("connected");
			this.#send({ type: "ready" });
		});
		ws.addEventListener("close", () => {
			this.#ws = null;
			this.#busy = false;
			this.#approved = false;
			this.#setState("disconnected");
		});
		ws.addEventListener("message", (event) => {
			this.#handleMessage(event.data);
		});
	}
	disconnect() {
		this.#ws?.close();
		this.#ws = null;
		this.#busy = false;
		this.#approved = false;
		this.#setState("disconnected");
	}
	#setState(state) {
		if (this.#state === state) return;
		this.#state = state;
		this.#onStateChange(state);
	}
	#send(msg) {
		if (this.#ws?.readyState === WebSocket.OPEN) this.#ws.send(JSON.stringify(msg));
	}
	async #handleMessage(raw) {
		let msg;
		try {
			msg = JSON.parse(raw);
		} catch {
			return;
		}
		if (!await this.#checkApproval()) {
			this.#send({
				type: "error",
				message: "User denied the connection request."
			});
			return;
		}
		switch (msg.type) {
			case "execute":
				this.#handleExecute(msg);
				break;
			case "stop":
				this.#handlers.onStop();
				break;
		}
	}
	async #checkApproval() {
		if (this.#approved) return true;
		const { allowAllHubConnection } = await chrome.storage.local.get("allowAllHubConnection");
		if (allowAllHubConnection === true) {
			this.#approved = true;
			return true;
		}
		const ok = window.confirm("An external application is requesting to control your browser via Page Agent Ext.\nAllow this session?");
		if (ok) this.#approved = true;
		return ok;
	}
	async #handleExecute(msg) {
		if (this.#busy) {
			this.#send({
				type: "error",
				message: "Hub is busy with another task"
			});
			return;
		}
		this.#busy = true;
		try {
			const result = await this.#handlers.onExecute(msg.task, msg.config);
			this.#send({
				type: "result",
				success: result.success,
				data: result.data
			});
		} catch (err) {
			this.#send({
				type: "error",
				message: err instanceof Error ? err.message : String(err)
			});
		} finally {
			this.#busy = false;
		}
	}
};
/**
* React hook that bridges HubWs to the agent's execute/stop/configure.
* Handles the config-before-execute dance internally.
*/
function useHubWs(execute, stop, configure, config) {
	const wsPort = new URLSearchParams(location.search).get("ws");
	const [wsState, setWsState] = (0, import_react.useState)(() => wsPort ? "connecting" : "disconnected");
	const hubWsRef = (0, import_react.useRef)(null);
	const latest = (0, import_react.useRef)({
		execute,
		stop,
		configure,
		config
	});
	(0, import_react.useEffect)(() => {
		latest.current = {
			execute,
			stop,
			configure,
			config
		};
	});
	(0, import_react.useEffect)(() => {
		if (!wsPort) return;
		const hubWs = new HubWs(Number(wsPort), {
			onExecute: async (task, incomingConfig) => {
				const { execute, configure, config } = latest.current;
				if (incomingConfig) await configure({
					...config,
					...incomingConfig
				});
				const result = await execute(task);
				return {
					success: result.success,
					data: result.data
				};
			},
			onStop: () => latest.current.stop()
		}, setWsState);
		hubWs.connect();
		hubWsRef.current = hubWs;
		return () => {
			hubWs.disconnect();
			hubWsRef.current = null;
		};
	}, [wsPort]);
	return { wsState };
}
//#endregion
//#region src/entrypoints/hub/App.tsx
var import_jsx_runtime = require_jsx_runtime();
function App() {
	const { status, history, activity, currentTask, config, execute, stop, configure } = useAgent();
	const { wsState } = useHubWs(execute, stop, configure, config);
	const historyRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
	}, [history, activity]);
	const isRunning = status === "running";
	const WsIcon = wsState === "connected" ? PlugZap : wsState === "connecting" ? Plug : Unplug;
	const wsLabel = {
		connected: "Connected",
		connecting: "Connecting…",
		disconnected: new URLSearchParams(location.search).get("ws") ? "Disconnected" : "No connection"
	}[wsState];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-screen bg-background",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
			className: "w-80 shrink-0 border-r flex flex-col bg-muted/20",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
					href: "https://alibaba.github.io/page-agent/",
					target: "_blank",
					rel: "noopener noreferrer",
					className: "flex items-center gap-2 px-5 h-12 border-b hover:bg-muted/30 transition-colors",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Logo, { className: "size-5" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-sm font-semibold tracking-tight",
							children: "Page Agent Hub"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[9px] font-medium uppercase tracking-wider text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5",
							children: "Beta"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1 overflow-y-auto px-5 py-4 space-y-6",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-xs text-muted-foreground leading-relaxed space-y-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Page Agent Hub lets local apps (e.g. MCP servers) control the Page Agent extension via WebSocket." }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
								"Check out the official",
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									href: "https://github.com/alibaba/page-agent/tree/main/packages/mcp",
									target: "_blank",
									rel: "noopener noreferrer",
									className: "underline hover:text-foreground",
									children: "MCP server package"
								}),
								"."
							] })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HubConfig, {}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProtocolDocsCollapsible, {})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "border-t px-5 py-3 text-[10px] text-muted-foreground/60 flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "font-mono",
						children: ["v", "1.6.2"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						"Built with ♥️ by",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
							href: "https://github.com/gaomeng1900",
							target: "_blank",
							rel: "noopener noreferrer",
							className: "underline hover:text-foreground",
							children: "@Simon"
						})
					] })]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
			className: "flex-1 flex flex-col min-w-0 relative",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MotionOverlay, { active: isRunning }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "flex items-center justify-between border-b px-5 h-12",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 text-xs text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WsIcon, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: wsLabel })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusDot, { status }), isRunning && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "destructive",
							size: "sm",
							onClick: stop,
							className: "h-7 text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Square, { className: "size-3 mr-1" }), "Stop"]
						})]
					})]
				}),
				currentTask && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "border-b px-5 py-2 bg-muted/30",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[10px] text-muted-foreground uppercase tracking-wide",
						children: "Current Task"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-sm font-medium truncate",
						title: currentTask,
						children: currentTask
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					ref: historyRef,
					className: "flex-1 overflow-y-auto p-5 space-y-2",
					children: [
						!currentTask && history.length === 0 && !isRunning && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col items-center justify-center h-full text-muted-foreground gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WsIcon, { className: "size-10 opacity-30" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm",
								children: wsState === "connected" ? "Waiting for task from external caller…" : "No active session"
							})]
						}),
						history.map((event, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EventCard, { event }, index)),
						activity && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActivityCard, { activity })
					]
				})
			]
		})]
	});
}
function HubConfig() {
	const [allowAll, setAllowAll] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		chrome.storage.local.get("allowAllHubConnection").then((r) => {
			setAllowAll(r.allowAllHubConnection === true);
		});
	}, []);
	const toggle = (checked) => {
		setAllowAll(checked);
		chrome.storage.local.set({ allowAllHubConnection: checked });
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
		className: "text-[11px] font-semibold text-foreground/80 uppercase tracking-wider mb-2",
		children: "Config"
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "group/hub relative",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
			className: `flex items-center justify-between p-3 rounded-md border cursor-pointer text-xs ${allowAll ? "bg-amber-500/10 border-amber-500/30 text-amber-600" : "bg-muted/50 text-muted-foreground"}`,
			children: ["Auto-approve connections", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
				checked: allowAll,
				onCheckedChange: toggle,
				className: allowAll ? "data-[state=checked]:bg-amber-500" : ""
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "group-hover/hub:visible group-hover/hub:opacity-100 transition-opacity duration-150  left-0 right-0 top-full z-10 pt-2",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative p-2.5 rounded-md border border-border bg-background/60 backdrop-blur-md shadow-2xl text-muted-foreground text-xs leading-relaxed",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute -top-1.5 left-5 size-3 rotate-45 rounded-[1px] border-l border-t border-border bg-background/60 backdrop-blur-md" }),
					"By default, each connection requires your approval before running tasks. ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
					"Enable this to skip per-session approval.",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-semibold",
						children: "* Use with caution!"
					})
				]
			})
		})]
	})] });
}
function ProtocolDocsCollapsible() {
	const [open, setOpen] = (0, import_react.useState)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick: () => setOpen(!open),
		className: "flex items-center gap-1 text-[11px] font-semibold text-foreground/80 uppercase tracking-wider cursor-pointer",
		children: ["Docs", open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FoldVertical, { className: "size-3" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UnfoldVertical, { className: "size-3" })]
	}), open && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-3 space-y-4 text-xs text-muted-foreground",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-[10px]",
				children: ["Connect via ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
					className: "text-[10px]",
					children: "hub.html?ws=PORT"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
				className: "text-[11px] font-medium text-foreground/60 mb-1.5",
				children: "Flow"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
				className: "list-decimal list-inside space-y-1 text-[11px] leading-relaxed",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Hub opens WS to caller's server" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: ["Sends ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
						className: "text-[10px]",
						children: "ready"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
						"Caller sends ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
							className: "text-[10px]",
							children: "execute"
						}),
						" with task"
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Hub runs agent, streams events" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
						"Hub sends ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
							className: "text-[10px]",
							children: "result"
						}),
						" or",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
							className: "text-[10px]",
							children: "error"
						})
					] })
				]
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
				className: "text-[11px] font-medium text-foreground/60 mb-1.5",
				children: "Caller → Hub"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
				className: "bg-muted/50 rounded-md p-3 font-mono text-[10px] leading-relaxed whitespace-pre-wrap",
				children: `{ type: "execute", task: string, config?: object }
{ type: "stop" }`
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
				className: "text-[11px] font-medium text-foreground/60 mb-1.5",
				children: "Hub → Caller"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
				className: "bg-muted/50 rounded-md p-3 font-mono text-[10px] leading-relaxed whitespace-pre-wrap",
				children: `{ type: "ready" }
{ type: "result", success: boolean, data: string }
{ type: "error", message: string }`
			})] })
		]
	})] });
}
//#endregion
//#region src/entrypoints/hub/main.tsx
var syncDarkMode = () => {
	document.documentElement.classList.toggle("dark", matchMedia("(prefers-color-scheme: dark)").matches);
};
syncDarkMode();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncDarkMode);
import_client.createRoot(document.getElementById("root")).render(/* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.StrictMode, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ErrorBoundary, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(App, {}) }) }));
//#endregion
