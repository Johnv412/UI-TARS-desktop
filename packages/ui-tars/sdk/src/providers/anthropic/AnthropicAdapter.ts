/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { actionParser } from '@ui-tars/action-parser';

import { DEFAULT_FACTORS, MAX_PIXELS } from '../../constants';
import { useContext } from '../../context/useContext';
import {
  preprocessResizeImage,
} from '../../utils';
import type { InvokeOutput, InvokeParams } from '../../types';
import { ProviderAdapter } from '../ProviderAdapter';
import type { UITarsModelConfig } from '../openai/types';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: Array<{
    type: 'text' | 'image';
    text?: string;
    source?: {
      type: 'base64';
      media_type: string;
      data: string;
    };
  }>;
}

interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text';
    text: string;
  }>;
  model: string;
  stop_reason: string;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class AnthropicAdapter implements ProviderAdapter {
  readonly useResponsesApi = false;

  constructor(private readonly config: UITarsModelConfig) {}

  get modelName(): string {
    return this.config.model ?? 'claude-3-5-sonnet-20241022';
  }

  get factors(): [number, number] {
    return DEFAULT_FACTORS;
  }

  supportsVision(): boolean {
    // Claude 3.5 Sonnet supports vision
    return true;
  }

  reset(): void {
    // No persistent state to reset for Anthropic
  }

  async invoke(params: InvokeParams): Promise<InvokeOutput> {
    const {
      conversations,
      images,
      screenContext,
      scaleFactor,
      uiTarsVersion,
    } = params;

    const { logger, signal } = useContext();

    logger?.info(
      `[AnthropicAdapter] invoke: screenContext=${JSON.stringify(screenContext)}, scaleFactor=${scaleFactor}, model=${this.modelName}`
    );

    const startTime = Date.now();

    // Handle image preprocessing if vision is enabled
    let processedImages: string[] = [];
    if (images?.length && this.supportsVision()) {
      // Use a reasonable max size
      const maxPixels = MAX_PIXELS;

      processedImages = await Promise.all(
        images.map((image) => preprocessResizeImage(image, maxPixels))
      );
    } else if (images?.length) {
      throw new Error(
        'AnthropicAdapter: Images provided but vision not supported for this model'
      );
    }

    // Convert conversations to Anthropic format
    const messages = this.convertToAnthropicMessages(conversations, processedImages);

    try {
      const result = await this.callAnthropicAPI(messages, signal);
      
      if (!result.content?.[0]?.text) {
        throw new Error('Empty response from Anthropic');
      }

      const prediction = result.content[0].text;
      const costTime = Date.now() - startTime;
      const costTokens = result.usage.input_tokens + result.usage.output_tokens;

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
        logger?.error('[AnthropicAdapter] action parsing error', parseError);
        return {
          prediction,
          parsedPredictions: [],
          costTime,
          costTokens,
        };
      }
    } catch (error) {
      logger?.error('[AnthropicAdapter] error', error);
      throw error;
    }
  }

  private convertToAnthropicMessages(
    conversations: Array<{ role: string; content: string }>,
    images: string[] = []
  ): AnthropicMessage[] {
    const messages: AnthropicMessage[] = [];
    let imageIndex = 0;

    for (const conv of conversations) {
      if (conv.role === 'system') {
        // Anthropic handles system messages differently - we'll prepend to first user message
        continue;
      }

      const role = conv.role === 'human' ? 'user' : 'assistant';
      const content: AnthropicMessage['content'] = [{ type: 'text', text: conv.content }];

      // Add images to user messages
      if (role === 'user' && imageIndex < images.length) {
        const imageData = images[imageIndex];
        if (imageData && imageData.startsWith('data:image/')) {
          const [header, base64Data] = imageData.split(',');
          const mediaType = header.match(/data:([^;]+)/)?.[1] || 'image/png';
          
          content.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Data,
            },
          });
          imageIndex++;
        }
      }

      messages.push({ role, content });
    }

    return messages;
  }

  private async callAnthropicAPI(messages: AnthropicMessage[], signal?: AbortSignal): Promise<AnthropicResponse> {
    const { apiKey, baseURL = 'https://api.anthropic.com', max_tokens = 1000, temperature = 0 } = this.config;

    const keyString = typeof apiKey === 'string' ? apiKey : String(apiKey || '');
    if (!keyString) {
      throw new Error('Anthropic API key is required');
    }

    const controller = new AbortController();
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    // Set a 30-second timeout
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${baseURL}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': keyString,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.modelName,
          max_tokens: max_tokens,
          temperature: temperature,
          messages,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
      }

      const result: AnthropicResponse = await response.json();
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Anthropic request timed out (30s)');
      }
      throw error;
    }
  }
}
