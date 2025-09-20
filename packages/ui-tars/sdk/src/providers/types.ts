/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */

// Re-export OpenAI types for consistency
export type { UITarsModelConfig, ThinkingVisionProModelConfig } from './openai/types';

// Provider-specific configurations could be added here
export interface OllamaConfig {
  baseURL?: string;
  model?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
}

export interface AnthropicConfig {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  max_tokens?: number;
  temperature?: number;
}