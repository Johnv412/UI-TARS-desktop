/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import OpenAI from 'openai';
import {
  type ChatCompletionCreateParamsNonStreaming,
  type ChatCompletionMessageParam,
} from 'openai/resources/chat/completions';
import type {
  ResponseCreateParamsNonStreaming,
} from 'openai/resources/responses/responses';
import { actionParser } from '@ui-tars/action-parser';

import { ProviderAdapter } from '../ProviderAdapter';
import type { UITarsModelConfig, ThinkingVisionProModelConfig } from './types';
import { useContext } from '../../context/useContext';
import { DEFAULT_FACTORS } from '../../constants';
import {
  preprocessResizeImage,
  convertToOpenAIMessages,
  convertToResponseApiInput,
  isMessageImage,
} from '../../utils';
import type { InvokeParams, InvokeOutput } from '../../types';
import {
  UITarsModelVersion,
  MAX_PIXELS_V1_0,
  MAX_PIXELS_V1_5,
  MAX_PIXELS_DOUBAO,
} from '@ui-tars/shared/types';

export class OpenAIAdapter implements ProviderAdapter {
  private headImageContext: {
    messageIndex: number;
    responseIds: string[];
  } | null = null;

  constructor(private readonly config: UITarsModelConfig) {}

  get useResponsesApi(): boolean {
    return this.config.useResponsesApi ?? false;
  }

  get modelName(): string {
    return this.config.model ?? 'unknown';
  }

  get factors(): [number, number] {
    return DEFAULT_FACTORS;
  }

  supportsVision(): boolean {
    return true;
  }

  reset(): void {
    this.headImageContext = null;
  }

  async invoke(params: InvokeParams): Promise<InvokeOutput> {
    const {
      conversations,
      images,
      screenContext,
      scaleFactor,
      uiTarsVersion = UITarsModelVersion.V1_0,
      headers,
      previousResponseId,
    } = params;

    const { logger, signal } = useContext();

    logger?.info(
      `[UITarsModel] invoke: screenContext=${JSON.stringify(screenContext)}, scaleFactor=${scaleFactor}, uiTarsVersion=${uiTarsVersion}, useResponsesApi=${this.useResponsesApi}`,
    );

    const maxPixels =
      uiTarsVersion === UITarsModelVersion.V1_5
        ? MAX_PIXELS_V1_5
        : uiTarsVersion === UITarsModelVersion.DOUBAO_1_5_15B ||
            uiTarsVersion === UITarsModelVersion.DOUBAO_1_5_20B
          ? MAX_PIXELS_DOUBAO
          : MAX_PIXELS_V1_0;
    const compressedImages = await Promise.all(
      images.map((image) => preprocessResizeImage(image, maxPixels)),
    );

    const messages = convertToOpenAIMessages({
      conversations,
      images: compressedImages,
    });

    const startTime = Date.now();
    const result = await this.invokeModelProvider(
      uiTarsVersion,
      {
        messages,
        previousResponseId,
      },
      {
        signal,
      },
      headers,
    )
      .catch((e) => {
        logger?.error('[UITarsModel] error', e);
        throw e;
      })
      .finally(() => {
        logger?.info(`[UITarsModel cost]: ${Date.now() - startTime}ms`);
      });

    if (!result.prediction) {
      const err = new Error();
      err.name = 'vlm response error';
      err.stack = JSON.stringify(result) ?? 'no message';
      logger?.error(err);
      throw err;
    }

    const { prediction, costTime, costTokens, responseId } = result;

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
        responseId,
      };
    } catch (error) {
      logger?.error('[UITarsModel] error', error);
      return {
        prediction,
        parsedPredictions: [],
        responseId,
      };
    }
  }

  private async invokeModelProvider(
    uiTarsVersion: UITarsModelVersion,
    params: {
      messages: Array<ChatCompletionMessageParam>;
      previousResponseId?: string;
    },
    options: {
      signal?: AbortSignal;
    },
    headers?: Record<string, string>,
  ): Promise<{
    prediction: string;
    costTime?: number;
    costTokens?: number;
    responseId?: string;
  }> {
    const { logger } = useContext();
    const { messages, previousResponseId } = params;
    const {
      baseURL,
      apiKey,
      model,
      max_tokens = uiTarsVersion === UITarsModelVersion.V1_5 ? 65535 : 1000,
      temperature = 0,
      top_p = 0.7,
      ...restOptions
    } = this.config;

    const openai = new OpenAI({
      ...restOptions,
      maxRetries: 0,
      baseURL,
      apiKey,
    });

    const createCompletionPrams: ChatCompletionCreateParamsNonStreaming = {
      model,
      messages,
      stream: false,
      seed: null,
      stop: null,
      frequency_penalty: null,
      presence_penalty: null,
      // custom options
      max_tokens,
      temperature,
      top_p,
    };

    const createCompletionPramsThinkingVp: ThinkingVisionProModelConfig = {
      ...createCompletionPrams,
      thinking: {
        type: 'disabled',
      },
    };

    const startTime = Date.now();

    if (this.useResponsesApi) {
      const lastAssistantIndex = messages.findLastIndex(
        (c) => c.role === 'assistant',
      );
      logger.info('[ResponseAPI] lastAssistantIndex: ', lastAssistantIndex);
      // incremental messages
      const inputs = convertToResponseApiInput(
        lastAssistantIndex > -1
          ? messages.slice(lastAssistantIndex + 1)
          : messages,
      );

      // find the first image message
      const headImageMessageIndex = messages.findIndex(isMessageImage);
      if (
        this.headImageContext?.responseIds.length &&
        this.headImageContext?.messageIndex !== headImageMessageIndex
      ) {
        // The image window has slid. Delete the first image message.
        logger.info(
          '[ResponseAPI] should [delete]: ',
          this.headImageContext,
          'headImageMessageIndex',
          headImageMessageIndex,
        );
        const headImageResponseId = this.headImageContext.responseIds.shift();

        if (headImageResponseId) {
          const deletedResponse = await openai.responses.delete(
            headImageResponseId,
            {
              headers,
            },
          );
          logger.info(
            '[ResponseAPI] [deletedResponse]: ',
            headImageResponseId,
            deletedResponse,
          );
        }
      }

      let result;
      let responseId = previousResponseId;
      for (const input of inputs) {
        const truncated = JSON.stringify(
          [input],
          (key, value) => {
            if (typeof value === 'string' && value.startsWith('data:image/')) {
              return value.slice(0, 50) + '...[truncated]';
            }
            return value;
          },
          2,
        );
        const responseParams: ResponseCreateParamsNonStreaming = {
          input: [input],
          model,
          temperature,
          top_p,
          stream: false,
          max_output_tokens: max_tokens,
          ...(responseId && {
            previous_response_id: responseId,
          }),
          // @ts-expect-error
          thinking: {
            type: 'disabled',
          },
        };
        logger.info(
          '[ResponseAPI] [input]: ',
          truncated,
          'previous_response_id',
          responseParams?.previous_response_id,
          'headImageMessageIndex',
          headImageMessageIndex,
        );

        result = await openai.responses.create(responseParams, {
          ...options,
          timeout: 1000 * 30,
          headers,
        });
        logger.info('[ResponseAPI] [result]: ', result);
        responseId = result?.id;
        logger.info('[ResponseAPI] [responseId]: ', responseId);

        // head image changed
        if (responseId && isMessageImage(input)) {
          this.headImageContext = {
            messageIndex: headImageMessageIndex,
            responseIds: [
              ...(this.headImageContext?.responseIds || []),
              responseId,
            ],
          };
        }

        logger.info(
          '[ResponseAPI] [headImageContext]: ',
          this.headImageContext,
        );
      }

      return {
        prediction: result?.output_text ?? '',
        costTime: Date.now() - startTime,
        costTokens: result?.usage?.total_tokens ?? 0,
        responseId,
      };
    }

    // Use Chat Completions API if not using Response API
    const result = await openai.chat.completions.create(
      createCompletionPramsThinkingVp,
      {
        ...options,
        timeout: 1000 * 30,
        headers,
      },
    );

    return {
      prediction: result.choices?.[0]?.message?.content ?? '',
      costTime: Date.now() - startTime,
      costTokens: result.usage?.total_tokens ?? 0,
    };
  }
}
