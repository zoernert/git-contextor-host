class TokenCounter {
  count(text) {
    if (!text) return 0;
    
    // Rough approximation: 1 token ≈ 4 characters for English text
    // More accurate would be to use tiktoken or similar
    return Math.ceil(text.length / 4);
  }

  estimateTokens(results) {
    return results.reduce((total, result) => {
      return total + this.count(result.content || '');
    }, 0);
  }

  // More accurate token counting for specific models
  countTokensGPT4(text) {
    if (!text) return 0;
    
    // GPT-4 typically has ~3.5 chars per token
    return Math.ceil(text.length / 3.5);
  }

  countTokensClaude(text) {
    if (!text) return 0;
    
    // Claude typically has ~4.5 chars per token
    return Math.ceil(text.length / 4.5);
  }

  // Get token count based on model
  countForModel(text, model = 'gpt-4') {
    if (!text) return 0;
    
    switch (model.toLowerCase()) {
      case 'gpt-4':
      case 'gpt-4-turbo':
        return this.countTokensGPT4(text);
      case 'claude':
      case 'claude-3':
        return this.countTokensClaude(text);
      default:
        return this.count(text);
    }
  }
}

module.exports = TokenCounter;
