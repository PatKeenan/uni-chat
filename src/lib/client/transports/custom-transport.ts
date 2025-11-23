import type { ChatTransport, UIMessage } from "ai";
import { CustomUIMessage } from "../types";

export class CustomTransport implements ChatTransport<UIMessage> {
  private apiKey: string;
  private modelId: string;
  private siteUrl?: string;
  private siteName?: string;
  private id: string;

  constructor(config: {
    apiKey: string;
    modelId: string;
    siteUrl?: string;
    siteName?: string;
  }) {
    this.apiKey = config.apiKey;
    this.modelId = config.modelId;
    this.siteUrl = config.siteUrl;
  }
}
