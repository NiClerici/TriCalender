import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { componentTagger } from "lovable-tagger";

const trainingsJsonPath = path.resolve(__dirname, "../trainingskalender/trainings.json");
const projectRoot = path.resolve(__dirname, "..");
const pythonExecutable = process.env.PYTHON ?? "python3";

type ActionKey = "get-strava" | "sync-strava" | "export" | "commit";

const actionCommands: Record<
  ActionKey,
  { command: string; args: string[]; cwd?: string; env?: NodeJS.ProcessEnv }
> = {
  "get-strava": {
    command: pythonExecutable,
    args: [path.resolve(projectRoot, "trainingskalender/getStrava.py")],
  },
  "sync-strava": {
    command: pythonExecutable,
    args: [path.resolve(projectRoot, "trainingskalender/syncStrava.py")],
  },
  export: {
    command: pythonExecutable,
    args: [path.resolve(projectRoot, "trainingskalender/export.py")],
  },
  commit: {
    command: "bash",
    args: [path.resolve(projectRoot, "auto_commit.sh")],
  },
};

type TrainingRecord = Record<string, any>;

const defaultTrainingEntry: TrainingRecord = {
  date: new Date().toISOString().slice(0, 10),
  start_time: "00:00",
  title: "New Training",
  duration_min: null,
  sport: "Other",
  note: null,
  location: null,
  use_default_alarm: false,
  completed: false,
  matched_activity_id: null,
  match_score: null,
  actual: null,
};

const sanitizeActual = (actual: Record<string, unknown> | null | undefined) => {
  if (!actual || typeof actual !== "object") {
    return null;
  }

  const { pace, link, ...rest } = actual as Record<string, unknown>;
  return rest;
};

const normalizeTraining = (
  partial: Record<string, unknown>,
  currentEntryRaw: TrainingRecord = defaultTrainingEntry
): TrainingRecord => {
  const currentEntry: TrainingRecord = { ...defaultTrainingEntry, ...currentEntryRaw };

  return {
    ...currentEntry,
    date:
      typeof partial.date === "string" && partial.date.trim().length > 0
        ? partial.date
        : currentEntry.date,
    start_time:
      typeof partial.start_time === "string" && partial.start_time.trim().length > 0
        ? partial.start_time
        : currentEntry.start_time,
    title:
      typeof partial.title === "string" && partial.title.trim().length > 0
        ? partial.title
        : currentEntry.title,
    duration_min:
      typeof partial.duration_min === "number"
        ? partial.duration_min
        : partial.duration_min === null
        ? null
        : currentEntry.duration_min ?? null,
    sport:
      typeof partial.sport === "string" && partial.sport.trim().length > 0
        ? partial.sport
        : currentEntry.sport ?? "Other",
    note:
      typeof partial.note === "string"
        ? partial.note
        : partial.note === null
        ? null
        : currentEntry.note ?? null,
    location:
      typeof partial.location === "string"
        ? partial.location
        : partial.location === null
        ? null
        : currentEntry.location ?? null,
    use_default_alarm:
      typeof partial.use_default_alarm === "boolean"
        ? partial.use_default_alarm
        : currentEntry.use_default_alarm ?? false,
    completed:
      typeof partial.completed === "boolean" ? partial.completed : Boolean(currentEntry.completed),
    matched_activity_id:
      typeof partial.matched_activity_id === "number"
        ? partial.matched_activity_id
        : partial.matched_activity_id === null
        ? null
        : currentEntry.matched_activity_id ?? null,
    match_score:
      typeof partial.match_score === "number"
        ? partial.match_score
        : partial.match_score === null
        ? null
        : currentEntry.match_score ?? null,
    actual:
      partial.actual === undefined
        ? currentEntry.actual ?? null
        : sanitizeActual(partial.actual as Record<string, unknown> | null),
  };
};

const runAction = async (action: ActionKey): Promise<{ success: boolean; output: string }> => {
  const entry = actionCommands[action];
  if (!entry) {
    throw new Error(`Unknown action: ${action}`);
  }

  return await new Promise((resolve, reject) => {
    const child = spawn(entry.command, entry.args, {
      cwd: entry.cwd ?? projectRoot,
      env: { ...process.env, ...entry.env },
      shell: false,
    });

    const chunks: string[] = [];

    child.stdout.on("data", (chunk) => chunks.push(chunk.toString()));
    child.stderr.on("data", (chunk) => chunks.push(chunk.toString()));

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      const output = chunks.join("").trim();
      if (code === 0) {
        resolve({ success: true, output });
      } else {
        reject(new Error(output || `Command exited with code ${code}`));
      }
    });
  });
};

const ensureTrainingsFile = async () => {
  try {
    await fs.promises.access(trainingsJsonPath, fs.constants.F_OK);
  } catch {
    const fallback = { trainings: [] };
    await fs.promises.mkdir(path.dirname(trainingsJsonPath), { recursive: true });
    await fs.promises.writeFile(trainingsJsonPath, JSON.stringify(fallback, null, 2) + "\n", "utf-8");
  }
};

const readTrainingsFile = async () => {
  await ensureTrainingsFile();
  const raw = await fs.promises.readFile(trainingsJsonPath, "utf-8");
  return JSON.parse(raw);
};

const writeTrainingsFile = async (content: unknown) => {
  await fs.promises.writeFile(trainingsJsonPath, JSON.stringify(content, null, 2) + "\n", "utf-8");
};

const readRequestBody = async (req: any): Promise<string> =>
  await new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    req.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });

const sendJson = (res: any, statusCode: number, payload: unknown) => {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
};

