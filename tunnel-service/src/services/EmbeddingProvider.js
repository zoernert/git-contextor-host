const axios = require('axios');

class EmbeddingProvider {
  constructor() {
    this.provider = process.env.EMBEDDING_PROVIDER || 'gemini';
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.model = process.env.EMBEDDING_MODEL || 'text-embedding-004';
  }

  async generateEmbedding(text) {
    if (this.provider === 'gemini') {
      return await this.generateGeminiEmbedding(text);
    } else if (this.provider === 'openai') {
      return await this.generateOpenAIEmbedding(text);
    } else {
      throw new Error(`Unsupported embedding provider: ${this.provider}`);
    }
  }

  async generateGeminiEmbedding(text) {
    if (!this.geminiApiKey) {
      throw new Error('Gemini API key not configured for embeddings');
    }

    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:embedContent?key=${this.geminiApiKey}`,
        {
          content: {
            parts: [{ text: text.slice(0, 8000) }]
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.embedding.values;
    } catch (error) {
      console.error('Gemini embedding generation failed:', error);
      throw new Error('Failed to generate Gemini embedding');
    }
  }

  async generateOpenAIEmbedding(text) {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key not configured for embeddings');
    }

    try {
      const response = await axios.post('https://api.openai.com/v1/embeddings', {
        model: this.model,
        input: text.slice(0, 8000)
      }, {
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.data[0].embedding;
    } catch (error) {
      console.error('OpenAI embedding generation failed:', error);
      throw new Error('Failed to generate OpenAI embedding');
    }
  }

  async generateMultipleEmbeddings(texts) {
    if (this.provider === 'gemini') {
      return await this.generateMultipleGeminiEmbeddings(texts);
    } else if (this.provider === 'openai') {
      return await this.generateMultipleOpenAIEmbeddings(texts);
    } else {
      throw new Error(`Unsupported embedding provider: ${this.provider}`);
    }
  }

  async generateMultipleGeminiEmbeddings(texts) {
    if (!this.geminiApiKey) {
      throw new Error('Gemini API key not configured for embeddings');
    }

    try {
      const embeddings = [];
      
      // Gemini API doesn't support batch processing, so we do sequential requests
      for (const text of texts) {
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:embedContent?key=${this.geminiApiKey}`,
          {
            content: {
              parts: [{ text: text.slice(0, 8000) }]
            }
          },
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        embeddings.push(response.data.embedding.values);
      }
      
      return embeddings;
    } catch (error) {
      console.error('Gemini embedding generation failed:', error);
      throw new Error('Failed to generate Gemini embeddings');
    }
  }

  async generateMultipleOpenAIEmbeddings(texts) {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key not configured for embeddings');
    }

    try {
      const response = await axios.post('https://api.openai.com/v1/embeddings', {
        model: this.model,
        input: texts.map(text => text.slice(0, 8000))
      }, {
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.data.map(item => item.embedding);
    } catch (error) {
      console.error('OpenAI embedding generation failed:', error);
      throw new Error('Failed to generate OpenAI embeddings');
    }
  }
}

module.exports = EmbeddingProvider;
