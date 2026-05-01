import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { z } from "zod";
import config from "./config";
import { AISDKProvider } from "./providers/ai-sdk";

export enum AIProviderType {
  AI_SDK = "ai-sdk",
}

const ZAI_CODING_BASE_URL = "https://api.z.ai/api/coding/paas/v4/";

function createZAI(options?: Record<string, unknown>) {
  const provider = createOpenAI({
    ...options,
    name: "zai",
    baseURL: config.zaiBaseUrl || ZAI_CODING_BASE_URL,
  });
  return (modelId: string) => provider.chat(modelId);
}

const LLM_MODELS: Record<AIProviderType, ModelConfig[]> = {
  [AIProviderType.AI_SDK]: [
    // Anthropic
    {
      name: "claude-3-5-sonnet-20240620",
      createAi: createAnthropic,
    },
    {
      name: "claude-3-5-sonnet-20241022",
      createAi: createAnthropic,
    },
    {
      name: "claude-3-7-sonnet-20250219",
      createAi: createAnthropic,
    },
    {
      name: "claude-sonnet-4-20250514",
      createAi: createAnthropic,
    },
    {
      name: "claude-opus-4-20250514",
      createAi: createAnthropic,
    },
    {
      name: "claude-opus-4-1-20250805",
      createAi: createAnthropic,
    },
    // OpenAI - using responses API (default in AI SDK v5)
    {
      name: "gpt-5",
      createAi: createOpenAI,
      temperature: 1,
    },
    {
      name: "gpt-5-mini",
      createAi: createOpenAI,
      temperature: 1,
    },
    {
      name: "gpt-5-nano",
      createAi: createOpenAI,
      temperature: 1,
    },
    {
      name: "gpt-4.1-mini",
      createAi: createOpenAI,
    },
    {
      name: "gpt-4o-mini",
      createAi: createOpenAI,
    },
    {
      name: "o1",
      createAi: createOpenAI,
    },
    {
      name: "o1-mini",
      createAi: createOpenAI,
    },
    {
      name: "o3-mini",
      createAi: createOpenAI,
      temperature: 1,
    },
    {
      name: "o4-mini",
      createAi: createOpenAI,
      temperature: 1,
    },
    {
      name: "gpt-4.1",
      createAi: createOpenAI,
    },
    // Z.AI GLM coding endpoint, OpenAI-compatible.
    {
      name: "glm-5",
      createAi: createZAI,
      temperature: 1,
    },
    // Google stable models https://ai.google.dev/gemini-api/docs/models/gemini
    {
      name: "gemini-2.0-flash-001",
      createAi: createGoogleGenerativeAI,
    },
    {
      name: "gemini-2.0-flash-lite-preview-02-05",
      createAi: createGoogleGenerativeAI,
    },
    {
      name: "gemini-1.5-flash",
      createAi: createGoogleGenerativeAI,
    },
    {
      name: "gemini-1.5-flash-latest",
      createAi: createGoogleGenerativeAI,
    },
    {
      name: "gemini-1.5-flash-8b",
      createAi: createGoogleGenerativeAI,
    },
    {
      name: "gemini-1.5-pro",
      createAi: createGoogleGenerativeAI,
    },
    {
      name: "gemini-2.5-pro",
      createAi: createGoogleGenerativeAI,
    },
    {
      name: "gemini-2.5-flash",
      createAi: createGoogleGenerativeAI,
    },
    // Google experimental models https://ai.google.dev/gemini-api/docs/models/experimental-models
    {
      name: "gemini-2.5-pro-preview-05-06",
      createAi: createGoogleGenerativeAI,
    },
    {
      name: "gemini-2.5-flash-preview-04-17",
      createAi: createGoogleGenerativeAI,
    },
    {
      name: "gemini-2.0-pro-exp-02-05",
      createAi: createGoogleGenerativeAI,
    },
    {
      name: "gemini-2.0-flash-thinking-exp-01-21",
      createAi: createGoogleGenerativeAI,
    },
    {
      name: "gemini-2.5-flash-preview-05-20",
      createAi: createGoogleGenerativeAI,
    },
    {
      name: "gemini-2.5-flash-lite-preview-06-17",
      createAi: createGoogleGenerativeAI,
    },
    // AWS Bedrock models - Claude (using inference profiles for cross-region routing)
    // Claude 3.5 models
    {
      name: "us.anthropic.claude-3-5-sonnet-20240620-v1:0",
      createAi: createAmazonBedrock,
    },
    {
      name: "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
      createAi: createAmazonBedrock,
    },
    {
      name: "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
      createAi: createAmazonBedrock,
    },
    // Claude 4 models
    {
      name: "us.anthropic.claude-sonnet-4-20250514-v1:0",
      createAi: createAmazonBedrock,
    },
    {
      name: "global.anthropic.claude-sonnet-4-20250514-v1:0",
      createAi: createAmazonBedrock,
    },
    {
      name: "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
      createAi: createAmazonBedrock,
    },
    {
      name: "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
      createAi: createAmazonBedrock,
    },
    {
      name: "us.anthropic.claude-opus-4-20250514-v1:0",
      createAi: createAmazonBedrock,
    },
    {
      name: "us.anthropic.claude-opus-4-1-20250805-v1:0",
      createAi: createAmazonBedrock,
    },
    // AWS Bedrock models - Qwen
    {
      name: "qwen.qwen3-coder-30b-a3b-v1:0",
      createAi: createAmazonBedrock,
    },
    {
      name: "qwen.qwen3-32b-v1:0",
      createAi: createAmazonBedrock,
    },
  ],
};

export type InferenceConfig = {
  prompt: string;
  temperature?: number;
  system?: string;
  schema: z.ZodObject<any, any>;
};

export interface AIProvider {
  runInference(params: InferenceConfig): Promise<any>;
}

class AIProviderFactory {
  static getProvider(
    provider: AIProviderType,
    modelConfig: ModelConfig
  ): AIProvider {
    switch (provider) {
      case AIProviderType["AI_SDK"]:
        if (!modelConfig.createAi) {
          throw new Error(
            `No createAi function found for model ${modelConfig.name}`
          );
        }
        return new AISDKProvider(modelConfig.createAi, modelConfig.name);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }
}

type ModelConfig = {
  name: string;
  createAi?: any;
  temperature?: number;
};

export async function runPrompt({
  prompt,
  systemPrompt,
  schema,
}: {
  prompt: string;
  systemPrompt?: string;
  schema: z.ZodObject<any, any>;
}) {
  if (
    !Object.values(AIProviderType).includes(
      config.llmProvider as AIProviderType
    )
  ) {
    throw new Error(
      `Unknown LLM provider: ${
        config.llmProvider
      }. Valid providers are: ${Object.keys(AIProviderType).join(", ")}`
    );
  }
  const providerType = config.llmProvider as AIProviderType;
  const providerModels = LLM_MODELS[providerType];
  const modelConfig = providerModels.find((m) => m.name === config.llmModel);
  if (!modelConfig) {
    throw new Error(
      `Unknown LLM model: ${config.llmModel}. For provider ${
        config.llmProvider
      }, supported models are: ${providerModels.map((m) => m.name).join(", ")}`
    );
  }

  // Get the appropriate provider for this model
  const provider = AIProviderFactory.getProvider(providerType, modelConfig);

  // Run the inference using the provider
  return await provider.runInference({
    prompt,
    temperature: modelConfig.temperature,
    system: systemPrompt,
    schema,
  });
}
