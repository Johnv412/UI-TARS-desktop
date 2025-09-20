/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import type { InvokeOutput, InvokeParams } from '../types';

export interface ProviderAdapter {
  readonly modelName: string;
  readonly factors: [number, number];
  readonly useResponsesApi: boolean;

  supportsVision(): boolean;
  reset(): void;
  invoke(params: InvokeParams): Promise<InvokeOutput>;
}
