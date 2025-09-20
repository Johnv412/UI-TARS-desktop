/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { GUIAgentData, Message } from '@ui-tars/shared/types';

import { LocalStore, PresetSource } from './validate';
import { ConversationWithSoM } from '@main/shared/types';

export type NextAction =
  | { type: 'key'; text: string }
  | { type: 'type'; text: string }
  | { type: 'mouse_move'; x: number; y: number }
  | { type: 'left_click' }
  | { type: 'left_click_drag'; x: number; y: number }
  | { type: 'right_click' }
  | { type: 'middle_click' }
  | { type: 'double_click' }
  | { type: 'screenshot' }
  | { type: 'cursor_position' }
  | { type: 'finish' }
  | { type: 'error'; message: string };

export type AppState = {
  theme: 'dark' | 'light';
  ensurePermissions: { screenCapture?: boolean; accessibility?: boolean };
  instructions: string | null;
  restUserData: Omit<GUIAgentData, 'status' | 'conversations'> | null;
  status: GUIAgentData['status'];
  errorMsg: string | null;
  sessionHistoryMessages: Message[];
  messages: ConversationWithSoM[];
  abortController: AbortController | null;
  thinking: boolean;
  browserAvailable: boolean;
};

export const VLM_PROVIDER_LABELS = {
  ollama: 'Ollama (local)',
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI (ChatGPT)',
} as const;

export type VlmProvider = keyof typeof VLM_PROVIDER_LABELS;
export const VLM_PROVIDER_VALUES = Object.keys(
  VLM_PROVIDER_LABELS,
) as VlmProvider[];

// For backward compatibility with UI
export const VLMProviderV2 = VLM_PROVIDER_LABELS;

export enum SearchEngineForSettings {
  GOOGLE = 'google',
  BAIDU = 'baidu',
  BING = 'bing',
}

export enum Operator {
  RemoteComputer = 'Remote Computer Operator',
  RemoteBrowser = 'Remote Browser Operator',
  LocalComputer = 'Local Computer Operator',
  LocalBrowser = 'Local Browser Operator',
}

export type { PresetSource, LocalStore };
