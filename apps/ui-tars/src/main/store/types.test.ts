/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect } from 'vitest';
import { VLM_PROVIDER_LABELS, VLM_PROVIDER_VALUES } from './types';

describe('VLM provider constants', () => {
  it('should expose labels for each provider', () => {
    expect(VLM_PROVIDER_LABELS).toEqual({
      ollama: 'Ollama (local)',
      anthropic: 'Anthropic (Claude)',
      openai: 'OpenAI (ChatGPT)',
    });
  });

  it('should list all provider values', () => {
    expect(VLM_PROVIDER_VALUES).toEqual(['ollama', 'anthropic', 'openai']);
  });
});
