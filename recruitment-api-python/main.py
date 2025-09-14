from fastapi import FastAPI, UploadFile, File, HTTPException, Request, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import tempfile
import os
import time
from dotenv import load_dotenv
from openai import OpenAI
from openai.types.beta.threads.message_create_params import Attachment, AttachmentToolFileSearch
import json
import logging
import re
from pose_detector import process_interview_video
import httpx

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Recruitment API", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "*"],  # Add your frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup templates and static files
templates = Jinja2Templates(directory="templates")

# Create directories if they don't exist
os.makedirs("templates", exist_ok=True)
os.makedirs("static", exist_ok=True)
os.makedirs("uploads/interviews", exist_ok=True)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  # Service role key for server-side access

class CVAnalysisResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class CandidateScoreRequest(BaseModel):
    cv_data: Dict[str, Any]
    job_requirements: Dict[str, Any]
    application_id: Optional[str] = None

class CandidateScoreResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class InterviewQuestionsRequest(BaseModel):
    interview_token: str
    job_position: Optional[str] = "General"
    candidate_profile: Optional[Dict[str, Any]] = None

class InterviewQuestionsResponse(BaseModel):
    success: bool
    questions: Optional[List[Dict[str, Any]]] = None
    error: Optional[str] = None

class VideoAnalysisRequest(BaseModel):
    interview_token: str
    video_file_path: str
    question_id: int
    question_text: str
    evaluation_criteria: List[str]

class VideoAnalysisResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class InterviewStartRequest(BaseModel):
    token: str
    candidate_id: Optional[str] = None
    job_title: Optional[str] = "General"

class VideoUploadRequest(BaseModel):
    token: str
    question_id: int
    question_text: str

def get_or_create_assistant():
    """Get existing assistant or create new one"""
    try:
        # Try to find existing assistant
        assistants = client.beta.assistants.list()
        for assistant in assistants:
            if assistant.name == "CV Analysis Assistant":
                return assistant

        # Create new assistant if not found
        return client.beta.assistants.create(
            model="gpt-4o",
            description="You are a CV analysis assistant specialized in extracting structured information from resumes.",
            instructions="""You are a helpful assistant designed to analyze CVs and extract structured information.
            Always return valid JSON responses with the requested data structure.
            Be thorough in extracting all relevant information from the provided PDF files.""",
            tools=[{"type": "file_search"}],
            name="CV Analysis Assistant",
        )
    except Exception as e:
        logger.error(f"Error creating/getting assistant: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to initialize assistant: {str(e)}")

def extract_json_from_text(text: str) -> dict:
    """Extract JSON from assistant response text"""
    try:
        # Clean up the text - remove markdown formatting
        if "```json" in text:
            json_start = text.find("```json") + 7
            json_end = text.rfind("```")
            if json_end > json_start:
                text = text[json_start:json_end]

        # Find JSON object boundaries
        start_idx = text.find('{')
        if start_idx == -1:
            raise ValueError("No JSON object found")

        # Find the last closing brace
        end_idx = text.rfind('}') + 1
        if end_idx <= start_idx:
            raise ValueError("Invalid JSON structure")

        json_text = text[start_idx:end_idx].strip()

        # Parse JSON
        return json.loads(json_text)

    except Exception as e:
        logger.error(f"Failed to extract JSON from text: {str(e)}")
        logger.error(f"Text was: {text[:500]}...")
        raise ValueError(f"Failed to parse JSON response: {str(e)}")

def analyze_cv_with_assistant(file_content: bytes, filename: str, job_position: str = "General") -> Dict[str, Any]:
    """Analyze CV using OpenAI Assistant API"""

    uploaded_file = None
    thread = None

    try:
        # Save file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            temp_file.write(file_content)
            temp_file_path = temp_file.name

        # Upload file to OpenAI
        with open(temp_file_path, 'rb') as f:
            uploaded_file = client.files.create(
                file=f,
                purpose='assistants'
            )

        # Create thread
        thread = client.beta.threads.create()

        # Get assistant
        assistant = get_or_create_assistant()

        # Create prompt for CV analysis
        prompt = f"""
        Przeanalizuj załączone CV dla pozycji: {job_position}

        Wyciągnij następujące informacje i zwróć je w formacie JSON:

        {{
            "imie_nazwisko": "pełne imię i nazwisko",
            "numer_telefonu": "numer telefonu lub null",
            "email": "adres email",
            "miasto": "miasto zamieszkania",
            "lista_technologii": ["technologia1", "technologia2", "technologia3"],
            "wyksztalcenie": "wyzsze" lub "inne",
            "ile_lat_doswiadczenia": liczba lat doświadczenia zawodowego (jako liczba),
            "lista_umiejetnosci_miekkich": ["umiejętność1", "umiejętność2", "umiejętność3"]
        }}

        Zasady:
        - Jeśli nie znajdziesz danej informacji, użyj null lub pustej listy []
        - Dla wykształcenia: użyj "wyzsze" jeśli osoba ma licencjat, inżynier, magister, doktor itp., w przeciwnym razie "inne"
        - Lata doświadczenia: oblicz na podstawie dat pracy lub podanego doświadczenia
        - Technologie: wyciągnij wszystkie wymienione technologie, języki programowania, narzędzia
        - Umiejętności miękkie: wyciągnij soft skills jak komunikacja, praca w zespole, leadership itp.

        Zwróć TYLKO poprawny JSON, bez dodatkowego tekstu.
        """

        # Add message with file attachment
        client.beta.threads.messages.create(
            thread_id=thread.id,
            role='user',
            content=prompt,
            attachments=[
                Attachment(
                    file_id=uploaded_file.id,
                    tools=[AttachmentToolFileSearch(type='file_search')]
                )
            ]
        )

        # Run the thread
        run = client.beta.threads.runs.create_and_poll(
            thread_id=thread.id,
            assistant_id=assistant.id,
            timeout=300,  # 5 minutes
        )

        if run.status != "completed":
            raise Exception(f'Assistant run failed with status: {run.status}')

        # Get the response
        messages_cursor = client.beta.threads.messages.list(thread_id=thread.id)
        messages = [message for message in messages_cursor]

        if not messages:
            raise Exception("No response from assistant")

        message = messages[0]  # Latest message from assistant
        if not message.content or message.content[0].type != "text":
            raise Exception("Invalid response format from assistant")

        response_text = message.content[0].text.value
        logger.info(f"Assistant response: {response_text[:200]}...")

        # Extract JSON from response
        result = extract_json_from_text(response_text)

        return result

    except Exception as e:
        logger.error(f"Error in CV analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze CV: {str(e)}")

    finally:
        # Cleanup
        try:
            if uploaded_file:
                client.files.delete(uploaded_file.id)
                logger.info(f"Deleted uploaded file: {uploaded_file.id}")
        except Exception as e:
            logger.warning(f"Failed to delete uploaded file: {str(e)}")

        try:
            if 'temp_file_path' in locals():
                os.unlink(temp_file_path)
        except Exception as e:
            logger.warning(f"Failed to delete temp file: {str(e)}")

