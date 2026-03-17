/**
 * Project-local widget defaults.
 *
 * Reads .pi/env and sets environment variables before other extensions
 * (like pi-generative-ui) read them. This scopes the Glimpse widget
 * defaults to only this project.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

function loadEnvFile(filePath: string): void {
	try {
		const content = fs.readFileSync(filePath, "utf-8");
		for (const line of content.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;
			const eqIdx = trimmed.indexOf("=");
			if (eqIdx === -1) continue;
			const key = trimmed.slice(0, eqIdx).trim();
			const value = trimmed.slice(eqIdx + 1).trim();
			// Only set if not already defined (don't override explicit env)
			if (!process.env[key]) {
				process.env[key] = value;
			}
		}
	} catch {
		// File doesn't exist or can't be read — silently skip
	}
}

export default function (_pi: ExtensionAPI) {
	// Load .pi/env immediately during extension factory (before session_start)
	// so env vars are available when other extensions initialize.
	const cwd = process.cwd();
	const envPath = path.join(cwd, ".pi", "env");
	loadEnvFile(envPath);
}
