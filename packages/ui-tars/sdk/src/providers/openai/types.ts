/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import type { ClientOptions } from 'openai';
import type { ChatCompletionCreateParamsBase, ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';

export type OpenAIChatCompletionCreateParams = Omit<ClientOptions, 'maxRetries'> &
  Pick<ChatCompletionCreateParamsBase, 'model' | 'max_tokens' | 'temperature' | 'top_p'>;

export interface UITarsModelConfig extends OpenAIChatCompletionCreateParams {
  /** Whether to use OpenAI Response API instead of Chat Completions API */
  useResponsesApi?: boolean;
}

export interface ThinkingVisionProModelConfig extends ChatCompletionCreateParamsNonStreaming {
  thinking?: {
    type: 'enabled' | 'disabled';
  };
}
