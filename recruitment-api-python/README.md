# Recruitment API - Python

Python FastAPI backend for CV analysis and recruitment automation.

## Features

- PDF CV text extraction
- OpenAI-powered CV analysis
- Structured candidate evaluation
- Interview question generation
- Job matching scores

## Setup

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure environment:**
   - Copy `.env.example` to `.env`
   - Add your OpenAI API key to `.env`

3. **Run the server:**
   ```bash
   python main.py
   ```

   Server will be available at `http://localhost:8000`

## API Endpoints

### GET /
Health check endpoint

### POST /api/analyze-cv
Analyze CV file and extract structured information

**Parameters:**
- `file`: PDF file upload
- `job_position`: Target job position
- `requirements`: Comma-separated requirements (optional)

**Response:**
```json
{
  "success": true,
  "data": {
    "personal_info": {
      "full_name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "location": "New York, NY",
      "linkedin": "linkedin.com/in/johndoe",
      "github": "github.com/johndoe"
    },
    "summary": "Experienced developer...",
    "experience": [...],
    "education": [...],
    "skills": {
      "technical": ["Python", "React"],
      "soft": ["Leadership", "Communication"],
      "languages": ["English", "Spanish"]
    },
    "matching_score": {
      "overall": 85,
      "technical_match": 80,
      "experience_match": 90,
      "education_match": 85
    },
    "strengths": ["Strong Python skills", "Leadership experience"],
    "gaps": ["Limited React experience"],
    "interview_questions": ["Tell us about your Python experience..."],
    "recommendation": "Strong candidate for senior role..."
  }
}
```

### POST /api/generate-interview-questions
Generate personalized interview questions based on CV analysis

### POST /api/score-candidate
Score candidate against specific job requirements

## Testing

Use the `test_api.py` script to test the endpoints:

```bash
python test_api.py
```

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key
- `PORT`: Server port (default: 8000)