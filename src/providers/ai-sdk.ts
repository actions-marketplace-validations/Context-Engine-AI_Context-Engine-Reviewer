import { AIProvider, InferenceConfig } from "@/ai";
import config from "../config";
import { info } from "@actions/core";
import { generateObject } from "ai";

export class AISDKProvider implements AIProvider {
  private createAiFunc: any;
  private modelName: string;

  constructor(createAiFunc: any, modelName: string) {
    this.createAiFunc = createAiFunc;
    this.modelName = modelName;
  }

  async runInference({
    prompt,
    temperature,
    system,
    schema,
  }: InferenceConfig): Promise<any> {
    // Check if this is AWS Bedrock provider
    const isBedrockModel = this.modelName.includes('qwen.') ||
                           this.modelName.includes('anthropic.') ||
                           this.modelName.includes('meta.') ||
                           this.modelName.includes('amazon.');

    let llm;
    if (isBedrockModel && this.createAiFunc.name === 'createAmazonBedrock') {
      // AWS Bedrock uses different authentication
      const bedrockConfig: any = {
        region: process.env.AWS_REGION || 'us-east-1',
      };

      // Support both AWS credentials and Bedrock API keys
      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        bedrockConfig.accessKeyId = process.env.AWS_ACCESS_KEY_ID;
        bedrockConfig.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
        if (process.env.AWS_SESSION_TOKEN) {
          bedrockConfig.sessionToken = process.env.AWS_SESSION_TOKEN;
        }
      } else if (config.llmApiKey) {
        // Bedrock API key is passed as bearer token
        // Note: The AI SDK doesn't directly support Bedrock API keys yet
        // This will use the API key as if it were an access key
        bedrockConfig.accessKeyId = config.llmApiKey;
      }

      llm = this.createAiFunc(bedrockConfig);
    } else {
      // Other providers use apiKey
      llm = this.createAiFunc({ apiKey: config.llmApiKey });
    }

    // Use structured output for all supported models (including Bedrock Qwen)
    const { object, usage } = await generateObject({
      model: llm(this.modelName),
      prompt,
      temperature: temperature || 0,
      system,
      schema,
    });

    if (process.env.DEBUG) {
      info(`usage: \n${JSON.stringify(usage, null, 2)}`);
    }

    return object;
  }
}
