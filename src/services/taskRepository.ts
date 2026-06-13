import type { AgentStatusSnapshot } from "../domain/agentStatus";
import type { PinPulseTask } from "../domain/task";
import type { ProgressEvent } from "../domain/protocol";
import { invokeCommand } from "./tauriApi";

export type CreateTaskInput = {
  title: string;
  flags: number;
};

export type BoundFolderRefresh = {
  events: ProgressEvent[];
  markdownProgress: {
    completed: number;
    total: number;
    progress: number;
  };
  agentStatus?: {
    current?: AgentStatusSnapshot;
    history: AgentStatusSnapshot[];
  };
};

export type BindFolderInput = {
  taskId: string;
  title: string;
  folder: string;
};

export function listTasks(): Promise<PinPulseTask[]> {
  return invokeCommand<PinPulseTask[]>("list_tasks");
}

export function createTask(input: CreateTaskInput): Promise<PinPulseTask> {
  return invokeCommand<PinPulseTask>("create_task", { input });
}

export function bindFolder(input: BindFolderInput): Promise<void> {
  return invokeCommand<void>("bind_folder", { input });
}

export function refreshBoundFolder(folder: string): Promise<BoundFolderRefresh> {
  return invokeCommand<BoundFolderRefresh>("refresh_bound_folder", { folder });
}

export function updateTask(id: string, patch: Record<string, unknown>): Promise<void> {
  return invokeCommand<void>("update_task", { id, patch });
}

export function deleteTask(id: string): Promise<void> {
  return invokeCommand<void>("delete_task", { id });
}

export type AgentHookConfig = {
  configJson: string;
  targetPath: string;
  agent: string;
};

export type GenerateHookConfigInput = {
  folder: string;
  agent: string;
};

export function generateAgentHookConfig(input: GenerateHookConfigInput): Promise<AgentHookConfig> {
  return invokeCommand<AgentHookConfig>("generate_agent_hook_config", { input });
}

export function watchAgentStatus(folder: string): Promise<void> {
  return invokeCommand<void>("watch_agent_status", { folder });
}
