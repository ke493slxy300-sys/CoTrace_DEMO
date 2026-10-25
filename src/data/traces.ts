import type { AiTrace } from "../types";
import { NodeAiTracesSchema } from "../datasets/schema";
import nodeAiTracesRaw from "../datasets/built-in/campus-marketplace/content/data/node-ai-traces.json";
import { BACKEND_TASK_ID } from "./files";

export const presetTraces: AiTrace[] =
  NodeAiTracesSchema.parse(nodeAiTracesRaw);

export function getPresetTracesForTask(taskId: string): AiTrace[] {
  if (taskId !== BACKEND_TASK_ID) return [];

  return presetTraces.map((item) => ({ ...item }));
}
