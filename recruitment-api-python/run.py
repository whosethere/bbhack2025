#!/usr/bin/env python3

import uvicorn
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

if __name__ == "__main__":
    print("🚀 Starting Recruitment API...")
    print("📊 CV Analysis endpoint will be available at: http://localhost:8000/api/analyze-cv")
    print("🏥 Health check: http://localhost:8000/health")
    print("📖 API docs: http://localhost:8000/docs")
    print("")

    # Check if OpenAI API key is configured
    if not os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY") == "your_openai_api_key_here":
        print("⚠️  WARNING: OpenAI API key not configured!")
        print("   Please set OPENAI_API_KEY in .env file")
        print("")

    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )