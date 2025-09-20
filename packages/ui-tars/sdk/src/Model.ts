/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { vlmProvider } from '../../../../apps/ui-tars/src/main/env';

import type { UITarsModelConfig } from './providers/openai/types';
import { ProviderAdapter } from './providers/ProviderAdapter';
import { OpenAIAdapter } from './providers/openai/OpenAIAdapter';
import { AnthropicAdapter } from './providers/anthropic/AnthropicAdapter';
import { OllamaAdapter } from './providers/ollama/OllamaAdapter';
import { Model, type InvokeParams, type InvokeOutput } from './types';

export type { UITarsModelConfig } from './providers/openai/types';

export class UITarsModel extends Model {
  private readonly adapter: ProviderAdapter;

  constructor(protected readonly modelConfig: UITarsModelConfig) {
    super();
    this.adapter = this.createAdapter();
  }

  private createAdapter(): ProviderAdapter {
    switch (vlmProvider) {
      case 'anthropic':
        return new AnthropicAdapter(this.modelConfig);
      case 'ollama':
        return new OllamaAdapter(this.modelConfig);
      default:
        return new OpenAIAdapter(this.modelConfig);
    }
  }

  get useResponsesApi(): boolean {
    return this.adapter.useResponsesApi;
  }

  /** [widthFactor, heightFactor] */
  get factors(): [number, number] {
    return this.adapter.factors;
  }

  get modelName(): string {
    return this.adapter.modelName;
  }

  reset(): void {
    this.adapter.reset();
  }

  supportsVision(): boolean {
    return this.adapter.supportsVision();
  }

  async invoke(params: InvokeParams): Promise<InvokeOutput> {
    return this.adapter.invoke(params);
  }
}
