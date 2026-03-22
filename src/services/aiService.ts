import axios from 'axios';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export interface ImageGenerationResponse {
  data: Array<{
    url?: string;
    base64?: string;
  }>;
}

export interface SearchResultItem {
  url: string;
  name: string;
  snippet: string;
  host_name: string;
  rank: number;
  date: string;
  favicon: string;
}

class AIService {
  private apiKey: string;
  private baseURL: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '';
    this.baseURL = process.env.AI_BASE_URL || 'https://api.openai.com/v1';
  }

  async chatCompletions(messages: ChatMessage[]): Promise<ChatCompletionResponse> {
    try {
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: process.env.AI_MODEL || 'gpt-3.5-turbo',
          messages,
          temperature: 0.7,
          max_tokens: 2000,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('AI Service Error:', error.response?.data || error.message);
      throw new Error(`AI Service Error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async generateImage(prompt: string, size: string = '1024x1024'): Promise<ImageGenerationResponse> {
    try {
      const response = await axios.post(
        `${this.baseURL}/images/generations`,
        {
          model: 'dall-e-3',
          prompt,
          size,
          n: 1,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Image Generation Error:', error.response?.data || error.message);
      throw new Error(`Image Generation Error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async webSearch(query: string, num: number = 10): Promise<SearchResultItem[]> {
    // Mock implementation since web search requires specific API
    // You can integrate with Bing Search API, Google Search API, or similar
    try {
      // For now, return mock data
      return [
        {
          url: `https://example.com/search?q=${encodeURIComponent(query)}`,
          name: `Search results for: ${query}`,
          snippet: `This is a mock search result for the query: ${query}`,
          host_name: 'example.com',
          rank: 1,
          date: new Date().toISOString(),
          favicon: 'https://example.com/favicon.ico',
        },
      ];
    } catch (error: any) {
      console.error('Web Search Error:', error.message);
      throw new Error(`Web Search Error: ${error.message}`);
    }
  }

  async analyzePlugin(pluginData: any): Promise<any> {
    try {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: 'You are an AI assistant specialized in analyzing software plugins. Provide detailed analysis including functionality, quality assessment, and recommendations.',
        },
        {
          role: 'user',
          content: `Please analyze this plugin: ${JSON.stringify(pluginData, null, 2)}`,
        },
      ];

      const response = await this.chatCompletions(messages);
      return {
        analysis: response.choices[0]?.message?.content || 'Analysis not available',
        score: Math.floor(Math.random() * 40) + 60, // Mock score 60-100
        recommendations: [
          'Improve documentation',
          'Add more test coverage',
          'Optimize performance',
        ],
      };
    } catch (error: any) {
      console.error('Plugin Analysis Error:', error.message);
      throw new Error(`Plugin Analysis Error: ${error.message}`);
    }
  }

  async generatePluginDescription(pluginInfo: any): Promise<string> {
    try {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: 'You are an AI assistant specialized in writing compelling plugin descriptions. Create engaging, clear, and professional descriptions.',
        },
        {
          role: 'user',
          content: `Generate a professional description for this plugin: ${JSON.stringify(pluginInfo, null, 2)}`,
        },
      ];

      const response = await this.chatCompletions(messages);
      return response.choices[0]?.message?.content || 'Description not available';
    } catch (error: any) {
      console.error('Description Generation Error:', error.message);
      throw new Error(`Description Generation Error: ${error.message}`);
    }
  }
}

export const aiService = new AIService();