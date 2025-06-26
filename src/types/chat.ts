export interface User {
  _id: string;
  userID: string;
  email: string;
  user_info: {
    FIRST_NAME: string;
    LAST_NAME: string;
    AGE?: string;
    gender?: string;
    height?: number;
    weight?: number;
  };
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  conversationId: string;
  userQuery: string;
  langChainResponse: string;
  createdAt: string;
  updatedAt: string;
  feedback: string;
}

export interface ProcessedChat {
  summary: string;
  last_user_intent: string;
  sentiment: string;
  key_entities: string[];
  latest_metrics?: Record<string, any>;
  next_step?: {
    type: string;
    id: string;
    rationale: string;
  };
}

export interface ChatHistory {
  _id: string;
  userID: string;
  sessionID: string;
  chatHistory: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  isSummaryGenerated?: boolean;
  processedChat?: ProcessedChat;
}

export interface ChatSession {
  _id: string;
  userID: string;
  sessionHistory: Array<{
    sessionID: string;
    userQuery: string;
    langChainResponse: string;
    createdAt: string;
    updatedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}