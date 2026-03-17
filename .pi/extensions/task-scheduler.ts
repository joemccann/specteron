/**
 * Task Scheduler Extension
 *
 * On session_start, reads .pi/tasks.json and checks for due tasks.
 * Due tasks are executed in a BACKGROUND pi process using `pi -p` (print mode),
 * so they never interrupt or take over the current interactive session.
 *
 * - "date" tasks: due when now >= scheduled date, run once then mark completed.
 * - "interval" tasks: due when now >= lastRunAt + intervalMs, run repeatedly.
 *
 * Wake-up recovery:
 *   When the computer sleeps, background `pi -p` processes may be killed by the
 *   OS, leaving tasks stuck in "running" status. The main pi Node.js process
 *   survives sleep (it freezes and resumes), so the 60s setInterval continues
 *   after wake. On every check cycle AND on session_start, stale "running" tasks
 *   are detected (running longer than STALE_TASK_THRESHOLD_MS, default 30min)
 *   and reset to "pending". Once reset, isDue() catches up on missed intervals
 *   since lastRunAt + intervalMs < now after a long sleep. This means:
 *     - If pi was already running when the computer slept → tasks recover
 *       within ~60s of wake via the periodic checkAndRunTasks().
 *     - If pi is launched fresh after wake → tasks recover immediately in
 *       session_start via recoverStaleTasks().
 *
 * A background interval re-checks every 60s for interval-based tasks.
 *
 * Also provides:
 *   /tasks        - list all tasks and their status
 *   /tasks-add    - interactively add a new task
 *   /tasks-remove - remove a task by id
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawn } from "node:child_process";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

interface DateSchedule {
	type: "date";
	date: string;
}

interface IntervalSchedule {
	type: "interval";
	intervalMs: number;
	startAfter?: string;
}

interface Task {
	id: string;
	description: string;
	schedule: DateSchedule | IntervalSchedule;
	status: "pending" | "running" | "completed" | "failed";
	createdAt: string;
	lastRunAt: string | null;
	completedAt: string | null;
}

interface TasksFile {
	tasks: Task[];
}

// If a task has been in "running" status longer than this, assume the process
// was killed (e.g. by sleep/shutdown) and reset it to "pending" so it can be
// re-evaluated by isDue().
const STALE_TASK_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export default function (pi: ExtensionAPI) {
	let tasksPath = "";
	let projectCwd = "";
	let checkInterval: ReturnType<typeof setInterval> | null = null;
	const runningProcesses: Set<ReturnType<typeof spawn>> = new Set();

	function getTasksPath(cwd: string): string {
		return path.join(cwd, ".pi", "tasks.json");
	}

	function loadTasks(filePath: string): TasksFile {
		try {
			const raw = fs.readFileSync(filePath, "utf-8");
			return JSON.parse(raw) as TasksFile;
		} catch {
			return { tasks: [] };
		}
	}

	function saveTasks(filePath: string, data: TasksFile): void {
		fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
	}

	function isDue(task: Task, now: number): boolean {
		if (task.status === "completed" || task.status === "running") return false;

		if (task.schedule.type === "date") {
			const dueDate = new Date(task.schedule.date).getTime();
			return now >= dueDate;
		}

		if (task.schedule.type === "interval") {
			const { intervalMs, startAfter } = task.schedule;
			if (startAfter && now < new Date(startAfter).getTime()) return false;

			if (!task.lastRunAt) return true;
			const lastRun = new Date(task.lastRunAt).getTime();
			return now >= lastRun + intervalMs;
		}

		return false;
	}

	/**
	 * Recover tasks stuck in "running" status after a sleep/wake cycle or crash.
	 * If a task has been "running" for longer than STALE_TASK_THRESHOLD_MS, reset
	 * it to "pending" so isDue() can re-evaluate it. For interval tasks, lastRunAt
	 * is preserved so the catch-up logic works correctly (now >= lastRunAt + intervalMs).
	 * Returns the list of recovered task IDs.
	 */
	function recoverStaleTasks(now: number): string[] {
		const data = loadTasks(tasksPath);
		const recovered: string[] = [];

		for (const task of data.tasks) {
			if (task.status !== "running") continue;

			// Determine how long it's been running
			const runStart = task.lastRunAt ? new Date(task.lastRunAt).getTime() : 0;
			const elapsed = now - runStart;

			if (elapsed > STALE_TASK_THRESHOLD_MS || runStart === 0) {
				// Task is stale — the background process is likely dead
				if (task.schedule.type === "date") {
					// One-time task: reset to pending so it runs again
					task.status = "pending";
				} else {
					// Interval task: reset to pending, keep lastRunAt so isDue()
					// correctly detects it's overdue (lastRunAt + intervalMs < now)
					task.status = "pending";
				}
				recovered.push(task.id);
			}
		}

		if (recovered.length > 0) {
			saveTasks(tasksPath, data);
		}

		return recovered;
	}

	/**
	 * Run a task in a background pi process using `pi -p` (print/non-interactive mode).
	 * This spawns a completely separate pi process that doesn't interfere with the
	 * current interactive session.
	 */
	function runTaskInBackground(task: Task): void {
		const data = loadTasks(tasksPath);
		const t = data.tasks.find((x) => x.id === task.id);
		if (!t) return;

		t.status = "running";
		t.lastRunAt = new Date().toISOString();
		saveTasks(tasksPath, data);

		// Build the prompt that the background pi process will execute.
		// Include the complete_task instruction so pi marks it done when finished.
		const prompt = [
			`[Scheduled Task: ${task.id}]`,
			"",
			task.description,
			"",
			`When complete, call the complete_task tool with id "${task.id}" to mark it done.`,
		].join("\n");

		const logFile = path.join(projectCwd, ".pi", `task-${task.id}.log`);

		// Spawn `pi -p` in print mode with --no-session so it doesn't persist
		// a session file, and --continue is not needed.
		const child = spawn(
			"pi",
			[
				"-p",            // Print mode: non-interactive, process prompt and exit
				"--no-session",  // Don't save a session file
				prompt,
			],
			{
				cwd: projectCwd,
				stdio: ["ignore", "pipe", "pipe"],
				env: {
					...process.env,
					// Default widget positioning: top-left, 50% width/height
					GLIMPSE_DEFAULT_POSITION: process.env.GLIMPSE_DEFAULT_POSITION || "top-left",
					GLIMPSE_DEFAULT_WIDTH: process.env.GLIMPSE_DEFAULT_WIDTH || "50%",
					GLIMPSE_DEFAULT_HEIGHT: process.env.GLIMPSE_DEFAULT_HEIGHT || "50%",
				},
				detached: false,
			},
		);

		runningProcesses.add(child);

		// Capture output to log file
		const logStream = fs.createWriteStream(logFile, { flags: "a" });
		logStream.write(`\n--- Task run: ${new Date().toISOString()} ---\n`);

		if (child.stdout) child.stdout.pipe(logStream);
		if (child.stderr) child.stderr.pipe(logStream);

		child.on("close", (code) => {
			runningProcesses.delete(child);
			logStream.write(`\n--- Exited with code ${code} ---\n`);
			logStream.end();

			// If pi -p exited, check if the task was marked complete by the
			// complete_task tool. If not (e.g. pi couldn't call the tool in
			// print mode), mark it based on exit code.
			const updated = loadTasks(tasksPath);
			const ut = updated.tasks.find((x) => x.id === task.id);
			if (ut && ut.status === "running") {
				if (code === 0) {
					if (ut.schedule.type === "date") {
						ut.status = "completed";
						ut.completedAt = new Date().toISOString();
					} else {
						// Interval task: reset to pending for next run
						ut.status = "pending";
					}
				} else {
					ut.status = "failed";
				}
				saveTasks(tasksPath, updated);
			}
		});

		child.on("error", (err) => {
			runningProcesses.delete(child);
			logStream.write(`\n--- Spawn error: ${err.message} ---\n`);
			logStream.end();

			const updated = loadTasks(tasksPath);
			const ut = updated.tasks.find((x) => x.id === task.id);
			if (ut && ut.status === "running") {
				ut.status = "failed";
				saveTasks(tasksPath, updated);
			}
		});
	}

	function checkAndRunTasks(): void {
		const now = Date.now();

		// Recover any stale "running" tasks first — this is critical for wake-up
		// scenarios where the `pi -p` background process was killed by OS sleep.
		// Unlike session_start (which fires only once at launch), this runs every
		// 60s via setInterval, so it catches stale tasks even after a sleep/wake
		// cycle mid-session.
		recoverStaleTasks(now);

		const data = loadTasks(tasksPath);

		for (const task of data.tasks) {
			if (isDue(task, now)) {
				runTaskInBackground(task);
			}
		}
	}

	// --- Lifecycle ---

	pi.on("session_start", async (_event, ctx) => {
		projectCwd = ctx.cwd;
		tasksPath = getTasksPath(ctx.cwd);

		if (!fs.existsSync(tasksPath)) {
			if (ctx.hasUI) ctx.ui.setStatus("tasks", "No .pi/tasks.json found");
			return;
		}

		const now = Date.now();

		// --- Wake-up recovery ---
		// Detect tasks stuck in "running" from a previous session that was
		// killed by sleep/shutdown. Reset them to "pending" so isDue() picks
		// them up. This must run BEFORE the due-task check below.
		const recovered = recoverStaleTasks(now);
		if (recovered.length > 0 && ctx.hasUI) {
			ctx.ui.notify(
				`🔄 Recovered ${recovered.length} stale task(s) after wake: ${recovered.join(", ")}`,
				"info",
			);
		}

		// Reload after potential recovery edits
		const data = loadTasks(tasksPath);
		const dueTasks = data.tasks.filter((t) => isDue(t, now));
		const scheduledTasks = data.tasks.filter((t) => t.status === "pending" && !isDue(t, now));
		const hasIntervalTasks = data.tasks.some((t) => t.schedule.type === "interval" && t.status !== "completed");

		if (ctx.hasUI) {
			const parts: string[] = [];
			if (dueTasks.length > 0) {
				const names = dueTasks.map((t) => t.id).join(", ");
				parts.push(`${dueTasks.length} running now (${names})`);
			}
			if (scheduledTasks.length > 0) {
				const details = scheduledTasks.map((t) => {
					if (t.schedule.type === "date") {
						const days = Math.ceil((new Date(t.schedule.date).getTime() - now) / 86400000);
						return `${t.id} (in ${days}d)`;
					}
					const mins = Math.round(((t.schedule as IntervalSchedule).intervalMs) / 60000);
					return `${t.id} (every ${mins}m)`;
				}).join(", ");
				parts.push(`${scheduledTasks.length} scheduled (${details})`);
			}
			if (parts.length > 0) {
				ctx.ui.setStatus("tasks", `📋 ${parts.join(" · ")}`);
			}
		}

		// Run due tasks in background
		if (dueTasks.length > 0) {
			if (ctx.hasUI) {
				const names = dueTasks.map((t) => t.id).join(", ");
				ctx.ui.notify(
					`📋 Running ${dueTasks.length} task(s) in background: ${names}`,
					"info",
				);
			}
			// Small delay to let session fully initialize
			setTimeout(() => checkAndRunTasks(), 2000);
		}

		// Set up interval checking (every 60s) for recurring tasks
		if (hasIntervalTasks) {
			checkInterval = setInterval(() => {
				checkAndRunTasks();
			}, 60_000);
		}
	});

	pi.on("session_shutdown", async () => {
		if (checkInterval) {
			clearInterval(checkInterval);
			checkInterval = null;
		}
		// Note: we don't kill background processes on shutdown —
		// they are independent pi instances that should finish their work.
	});

	// --- Tool: mark task complete ---
	// This tool is available both in the foreground session and in
	// background `pi -p` processes (since they discover project extensions).

	pi.registerTool({
		name: "complete_task",
		label: "Complete Task",
		description:
			"Mark a scheduled task as completed (for one-time tasks) or update its lastRunAt (for interval tasks). Call this after successfully executing a scheduled task.",
		parameters: {
			type: "object" as const,
			required: ["id"],
			properties: {
				id: { type: "string" as const, description: "The task id to mark complete" },
				failed: {
					type: "boolean" as const,
					description: "Set to true if the task failed instead of completing successfully",
				},
			},
		},
		async execute(_toolCallId: string, params: { id: string; failed?: boolean }) {
			const data = loadTasks(tasksPath);
			const task = data.tasks.find((t) => t.id === params.id);

			if (!task) {
				return {
					content: [{ type: "text" as const, text: `Task "${params.id}" not found.` }],
					details: {},
				};
			}

			const now = new Date().toISOString();

			if (params.failed) {
				task.status = "failed";
				task.lastRunAt = now;
			} else if (task.schedule.type === "date") {
				task.status = "completed";
				task.completedAt = now;
			} else {
				// Interval task: reset to pending for next run
				task.status = "pending";
				task.lastRunAt = now;
			}

			saveTasks(tasksPath, data);

			const statusMsg = params.failed
				? "marked as failed"
				: task.schedule.type === "date"
					? "completed"
					: "completed (will run again on next interval)";

			return {
				content: [{ type: "text" as const, text: `Task "${params.id}" ${statusMsg}.` }],
				details: { task },
			};
		},
	});

	// --- Command: /tasks ---

	pi.registerCommand("tasks", {
		description: "List all scheduled tasks and their status",
		handler: async (_args, ctx) => {
			const data = loadTasks(tasksPath);

			if (data.tasks.length === 0) {
				ctx.ui.notify("No scheduled tasks found.", "info");
				return;
			}

			const lines: string[] = ["", "📋 Scheduled Tasks:", ""];
			for (const task of data.tasks) {
				const status =
					task.status === "completed"
						? "✅"
						: task.status === "running"
							? "⏳"
							: task.status === "failed"
								? "❌"
								: "⏰";

				lines.push(`${status} [${task.id}] ${task.status.toUpperCase()}`);
				lines.push(`   ${task.description.substring(0, 100)}${task.description.length > 100 ? "..." : ""}`);

				if (task.schedule.type === "date") {
					const due = new Date(task.schedule.date);
					const now = new Date();
					const diff = due.getTime() - now.getTime();
					const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
					lines.push(
						`   📅 Due: ${task.schedule.date}${diff > 0 ? ` (in ${days} day${days !== 1 ? "s" : ""})` : " (OVERDUE)"}`,
					);
				} else {
					const hours = Math.round((task.schedule.intervalMs / (1000 * 60 * 60)) * 10) / 10;
					lines.push(`   🔄 Every ${hours}h${task.lastRunAt ? ` (last: ${task.lastRunAt})` : ""}`);
				}
				lines.push("");
			}

			ctx.ui.notify(lines.join("\n"), "info");
		},
	});

	// --- Command: /tasks-add ---

	pi.registerCommand("tasks-add", {
		description: "Add a new scheduled task (usage: /tasks-add)",
		handler: async (_args, ctx) => {
			const id = await ctx.ui.input("Task ID:", "my-task-id");
			if (!id) return;

			const description = await ctx.ui.editor("Task description (what should pi do?):", "");
			if (!description) return;

			const schedType = await ctx.ui.select("Schedule type:", [
				"date - Run once at a specific date",
				"interval - Run repeatedly",
			]);
			if (!schedType) return;

			let schedule: DateSchedule | IntervalSchedule;

			if (schedType.startsWith("date")) {
				const dateStr = await ctx.ui.input("Due date (ISO 8601, e.g. 2026-04-01T12:00:00.000Z):", "");
				if (!dateStr) return;
				schedule = { type: "date", date: dateStr };
			} else {
				const hours = await ctx.ui.input("Interval in hours:", "24");
				if (!hours) return;
				schedule = { type: "interval", intervalMs: parseFloat(hours) * 60 * 60 * 1000 };
			}

			const data = loadTasks(tasksPath);
			data.tasks.push({
				id,
				description,
				schedule,
				status: "pending",
				createdAt: new Date().toISOString(),
				lastRunAt: null,
				completedAt: null,
			});
			saveTasks(tasksPath, data);

			ctx.ui.notify(`Task "${id}" added.`, "success");
		},
	});

	// --- Command: /tasks-remove ---

	pi.registerCommand("tasks-remove", {
		description: "Remove a scheduled task by id",
		handler: async (_args, ctx) => {
			const data = loadTasks(tasksPath);
			if (data.tasks.length === 0) {
				ctx.ui.notify("No tasks to remove.", "info");
				return;
			}

			const options = data.tasks.map((t) => `${t.id} — ${t.description.substring(0, 60)}`);
			const choice = await ctx.ui.select("Remove which task?", options);
			if (!choice) return;

			const taskId = choice.split(" — ")[0];
			data.tasks = data.tasks.filter((t) => t.id !== taskId);
			saveTasks(tasksPath, data);

			ctx.ui.notify(`Task "${taskId}" removed.`, "success");
		},
	});
}