@app.get("/")
async def root():
    return {"message": "Recruitment API is running", "version": "1.0.0"}

@app.post("/api/analyze-cv", response_model=CVAnalysisResponse)
async def analyze_cv(
    file: UploadFile = File(...),
    job_position: str = "General"
):
    """
    Analyze CV file and extract structured information
    """
    # Validate file type
    if not file.filename.lower().endswith('.pdf'):
        return CVAnalysisResponse(
            success=False,
            error="Only PDF files are supported"
        )

    try:
        # Read file content
        content = await file.read()

        if len(content) == 0:
            return CVAnalysisResponse(
                success=False,
                error="Empty file provided"
            )

        # Analyze CV with OpenAI Assistant
        analysis_result = analyze_cv_with_assistant(content, file.filename, job_position)

        return CVAnalysisResponse(
            success=True,
            data=analysis_result
        )

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return CVAnalysisResponse(
            success=False,
            error=f"An unexpected error occurred: {str(e)}"
        )

def normalize_skill(skill: str) -> str:
    """Normalize skill name for better matching"""
    return skill.lower().strip().replace(' ', '').replace('.', '').replace('-', '').replace('_', '')

def get_skill_synonyms():
    """Return dictionary of skill synonyms for better matching"""
    return {
        'javascript': ['js', 'javascript', 'ecmascript', 'node', 'nodejs'],
        'python': ['python', 'python3', 'py'],
        'react': ['react', 'reactjs', 'react.js'],
        'sql': ['sql', 'mysql', 'postgresql', 'postgres', 'sqlite'],
        'css': ['css', 'css3', 'styling'],
        'html': ['html', 'html5', 'markup'],
        'java': ['java', 'jdk', 'jvm'],
        'csharp': ['c#', 'csharp', 'dotnet', '.net'],
        'typescript': ['typescript', 'ts'],
        'angular': ['angular', 'angularjs'],
        'vue': ['vue', 'vuejs', 'vue.js'],
        'docker': ['docker', 'containerization'],
        'kubernetes': ['kubernetes', 'k8s'],
        'aws': ['aws', 'amazon web services'],
        'git': ['git', 'github', 'gitlab', 'version control']
    }

def check_skill_match(required_skill: str, candidate_skills: List[str]) -> bool:
    """Check if required skill matches any candidate skill (with synonyms and fuzzy matching)"""
    required_normalized = normalize_skill(required_skill)
    synonyms = get_skill_synonyms()

    # Get all possible variations of the required skill
    skill_variations = [required_normalized]
    for key, variations in synonyms.items():
        if any(required_normalized in normalize_skill(var) or normalize_skill(var) in required_normalized
               for var in variations):
            skill_variations.extend([normalize_skill(var) for var in variations])

    # Check against candidate skills
    for candidate_skill in candidate_skills:
        candidate_normalized = normalize_skill(candidate_skill)

        # Direct match or contains match
        for variation in skill_variations:
            if (variation in candidate_normalized or
                candidate_normalized in variation or
                variation == candidate_normalized):
                return True

        # Partial match for longer skills (e.g., "machine learning" contains "learning")
        if len(required_normalized) > 3 and len(candidate_normalized) > 3:
            if required_normalized in candidate_normalized or candidate_normalized in required_normalized:
                return True

    return False