const trainingsDataPlugin = () => ({
  name: "trainings-data",
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url) {
        return next();
      }

      const url = req.url.split("?")[0];

      if (url === "/trainingskalender/trainings.json" && req.method === "GET") {
        try {
          const data = await fs.promises.readFile(trainingsJsonPath, "utf-8");
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(data);
        } catch (error) {
          console.error("[trainings-data] failed to read trainings.json", error);
          sendJson(res, 500, { error: "Failed to load trainings data" });
        }
        return;
      }

      if (url === "/api/trainings") {
        if (req.method === "GET") {
          try {
            const data = await readTrainingsFile();
            sendJson(res, 200, data);
          } catch (error) {
            console.error("[trainings-data] failed to read trainings.json", error);
            sendJson(res, 500, { error: "Failed to load trainings data" });
          }
          return;
        }

        if (["POST", "PUT", "PATCH"].includes(req.method ?? "")) {
          try {
            const body = await readRequestBody(req);
            const payload = body ? JSON.parse(body) : {};
            const updated = payload?.training;

            if (!updated || typeof updated !== "object") {
              sendJson(res, 400, { error: "Request body must contain a training object." });
              return;
            }

            const current = await readTrainingsFile();
            if (!Array.isArray(current?.trainings)) {
              current.trainings = [];
            }

            const { sourceIndex: rawSourceIndex, id: _id, ...partial } = updated as Record<
              string,
              unknown
            >;

            if (typeof rawSourceIndex !== "number" || Number.isNaN(rawSourceIndex)) {
              const normalized = normalizeTraining(partial);
              const index = current.trainings.length;
              current.trainings.push(normalized);
              await writeTrainingsFile(current);
              server.watcher.emit("change", trainingsJsonPath);
              sendJson(res, 200, {
                success: true,
                training: normalized,
                index,
              });
              return;
            }

            if (!current.trainings[rawSourceIndex]) {
              sendJson(res, 404, { error: `Training at index ${rawSourceIndex} not found.` });
              return;
            }

            const normalized = normalizeTraining(partial, current.trainings[rawSourceIndex]);
            current.trainings[rawSourceIndex] = normalized;
            await writeTrainingsFile(current);
            server.watcher.emit("change", trainingsJsonPath);

            sendJson(res, 200, {
              success: true,
              training: current.trainings[rawSourceIndex],
              index: rawSourceIndex,
            });
          } catch (error) {
            console.error("[trainings-data] failed to update trainings.json", error);
            sendJson(res, 500, { error: "Failed to update trainings data." });
          }
          return;
        }

        sendJson(res, 405, { error: `Method ${req.method} not allowed.` });
        return;
      }

      if (url.startsWith("/api/trainings/")) {
        if (req.method !== "DELETE") {
          sendJson(res, 405, { error: `Method ${req.method} not allowed.` });
          return;
        }

        const indexStr = url.replace("/api/trainings/", "");
        const index = Number.parseInt(indexStr, 10);
        if (Number.isNaN(index)) {
          sendJson(res, 400, { error: "Training index must be a number." });
          return;
        }

        try {
          const current = await readTrainingsFile();
          if (!Array.isArray(current?.trainings) || !current.trainings[index]) {
            sendJson(res, 404, { error: `Training at index ${index} not found.` });
            return;
          }

          current.trainings.splice(index, 1);
          await writeTrainingsFile(current);
          server.watcher.emit("change", trainingsJsonPath);

          sendJson(res, 200, { success: true, index });
        } catch (error) {
          console.error("[trainings-data] failed to delete training", error);
          sendJson(res, 500, { error: "Failed to delete training." });
        }
        return;
      }

      if (url.startsWith("/api/actions/")) {
        if (req.method !== "POST") {
          sendJson(res, 405, { error: `Method ${req.method} not allowed.` });
          return;
        }

        const action = url.replace("/api/actions/", "") as ActionKey;
        if (!(action in actionCommands)) {
          sendJson(res, 404, { error: `Unknown action '${action}'.` });
          return;
        }

        try {
          const result = await runAction(action);

          if (action === "sync-strava") {
            server.watcher.emit("change", trainingsJsonPath);
          }

          if (action === "get-strava") {
            server.watcher.emit(
              "change",
              path.resolve(projectRoot, "trainingskalender/exportStravaTraining.json")
            );
          }

          if (action === "export") {
            server.watcher.emit("change", path.resolve(projectRoot, "tritrainings.ics"));
          }

          sendJson(res, 200, { success: true, output: result.output });
        } catch (error) {
          console.error(`[trainings-data] action '${action}' failed`, error);
          sendJson(res, 500, {
            error: error instanceof Error ? error.message : "Action failed",
          });
        }
        return;
      }

      next();
    });

    server.watcher.add([
      trainingsJsonPath,
      path.resolve(projectRoot, "trainingskalender/exportStravaTraining.json"),
      path.resolve(projectRoot, "tritrainings.ics"),
    ]);
  },
  async writeBundle() {
    try {
      await ensureTrainingsFile();
      const outDir = path.resolve(__dirname, "dist/trainingskalender");
      await fs.promises.mkdir(outDir, { recursive: true });
      await fs.promises.copyFile(trainingsJsonPath, path.join(outDir, "trainings.json"));
    } catch (error) {
      console.warn("[trainings-data] skipping trainings.json copy:", error);
    }
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    fs: {
      // allow loading JSON data from the existing project root
      allow: [path.resolve(__dirname, ".."), path.resolve(__dirname, "../trainingskalender")],
    },
  },
  plugins: [react(), trainingsDataPlugin(), mode === "development" && componentTagger()].filter(
    Boolean
  ),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
