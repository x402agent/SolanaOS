var mainWorld = (function() {
	//#region node_modules/wxt/dist/utils/define-unlisted-script.mjs
	function defineUnlistedScript(arg) {
		if (arg == null || typeof arg === "function") return { main: arg };
		return arg;
	}
	//#endregion
	//#region src/entrypoints/main-world.ts
	var main_world_default = defineUnlistedScript(() => {
		let _lastId = 0;
		function getId() {
			_lastId += 1;
			return _lastId;
		}
		const execute = async (task, config) => {
			if (typeof task !== "string") throw new Error("Task must be a string");
			if (task.trim().length === 0) throw new Error("Task cannot be empty");
			if (!config) throw new Error("Config is required");
			if (!config.baseURL) throw new Error("Config must have a baseURL");
			if (!config.model) throw new Error("Config must have a model");
			const id = getId();
			const promise = new Promise((resolve, reject) => {
				function handleMessage(e) {
					const data = e.data;
					if (typeof data !== "object" || data === null) return;
					if (data.channel !== "PAGE_AGENT_EXT_RESPONSE") return;
					if (data.id !== id) return;
					if (data.action === "status_change_event" && config.onStatusChange) {
						config.onStatusChange(data.payload);
						return;
					}
					if (data.action === "activity_event" && config.onActivity) {
						config.onActivity(data.payload);
						return;
					}
					if (data.action === "history_change_event" && config.onHistoryUpdate) {
						config.onHistoryUpdate(data.payload);
						return;
					}
					if (data.action !== "execute_result") return;
					window.removeEventListener("message", handleMessage);
					if (data.error) reject(new Error(data.error));
					else resolve(data.payload);
				}
				window.addEventListener("message", handleMessage);
			});
			window.postMessage({
				channel: "PAGE_AGENT_EXT_REQUEST",
				id,
				action: "execute",
				payload: {
					task,
					config: {
						baseURL: config.baseURL,
						model: config.model,
						apiKey: config.apiKey,
						includeInitialTab: config.includeInitialTab
					}
				}
			}, "*");
			return promise;
		};
		const stop = () => {
			const id = getId();
			window.postMessage({
				channel: "PAGE_AGENT_EXT_REQUEST",
				id,
				action: "stop"
			}, "*");
		};
		window.PAGE_AGENT_EXT_VERSION = "1.6.2";
		window.PAGE_AGENT_EXT = {
			version: "1.6.2",
			execute,
			stop
		};
	});
	//#endregion
	//#region \0virtual:wxt-unlisted-script-entrypoint?/Users/8bit/Downloads/nanosolana-go/chrome-extension/extension/src/entrypoints/main-world.ts
	function print(method, ...args) {}
	/** Wrapper around `console` with a "[wxt]" prefix */
	var logger = {
		debug: (...args) => print(console.debug, ...args),
		log: (...args) => print(console.log, ...args),
		warn: (...args) => print(console.warn, ...args),
		error: (...args) => print(console.error, ...args)
	};
	//#endregion
	return (() => {
		let result;
		try {
			result = main_world_default.main();
			if (result instanceof Promise) result = result.catch((err) => {
				logger.error(`The unlisted script "main-world" crashed on startup!`, err);
				throw err;
			});
		} catch (err) {
			logger.error(`The unlisted script "main-world" crashed on startup!`, err);
			throw err;
		}
		return result;
	})();
})();

mainWorld;