def calculate_candidate_score(cv_data: Dict[str, Any], job_requirements: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate candidate score based on CV data and job requirements"""

    try:
        must_have_reqs = job_requirements.get('requirements_must_have', [])
        nice_to_have_reqs = job_requirements.get('requirements_nice_to_have', [])
        scoring_formula = job_requirements.get('scoring_formula', {})

        # Support both Polish and English formats for CV data
        candidate_technologies = (
            cv_data.get('lista_technologii', []) or
            cv_data.get('ai_extracted', {}).get('technologies', []) or
            cv_data.get('technologies', [])
        )

        candidate_soft_skills = (
            cv_data.get('lista_umiejetnosci_miekkich', []) or
            cv_data.get('ai_extracted', {}).get('languages', []) or  # languages often contain soft skills
            cv_data.get('languages', []) or
            cv_data.get('soft_skills', [])
        )

        # Parse experience from various formats
        candidate_experience = cv_data.get('ile_lat_doswiadczenia', 0)
        if not candidate_experience:
            exp_str = (
                cv_data.get('ai_extracted', {}).get('experience', '') or
                cv_data.get('experience', '') or
                ''
            )
            # Extract number from strings like "8 lat doświadczenia", "5 years experience", etc.
            import re
            exp_match = re.search(r'(\d+)', str(exp_str))
            candidate_experience = int(exp_match.group(1)) if exp_match else 0

        # Parse education
        candidate_education = cv_data.get('wyksztalcenie', 'inne')
        if candidate_education == 'inne':
            edu_str = (
                cv_data.get('ai_extracted', {}).get('education', '') or
                cv_data.get('education', '') or
                ''
            ).lower()
            candidate_education = 'wyzsze' if any(word in edu_str for word in
                ['wyższe', 'wyzsze', 'university', 'bachelor', 'master', 'magister', 'licencjat']) else 'inne'

        # Combine all candidate skills for matching
        all_candidate_skills = candidate_technologies + candidate_soft_skills

        print(f"DEBUG: candidate_technologies: {candidate_technologies}")
        print(f"DEBUG: candidate_experience: {candidate_experience}")
        print(f"DEBUG: candidate_education: {candidate_education}")

        # Calculate must-have score
        must_have_score = 0
        must_have_matches = []
        total_must_have_weight = sum(req.get('weight', 1) for req in must_have_reqs) if must_have_reqs else 1

        # Bonus for having at least one must-have skill
        has_any_must_have = False

        for req in must_have_reqs:
            skill = req.get('skill', '')
            level = req.get('level', 'basic')
            weight = req.get('weight', 1)

            # Use improved skill matching
            has_skill = check_skill_match(skill, all_candidate_skills)

            if has_skill:
                has_any_must_have = True
                # If candidate has skill, assume they have it at required level
                level_score = 1.0  # Full score for having the skill
                must_have_score += (weight / total_must_have_weight) * level_score * 100
                must_have_matches.append({
                    'skill': req.get('skill'),
                    'required_level': level,
                    'match': True,
                    'weight': weight
                })
            else:
                must_have_matches.append({
                    'skill': req.get('skill'),
                    'required_level': level,
                    'match': False,
                    'weight': weight
                })

        # Bonus points for having at least one must-have skill (encourages broad candidates)
        if has_any_must_have and must_have_reqs:
            must_have_score = min(must_have_score + 30, 100)  # Bonus 30 points, max 100

        # Calculate nice-to-have score
        nice_to_have_score = 0
        nice_to_have_matches = []
        if nice_to_have_reqs:
            total_nice_weight = sum(req.get('weight', 1) for req in nice_to_have_reqs)
            for req in nice_to_have_reqs:
                skill = req.get('skill', '')
                weight = req.get('weight', 1)

                # Use improved skill matching
                has_skill = check_skill_match(skill, all_candidate_skills)

                if has_skill:
                    nice_to_have_score += (weight / total_nice_weight) * 100
                    nice_to_have_matches.append({'skill': req.get('skill'), 'match': True})
                else:
                    nice_to_have_matches.append({'skill': req.get('skill'), 'match': False})

        # Calculate experience score (more generous)
        experience_score = min(candidate_experience * 8, 40)  # Max 40 points for experience

        # Calculate education score
        education_score = 15 if candidate_education == 'wyzsze' else 8

        # Apply scoring formula weights (normalized to sum to 1.0)
        must_have_weight = scoring_formula.get('must_have_weight', 0.6)
        nice_to_have_weight = scoring_formula.get('nice_to_have_weight', 0.25)

        # Ensure weights don't exceed 1.0
        other_weight = max(0.15, 1.0 - must_have_weight - nice_to_have_weight)
        experience_weight = other_weight * 0.6  # 60% of remaining weight
        education_weight = other_weight * 0.4   # 40% of remaining weight

        # Calculate total score (maximum possible = 100)
        total_score = (
            (must_have_score / 100) * must_have_weight * 100 +
            (nice_to_have_score / 100) * nice_to_have_weight * 100 +
            (experience_score / 40) * experience_weight * 100 +
            (education_score / 15) * education_weight * 100
        )

        # Determine qualification threshold (very liberal)
        qualification_threshold = 20  # Very low threshold as requested
        qualified_for_interview = total_score >= qualification_threshold

        # Generate AI insights
        must_have_matched_count = len([m for m in must_have_matches if m['match']])
        must_have_total = len(must_have_matches)
        nice_to_have_matched_count = len([m for m in nice_to_have_matches if m['match']])

        ai_insights = {
            'summary': f"Kandydat uzyskał {total_score:.1f} punktów na 100 możliwych. Spełnia {must_have_matched_count}/{must_have_total} wymagań must-have.",
            'strengths': [],
            'areas_for_development': [],
            'interview_recommendation': 'qualified' if qualified_for_interview else 'not_qualified'
        }

        # Add specific insights
        if has_any_must_have:
            ai_insights['strengths'].append(f"Posiada {must_have_matched_count} z {must_have_total} kluczowych umiejętności")

        if must_have_matched_count >= must_have_total * 0.7:
            ai_insights['strengths'].append("Spełnia większość wymagań must-have")
        elif must_have_matched_count == 0:
            ai_insights['areas_for_development'].append("Brak kluczowych umiejętności technicznych")

        if nice_to_have_matched_count > 0:
            ai_insights['strengths'].append(f"Dodatkowe umiejętności: {nice_to_have_matched_count} nice-to-have")

        if candidate_experience >= 5:
            ai_insights['strengths'].append(f"Duże doświadczenie ({candidate_experience} lat)")
        elif candidate_experience >= 2:
            ai_insights['strengths'].append(f"Solidne doświadczenie ({candidate_experience} lat)")
        elif candidate_experience < 1:
            ai_insights['areas_for_development'].append("Ograniczone doświadczenie zawodowe")

        if candidate_education == 'wyzsze':
            ai_insights['strengths'].append("Wykształcenie wyższe")

        # Add recommendation reasoning
        if total_score >= 50:
            ai_insights['summary'] += " Silny kandydat."
        elif total_score >= 30:
            ai_insights['summary'] += " Obiecujący kandydat z potencjałem."
        elif total_score >= 20:
            ai_insights['summary'] += " Kandydat do rozważenia - fokus na soft skills."

        return {
            'total_score': round(total_score, 1),
            'must_have_score': round(must_have_score, 1),
            'nice_to_have_score': round(nice_to_have_score, 1),
            'experience_score': experience_score,
            'education_score': education_score,
            'qualified_for_interview': qualified_for_interview,
            'qualification_threshold': qualification_threshold,
            'must_have_matches': must_have_matches,
            'nice_to_have_matches': nice_to_have_matches,
            'ai_insights': ai_insights,
            'breakdown': {
                'must_have_percentage': round((must_have_score * must_have_weight / 100) * 100, 1),
                'nice_to_have_percentage': round((nice_to_have_score * nice_to_have_weight / 100) * 100, 1),
                'experience_percentage': round((experience_score * 0.1 / 100) * 100, 1),
                'education_percentage': round((education_score * 0.1 / 100) * 100, 1)
            }
        }

    except Exception as e:
        logger.error(f"Error calculating candidate score: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to calculate score: {str(e)}")

@app.post("/api/score-candidate", response_model=CandidateScoreResponse)
async def score_candidate(request: CandidateScoreRequest):
    """Score a candidate based on CV data and job requirements"""
    try:
        score_result = calculate_candidate_score(request.cv_data, request.job_requirements)

        # If qualified for interview, create AI interview link data
        if score_result['qualified_for_interview'] and request.application_id:
            import uuid
            interview_token = str(uuid.uuid4())

            # Add interview data to response
            score_result['ai_interview'] = {
                'interview_token': interview_token,
                'interview_url': f"/ai-interview/{interview_token}",
                'expires_at': None,  # No expiration for now
                'status': 'pending'
            }

        return CandidateScoreResponse(
            success=True,
            data=score_result
        )

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error in scoring: {str(e)}")
        return CandidateScoreResponse(
            success=False,
            error=f"An unexpected error occurred: {str(e)}"
        )

def generate_interview_questions(job_position: str = "General", candidate_profile: Dict[str, Any] = None) -> List[Dict[str, Any]]:
    """Generate AI interview questions focused on soft skills"""

    try:
        # Create prompt for generating interview questions
        prompt = f"""
        Wygeneruj 5 pytań do rozmowy kwalifikacyjnej AI dla pozycji: {job_position}

        Fokus na umiejętności miękkie, adaptability i learning potential.
        Pytania powinny pozwolić ocenić:
        1. Komunikację i jasność wypowiedzi
        2. Umiejętność uczenia się nowych rzeczy
        3. Radzenie sobie ze stresem i zmianą
        4. Pracę w zespole i współpracę
        5. Motywację i zaangażowanie

        Format odpowiedzi - zwróć TYLKO poprawny JSON:
        {{
            "questions": [
                {{
                    "id": 1,
                    "question": "treść pytania",
                    "category": "communication|learning|adaptability|teamwork|motivation",
                    "time_limit_seconds": 120,
                    "evaluation_criteria": ["kryterium1", "kryterium2"]
                }}
            ]
        }}

        Pytania powinny być:
        - Konkretne i praktyczne (np. "Opowiedz o sytuacji gdy...")
        - Pozwalające na storytelling
        - Ukierunkowane na potencjał, nie tylko doświadczenie
        - W języku polskim
        """

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "Jesteś ekspertem HR specjalizującym się w ocenie soft skills przez AI interviews."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=1500
        )

        # Extract JSON from response
        response_text = response.choices[0].message.content
        questions_data = extract_json_from_text(response_text)

        return questions_data.get("questions", [])

    except Exception as e:
        logger.error(f"Error generating interview questions: {str(e)}")
        # Fallback questions if AI fails
        return [
            {
                "id": 1,
                "question": "Opowiedz o sytuacji, kiedy musiałeś/aś szybko nauczyć się czegoś nowego. Jak podszedłeś/aś do tego wyzwania?",
                "category": "learning",
                "time_limit_seconds": 120,
                "evaluation_criteria": ["learning_approach", "adaptability", "problem_solving"]
            },
            {
                "id": 2,
                "question": "Opisz sytuację, w której otrzymałeś/aś feedback, który był trudny do przyjęcia. Jak zareagowałeś/aś?",
                "category": "adaptability",
                "time_limit_seconds": 120,
                "evaluation_criteria": ["feedback_reception", "growth_mindset", "emotional_intelligence"]
            },
            {
                "id": 3,
                "question": "Opowiedz o projekcie, w którym pracowałeś/aś w zespole. Jaka była Twoja rola i jak radziliście sobie z konfliktami?",
                "category": "teamwork",
                "time_limit_seconds": 120,
                "evaluation_criteria": ["collaboration", "conflict_resolution", "leadership"]
            },
            {
                "id": 4,
                "question": "Co Cię motywuje do pracy i rozwoju zawodowego? Jakie są Twoje cele na najbliższe 2 lata?",
                "category": "motivation",
                "time_limit_seconds": 120,
                "evaluation_criteria": ["intrinsic_motivation", "goal_setting", "career_vision"]
            },
            {
                "id": 5,
                "question": "Jak radzisz sobie ze stresem i presją czasu? Podaj konkretny przykład.",
                "category": "adaptability",
                "time_limit_seconds": 120,
                "evaluation_criteria": ["stress_management", "time_management", "resilience"]
            }
        ]

@app.post("/api/generate-interview-questions", response_model=InterviewQuestionsResponse)
async def generate_questions_endpoint(request: InterviewQuestionsRequest):
    """Generate interview questions for AI video interview"""
    try:
        questions = generate_interview_questions(
            job_position=request.job_position,
            candidate_profile=request.candidate_profile
        )

        return InterviewQuestionsResponse(
            success=True,
            questions=questions
        )

    except Exception as e:
        logger.error(f"Error in generate questions endpoint: {str(e)}")
        return InterviewQuestionsResponse(
            success=False,
            error=f"Failed to generate questions: {str(e)}"
        )

def analyze_video_response(video_file_path: str, question_text: str, evaluation_criteria: List[str]) -> Dict[str, Any]:
    """Analyze video response using Whisper for transcription and GPT-4 for soft skills evaluation"""

    try:
        
        with open(video_file_path, 'rb') as audio_file:
            transcript_response = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="text"
            )

        transcript = transcript_response if isinstance(transcript_response, str) else str(transcript_response)

        if not transcript or len(transcript.strip()) < 10:
            return {
                'transcript': transcript,
                'analysis': {
                    'overall_score': 1,
                    'communication_clarity': {'score': 1, 'comments': 'Niewystarczająca odpowiedź'},
                    'content_relevance': {'score': 1, 'comments': 'Zbyt krótka transkrypcja'},
                    'soft_skills_assessment': {
                        'emotional_intelligence': 1,
                        'adaptability': 1,
                        'problem_solving': 1,
                        'learning_mindset': 1,
                        'teamwork': 1,
                        'self_awareness': 1
                    },
                    'strengths': [],
                    'areas_for_development': ['Poprawa jakości odpowiedzi'],
                    'summary': "Niewystarczająca odpowiedź - zbyt krótka lub nieczytelna transkrypcja.",
                    'recommendation': 'not_recommend'
                }
            }

        # Step 2: Analyze soft skills using GPT-4
        analysis_prompt = f"""
        Przeanalizuj następującą odpowiedź kandydata na pytanie rekrutacyjne pod kątem umiejętności miękkich.

        PYTANIE: {question_text}

        TRANSKRYPCJA ODPOWIEDZI: {transcript}

        KRYTERIA OCENY: {', '.join(evaluation_criteria)}

        Oceń kandydata w skali 1-10 w następujących obszarach i zwróć TYLKO poprawny JSON:

        {{
            "transcript": "pełna transkrypcja",
            "analysis": {{
                "overall_score": liczba_1_10,
                "communication_clarity": {{
                    "score": liczba_1_10,
                    "comments": "komentarz o jasności komunikacji"
                }},
                "content_relevance": {{
                    "score": liczba_1_10,
                    "comments": "czy odpowiedź jest na temat"
                }},
                "soft_skills_assessment": {{
                    "emotional_intelligence": liczba_1_10,
                    "adaptability": liczba_1_10,
                    "problem_solving": liczba_1_10,
                    "learning_mindset": liczba_1_10,
                    "teamwork": liczba_1_10,
                    "self_awareness": liczba_1_10
                }},
                "strengths": ["mocna_strona_1", "mocna_strona_2"],
                "areas_for_development": ["obszar_do_rozwoju_1", "obszar_do_rozwoju_2"],
                "summary": "zwięzłe podsumowanie odpowiedzi kandydata w 2-3 zdaniach",
                "recommendation": "strongly_recommend|recommend|consider|not_recommend"
            }}
        }}

        Bądź precyzyjny ale konstruktywny w ocenie. Oceniaj potencjał, nie tylko obecne umiejętności.
        """

        analysis_response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": "Jesteś ekspertem HR specjalizującym się w ocenie umiejętności miękkich. Analizujesz odpowiedzi kandydatów w rozmowach kwalifikacyjnych AI."
                },
                {"role": "user", "content": analysis_prompt}
            ],
            temperature=0.3,
            max_tokens=2000
        )

        analysis_text = analysis_response.choices[0].message.content
        analysis_data = extract_json_from_text(analysis_text)

        return analysis_data

    except Exception as e:
        logger.error(f"Error analyzing video response: {str(e)}")
        # Return minimal analysis if AI fails - give baseline scores of 1
        return {
            'transcript': transcript or "Błąd podczas transkrypcji",
            'analysis': {
                'overall_score': 1,
                'communication_clarity': {'score': 1, 'comments': 'Nie udało się przeanalizować'},
                'content_relevance': {'score': 1, 'comments': 'Nie udało się przeanalizować'},
                'soft_skills_assessment': {
                    'emotional_intelligence': 1,
                    'adaptability': 1,
                    'problem_solving': 1,
                    'learning_mindset': 1,
                    'teamwork': 1,
                    'self_awareness': 1
                },
                'strengths': [],
                'areas_for_development': ['Wymagana ponowna analiza'],
                'summary': f"Błąd podczas analizy: {str(e)}",
                'recommendation': 'consider'
            }
        }

@app.post("/api/analyze-video-response", response_model=VideoAnalysisResponse)
async def analyze_video_endpoint(request: VideoAnalysisRequest):
    """Analyze video response for soft skills assessment"""
    try:
        if not os.path.exists(request.video_file_path):
            return VideoAnalysisResponse(
                success=False,
                error="Video file not found"
            )

        analysis_result = analyze_video_response(
            video_file_path=request.video_file_path,
            question_text=request.question_text,
            evaluation_criteria=request.evaluation_criteria
        )

        return VideoAnalysisResponse(
            success=True,
            data=analysis_result
        )

    except Exception as e:
        logger.error(f"Error in video analysis endpoint: {str(e)}")
        return VideoAnalysisResponse(
            success=False,
            error=f"Failed to analyze video: {str(e)}"
        )

# AI Interview Endpoints

@app.get("/ai-interview/{token}", response_class=HTMLResponse)
async def ai_interview_page(request: Request, token: str):
    """Serve AI interview page"""
    return templates.TemplateResponse("ai-interview.html", {"request": request, "token": token})

@app.post("/api/start-interview")
async def start_interview(request: InterviewStartRequest):
    """Initialize AI interview and generate questions"""
    try:
        # Generate interview questions
        questions = generate_interview_questions(
            job_position=request.job_title,
            candidate_profile=None
        )

        return {
            "success": True,
            "questions": questions,
            "token": request.token
        }

    except Exception as e:
        logger.error(f"Error starting interview: {str(e)}")
        return {
            "success": False,
            "error": f"Failed to start interview: {str(e)}"
        }

@app.post("/api/upload-video-chunk")
async def upload_video_chunk(
    video: UploadFile = File(...),
    token: str = Form(...),
    question_id: str = Form(...),
    question_text: str = Form(None)
):
    """Upload and process video chunk from interview"""
    try:
        if not video or not token or not question_id:
            return {"success": False, "error": "Missing required fields"}

        # Create interview directory
        interview_dir = f"uploads/interviews/{token}"
        os.makedirs(interview_dir, exist_ok=True)

        # Save video file
        video_filename = f"question_{question_id}.webm"
        video_path = os.path.join(interview_dir, video_filename)

        with open(video_path, "wb") as f:
            content = await video.read()
            f.write(content)

        print(f"Video saved: {video_path}")

        # Process video with pose detection (create processed version)
        try:
            processed_video_path = process_interview_video(video_path)
            if processed_video_path:
                print(f"Pose detection completed: {processed_video_path}")
            else:
                print("Pose detection failed, continuing with original video only")
        except Exception as e:
            print(f"Error in pose detection: {e}")
            # Continue without pose detection if it fails
            pass

        # Process video immediately (or queue for later processing)
        try:
            analysis_result = analyze_video_response(
                video_file_path=video_path,
                question_text=question_text or "",
                evaluation_criteria=["communication", "problem_solving", "adaptability"]
            )

            # Save analysis result
            analysis_path = os.path.join(interview_dir, f"analysis_{question_id}.json")
            with open(analysis_path, "w", encoding="utf-8") as f:
                import json
                json.dump(analysis_result, f, ensure_ascii=False, indent=2)

            return {
                "success": True,
                "message": "Video uploaded and analyzed successfully",
                "analysis": analysis_result
            }

        except Exception as analysis_error:
            logger.warning(f"Analysis failed for {video_path}: {str(analysis_error)}")
            # Still return success for upload, analysis can be retried later
            return {
                "success": True,
                "message": "Video uploaded successfully, analysis pending",
                "analysis_error": str(analysis_error)
            }

    except Exception as e:
        logger.error(f"Error uploading video chunk: {str(e)}")
        return {
            "success": False,
            "error": f"Failed to upload video: {str(e)}"
        }

@app.post("/api/evaluate-recruitment-task")
async def evaluate_recruitment_task(
    file: UploadFile = File(...),
    application_id: str = Form(...)
):
    """Evaluate recruitment task solution using GPT-4o"""
    try:
        if not file or not application_id:
            return {"success": False, "error": "Missing required fields"}

        # Read file content
        content = await file.read()
        file_content = content.decode('utf-8')

        print(f"Evaluating recruitment task for application: {application_id}")
        print(f"File: {file.filename}, Content: {file_content[:200]}...")

        # Evaluate with GPT-4o
        evaluation_result = evaluate_sql_solution(file_content)

        return {
            "success": True,
            "evaluation": evaluation_result,
            "application_id": application_id,
            "filename": file.filename
        }

    except Exception as e:
        print(f"Error evaluating recruitment task: {e}")
        return {"success": False, "error": str(e)}

def evaluate_sql_solution(solution: str) -> Dict[str, Any]:
    """Evaluate SQL solution using GPT-4o"""
    try:
        prompt = f"""
Oceń rozwiązanie zadania SQL. ZWRÓĆ TYLKO VALID JSON, bez dodatkowego tekstu.

ZADANIE: "Napisz zapytanie SQL aby wybrać wszystkie rekordy z tabeli orders"
ROZWIĄZANIE: {solution}

OCENA:
- SELECT * FROM orders = 5 punktów
- SELECT z błędami = 3 punkty
- Nie-SQL lub błędne = 0 punktów

ZWRÓĆ TYLKO JSON:
{{"score": <0-5>, "feedback": "<komentarz po polsku>", "is_correct": <true/false>}}
"""

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "Jesteś ekspertem SQL i rekruterem technicznym. Zwracasz tylko valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=500
        )

        result_text = response.choices[0].message.content.strip()

        print(f"GPT-4o response: {result_text}")

        # Try to parse JSON, with fallback
        import json
        try:
            # Try to extract JSON from response (in case there's extra text)
            start_idx = result_text.find('{')
            end_idx = result_text.rfind('}') + 1

            if start_idx >= 0 and end_idx > start_idx:
                json_str = result_text[start_idx:end_idx]
                result = json.loads(json_str)
            else:
                result = json.loads(result_text)

            return {
                "score": result.get("score", 0),
                "feedback": result.get("feedback", "Brak komentarza"),
                "is_correct": result.get("is_correct", False)
            }
        except json.JSONDecodeError as e:
            print(f"JSON parsing failed: {e}, response was: {result_text}")

            # Fallback: simple analysis based on content
            content_lower = solution.lower()
            if 'select * from orders' in content_lower or 'select*from orders' in content_lower:
                return {
                    "score": 5,
                    "feedback": "Poprawne rozwiązanie! SELECT * FROM orders",
                    "is_correct": True
                }
            elif 'select' in content_lower and 'orders' in content_lower:
                return {
                    "score": 3,
                    "feedback": "Częściowo poprawne - używa SELECT i tabeli orders, ale może mieć błędy składni",
                    "is_correct": False
                }
            else:
                return {
                    "score": 0,
                    "feedback": "Niepoprawne rozwiązanie lub nie jest to zapytanie SQL",
                    "is_correct": False
                }

    except Exception as e:
        print(f"Error in SQL evaluation: {e}")
        return {
            "score": 0,
            "feedback": "Błąd podczas oceny rozwiązania",
            "is_correct": False
        }

@app.post("/api/generate-candidate-summary")
async def generate_candidate_summary(
    application_id: str = Form(...),
    decision_type: str = Form(...)  # "offer" or "rejection"
):
    """Generate candidate decision email using GPT-4o"""
    try:
        if not application_id or not decision_type:
            return {"success": False, "error": "Missing required fields"}

        if decision_type not in ["offer", "rejection"]:
            return {"success": False, "error": "Invalid decision type"}

        print(f"Generating candidate summary for application: {application_id}, decision: {decision_type}")

        # Generate the email content
        email_content = await generate_decision_email(application_id, decision_type)

        if not email_content:
            return {"success": False, "error": "Failed to generate email content"}

        return {
            "success": True,
            "email_content": email_content,
            "application_id": application_id,
            "decision_type": decision_type
        }

    except Exception as e:
        print(f"Error generating candidate summary: {e}")
        return {"success": False, "error": str(e)}

async def fetch_application_data(application_id: str) -> Dict[str, Any]:
    """Fetch application data from Supabase"""
    try:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            print("Missing Supabase configuration")
            return None

        headers = {
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json"
        }

        # Fetch application with related data
        query = f"""
        id,total_score,cv_parsed_data,
        candidate:candidates(full_name,email),
        job_position:job_positions(title,requirements_must_have),
        interviews(ai_insights)
        """

        async with httpx.AsyncClient() as client_http:
            response = await client_http.get(
                f"{SUPABASE_URL}/rest/v1/applications",
                headers=headers,
                params={
                    "id": f"eq.{application_id}",
                    "select": query
                }
            )

            if response.status_code == 200:
                data = response.json()
                if data and len(data) > 0:
                    return data[0]

            print(f"Failed to fetch application data: {response.status_code}, {response.text}")
            return None

    except Exception as e:
        print(f"Error fetching application data: {e}")
        return None

async def generate_decision_email(application_id: str, decision_type: str) -> str:
    """Generate decision email using GPT-4o with real database data"""
    try:
        # Fetch real application data from database
        app_data = await fetch_application_data(application_id)

        if not app_data:
            print(f"No application data found for ID: {application_id}")
            return None

        # Extract real candidate data
        candidate_name = app_data.get('candidate', {}).get('full_name', 'Kandydat')
        job_title = app_data.get('job_position', {}).get('title', 'Stanowisko')

        # Extract technical skills from CV analysis
        cv_data = app_data.get('cv_parsed_data', {})
        technical_skills = []
        if cv_data.get('skills'):
            technical_skills.extend(cv_data['skills'])
        if cv_data.get('technologies'):
            technical_skills.extend(cv_data['technologies'])
        technical_skills_text = ', '.join(technical_skills) if technical_skills else "Umiejętności techniczne z CV"

        # Extract soft skills from AI interview
        soft_skills_text = "Umiejętności miękkie z wywiadu AI"
        weak_points_text = "Obszary do rozwoju"

        interviews = app_data.get('interviews', [])
        if interviews and len(interviews) > 0:
            ai_insights = interviews[0].get('ai_insights', {})
            if ai_insights.get('overall_assessment'):
                overall = ai_insights['overall_assessment']
                if overall.get('strengths'):
                    soft_skills_text = ', '.join(overall['strengths'])
                if overall.get('areas_for_improvement'):
                    weak_points_text = ', '.join(overall['areas_for_improvement'])

        candidate_data = {
            "name": candidate_name,
            "position": job_title,
            "technical_skills": technical_skills_text,
            "soft_skills": soft_skills_text,
            "weak_points": weak_points_text
        }

        if decision_type == "offer":
            prompt = f"""
Napisz profesjonalny email oferujący pracę kandydatowi.
Pokreśl jendą lub dwie wybrane rzeczy z jego mocnych stron technicznych i miękkich.
DANE KANDYDATA:
- Imię: {candidate_data['name']}
- Stanowisko: {candidate_data['position']}
- Mocne strony techniczne: {candidate_data['technical_skills']}
- Mocne strony miękkie: {candidate_data['soft_skills']}

WYMAGANIA:
- Ton: profesjonalny, pozytywny, zachęcający
- Podkreśl konkretne mocne strony kandydata
- Zaproponuj wynagrodzenie z przedziału ale tylko pełne kwoty: 10,000-15,000 PLN brutto
- Dodaj informacje o benefitach (elastyczne godziny, rozwój, zespół)
- Format: Subject + Body (gotowy do wysłania)

JĘZYK: Polski
"""
        else:  # rejection
            prompt = f"""
Napisz profesjonalny email odrzucający kandydaturę, ale konstruktywny.

DANE KANDYDATA:
- Imię: {candidate_data['name']}
- Stanowisko: {candidate_data['position']}
- Obszary do rozwoju: {candidate_data['weak_points']}

WYMAGANIA:
- Ton: profesjonalny, konstruktywny, motywujący
- Podziękuj za udział w procesie rekrutacyjnym
- Wskaż konkretne obszary do rozwoju
- Zachęć do rozwoju i ewentualnych przyszłych aplikacji
- Format: Subject + Body (gotowy do wysłania)

JĘZYK: Polski
"""

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "Jesteś ekspertem HR specjalizującym się w profesjonalnej komunikacji z kandydatami."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=800
        )

        email_content = response.choices[0].message.content.strip()
        return email_content

    except Exception as e:
        print(f"Error in email generation: {e}")
        return None

@app.post("/api/complete-interview")
async def complete_interview(request: Request):
    """Complete interview and send results via webhook"""
    try:
        body = await request.json()
        token = body.get("token")

        if not token:
            return {"success": False, "error": "Missing token"}

        logger.info(f"Completing interview for token: {token}")
        interview_dir = f"uploads/interviews/{token}"

        # Collect all analysis results
        analysis_files = [f for f in os.listdir(interview_dir) if f.startswith("analysis_")]

        overall_results = {
            "token": token,
            "completed_at": time.time(),
            "questions_analyzed": len(analysis_files),
            "overall_assessment": {},
            "detailed_results": [],
            "video_files": []  # List of video files for playback
        }

        # Process individual question results
        for analysis_file in analysis_files:
            with open(os.path.join(interview_dir, analysis_file), "r", encoding="utf-8") as f:
                analysis = json.load(f)
                overall_results["detailed_results"].append(analysis)

        # Calculate overall soft skills scores
        if overall_results["detailed_results"]:
            soft_skills = {}
            for result in overall_results["detailed_results"]:
                if "analysis" in result and "soft_skills_assessment" in result["analysis"]:
                    for skill, score in result["analysis"]["soft_skills_assessment"].items():
                        if skill not in soft_skills:
                            soft_skills[skill] = []
                        soft_skills[skill].append(score)

            # Average scores - if no scores, provide minimum baseline
            if soft_skills:
                overall_results["overall_assessment"] = {
                    skill: round(sum(scores) / len(scores), 1)
                    for skill, scores in soft_skills.items()
                }
            else:
                # Fallback: provide minimum baseline assessment if no soft skills were collected
                overall_results["overall_assessment"] = {
                    'emotional_intelligence': 1.0,
                    'adaptability': 1.0,
                    'problem_solving': 1.0,
                    'learning_mindset': 1.0,
                    'teamwork': 1.0,
                    'self_awareness': 1.0
                }
        else:
            # If no detailed results at all, provide minimum baseline
            overall_results["overall_assessment"] = {
                'emotional_intelligence': 1.0,
                'adaptability': 1.0,
                'problem_solving': 1.0,
                'learning_mindset': 1.0,
                'teamwork': 1.0,
                'self_awareness': 1.0
            }

        # Collect video files
        video_files = [f for f in os.listdir(interview_dir) if f.endswith('.webm')]
        overall_results["video_files"] = [
            {
                "question_id": f.split('_')[1].split('.')[0],  # Extract question ID from filename
                "filename": f,
                "video_url": f"/api/interview-video/{token}/{f.split('_')[1].split('.')[0]}"
            }
            for f in video_files
        ]

        # Send webhook to recruitment-ai with results
        try:
            import requests
            webhook_url = "http://localhost:3000/api/interview-webhook"
            logger.info(f"Sending webhook to {webhook_url} with token: {token}")
            logger.info(f"Webhook payload - questions: {len(overall_results['detailed_results'])}, assessment: {overall_results['overall_assessment']}")

            webhook_response = requests.post(webhook_url, json=overall_results, timeout=30)

            if webhook_response.status_code == 200:
                logger.info(f"Successfully sent webhook for interview {token}")
                webhook_result = webhook_response.json()
                logger.info(f"Webhook response: {webhook_result}")
            else:
                logger.warning(f"Webhook failed with status {webhook_response.status_code}")
                logger.warning(f"Webhook response: {webhook_response.text}")
        except Exception as webhook_error:
            logger.error(f"Failed to send webhook: {str(webhook_error)}")
            # Don't fail the whole process if webhook fails

        return {
            "success": True,
            "message": "Interview completed successfully",
            "results": overall_results
        }

    except Exception as e:
        logger.error(f"Error completing interview: {str(e)}")
        return {
            "success": False,
            "error": f"Failed to complete interview: {str(e)}"
        }

@app.get("/api/interview-video/{token}/{question_id}")
async def get_interview_video(token: str, question_id: str):
    """Serve interview video file"""
    try:
        video_path = f"uploads/interviews/{token}/question_{question_id}.webm"

        if not os.path.exists(video_path):
            raise HTTPException(status_code=404, detail="Video not found")

        from fastapi.responses import FileResponse
        return FileResponse(
            path=video_path,
            media_type="video/webm",
            filename=f"interview_q{question_id}.webm"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error serving video: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "recruitment-api"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port, reload=True)