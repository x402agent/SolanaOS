export function truncate(text: string, maxLength: number): string {
	if (text.length > maxLength) {
		return text.substring(0, maxLength) + '...'
	}
	return text
}

/**
 * Escape HTML special characters to prevent XSS and rendering issues
 */
export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;')
}
