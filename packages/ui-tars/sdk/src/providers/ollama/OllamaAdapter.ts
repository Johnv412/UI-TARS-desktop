/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { actionParser } from '@ui-tars/action-parser';

import { DEFAULT_FACTORS } from '../../constants';
import { useContext } from '../../context/useContext';
import type { InvokeOutput, InvokeParams } from '../../types';
import { ProviderAdapter } from '../ProviderAdapter';
import type { UITarsModelConfig } from '../openai/types';

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export class OllamaAdapter implements ProviderAdapter {
  readonly useResponsesApi = false;

  constructor(private readonly config: UITarsModelConfig) {}

  get modelName(): string {
    return this.config.model ?? 'unknown';
  }

  get factors(): [number, number] {
    return DEFAULT_FACTORS;
  }

  supportsVision(): boolean {
    // Some Ollama models support vision (llama3.2-vision, moondream), but we'll start text-only
    return false;
  }

  reset(): void {
    // No persistent state to reset for Ollama
  }

  async invoke(params: InvokeParams): Promise<InvokeOutput> {
    if (params.images?.length && !this.supportsVision()) {
      throw new Error(
        'OllamaAdapter: vision not supported yet (please switch provider or disable screenshots).'
      );
    }

    const { conversations, screenContext, scaleFactor, uiTarsVersion } = params;
    const { logger, signal } = useContext();

    logger?.info(
      `[OllamaAdapter] invoke: screenContext=${JSON.stringify(screenContext)}, scaleFactor=${scaleFactor}, model=${this.modelName}`
    );

    // Convert conversations to Ollama message format
    const messages: OllamaMessage[] = conversations.map(conv => ({
      role: conv.role === 'human' ? 'user' : conv.role === 'ai' ? 'assistant' : 'system',
      content: conv.content
    }));

    const startTime = Date.now();

    try {
      const result = await this.callOllamaAPI(messages, signal);
      
      if (!result.message?.content) {
        throw new Error('Empty response from Ollama');
      }

      const prediction = result.message.content;
      const costTime = Date.now() - startTime;
      
      // Estimate token count (rough approximation: ~4 chars per token)
      const costTokens = Math.ceil(prediction.length / 4);

      try {
        const { parsed: parsedPredictions } = actionParser({
          prediction,
          factor: this.factors,
          screenContext,
          scaleFactor,
          modelVer: uiTarsVersion,
        });

        return {
          prediction,
          parsedPredictions,
          costTime,
          costTokens,
        };
      } catch (parseError) {
        logger?.error('[OllamaAdapter] action parsing error', parseError);
        return {
          prediction,
          parsedPredictions: [],
          costTime,
          costTokens,
        };
      }
    } catch (error) {
      logger?.error('[OllamaAdapter] error', error);
      throw error;
    }
  }

  private async callOllamaAPI(messages: OllamaMessage[], signal?: AbortSignal): Promise<OllamaResponse> {
    const { baseURL = 'http://localhost:11434', model } = this.config;
    const apiUrl = `${baseURL}/api/chat`;

    const controller = new AbortController();
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    // Set a 30-second timeout to match OpenAI adapter
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model || 'phi3:latest',
          messages,
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error (${response.status}): ${errorText}`);
      }

      const result: OllamaResponse = await response.json();
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Ollama request timed out (30s)');
      }
      throw error;
    }
  }
}
