/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VERSION: string
}

declare module '*.module.css' {
	const classes: Record<string, string>
	export default classes
}
