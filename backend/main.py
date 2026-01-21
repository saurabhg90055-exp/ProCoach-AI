import os
import uuid
import base64
import io
import re
import time
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import Optional, List
from groq import Groq
from dotenv import load_dotenv
import shutil
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy.orm import Session

# Import database and auth modules
from database import get_db, init_db, User, Interview, InterviewQuestion, UserSettings, APIUsage, UserXP, UserAchievement
from auth import (
    UserCreate, UserResponse, UserLogin, Token, PasswordChange, UserUpdate,
    create_user, authenticate_user, get_user_by_email, get_user_by_username,
    create_access_token, create_refresh_token, verify_token,
    get_current_user, get_current_user_required, get_password_hash, verify_password
)

# Load environment variables from .env file
load_dotenv()

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="AI Mock Interviewer API",
    description="Backend API for AI-powered mock interview practice",
    version="2.0.0"
)

# Add rate limiter exception handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Secure API key loading
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not found in environment variables!")

client = Groq(api_key=GROQ_API_KEY)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    init_db()
    print("🚀 AI Interviewer API started!")

# Health check endpoint for Docker/K8s
@app.get("/health")
async def health_check():
    """Health check endpoint for container orchestration"""
    return {
        "status": "healthy",
        "service": "ai-interviewer-api",
        "version": "2.0.0"
    }

# Store active interview sessions (in production, use Redis/Database)
interview_sessions = {}

# Company interview styles
COMPANY_STYLES = {
    "google": {
        "name": "Google",
        "style": """You interview like a Google engineer: Focus on algorithmic thinking, 
ask about time/space complexity, encourage thinking out loud, use "What if..." follow-ups.
Be friendly but rigorous. Ask about edge cases."""
    },
    "amazon": {
        "name": "Amazon",
        "style": """You interview like an Amazon engineer: Focus on Leadership Principles,
ask behavioral questions using STAR method, probe for customer obsession, ownership, and bias for action.
Ask "Tell me about a time when..." questions. Dig deep into specifics."""
    },
    "meta": {
        "name": "Meta",
        "style": """You interview like a Meta engineer: Focus on coding efficiency,
system design at scale, move fast mentality. Ask about trade-offs and real-world impact.
Be direct and focus on practical problem-solving."""
    },
    "microsoft": {
        "name": "Microsoft",
        "style": """You interview like a Microsoft engineer: Focus on problem-solving approach,
collaboration skills, growth mindset. Ask about how they'd work with teams.
Be supportive but thorough in technical assessment."""
    },
    "startup": {
        "name": "Startup",
        "style": """You interview like a startup CTO: Focus on versatility, 
ability to wear multiple hats, shipping quickly, and learning on the fly.
Ask about side projects and initiative. Be casual but assess deeply."""
    },
    "default": {
        "name": "Standard",
        "style": """You are a professional technical interviewer. Be fair, encouraging, 
and thorough in your assessment."""
    }
}

# Difficulty configurations
DIFFICULTY_CONFIGS = {
    "easy": {
        "description": "Entry-level questions, more hints provided",
        "prompt_modifier": """Ask entry-level questions suitable for junior developers or students.
Provide helpful hints when the candidate struggles. Be very encouraging.
Focus on fundamentals and basic concepts."""
    },
    "medium": {
        "description": "Standard interview difficulty",
        "prompt_modifier": """Ask standard interview questions suitable for mid-level developers.
Provide occasional hints if needed. Balance challenge with encouragement.
Include some follow-up questions to probe deeper."""
    },
    "hard": {
        "description": "Senior-level challenging questions",
        "prompt_modifier": """Ask challenging questions suitable for senior developers.
Expect thorough, detailed answers. Probe edge cases and trade-offs extensively.
Ask complex follow-ups and challenge assumptions. Be rigorous."""
    }
}

# Interview topic configurations
INTERVIEW_TOPICS = {
    "dsa": {
        "name": "Data Structures & Algorithms",
        "system_prompt": """You are a senior software engineer conducting a DSA interview. 
Ask questions about arrays, linked lists, trees, graphs, sorting, searching, dynamic programming.
Start with easier concepts and gradually increase difficulty based on candidate's responses.
Keep responses concise (under 50 words). Provide hints if the candidate is stuck."""
    },
    "system_design": {
        "name": "System Design",
        "system_prompt": """You are a principal engineer conducting a system design interview.
Ask about scalability, databases, caching, load balancing, microservices, API design.
Start with high-level architecture then drill down into specifics.
Keep responses concise (under 50 words). Guide the candidate through the design process."""
    },
    "behavioral": {
        "name": "Behavioral Interview",
        "system_prompt": """You are an HR manager conducting a behavioral interview using the STAR method.
Ask about leadership, teamwork, conflict resolution, challenges overcome, and career goals.
Listen for specific examples and follow up with clarifying questions.
Keep responses concise (under 50 words). Be empathetic and encouraging."""
    },
    "frontend": {
        "name": "Frontend Development",
        "system_prompt": """You are a senior frontend developer conducting a technical interview.
Ask about HTML, CSS, JavaScript, React, state management, performance optimization, accessibility.
Include practical scenario-based questions.
Keep responses concise (under 50 words). Correct misconceptions gently."""
    },
    "backend": {
        "name": "Backend Development",
        "system_prompt": """You are a senior backend developer conducting a technical interview.
Ask about APIs, databases, authentication, server architecture, security, and testing.
Include real-world problem-solving scenarios.
Keep responses concise (under 50 words). Probe deeper on interesting answers."""
    },
    "general": {
        "name": "General Technical",
        "system_prompt": """You are a professional technical interviewer. 
The user is a candidate. Keep your responses short (under 30 words). 
Correct them if they are wrong, or ask a follow-up question.
Be encouraging but honest about areas for improvement."""
    }
}

class InterviewSession(BaseModel):
    topic: str = "general"
    difficulty: str = "medium"  # easy, medium, hard
    company_style: str = "default"  # google, amazon, meta, microsoft, startup, default
    enable_tts: bool = True  # Enable text-to-speech
    job_description: Optional[str] = None  # Job description for tailored questions
    resume_text: Optional[str] = None  # Parsed resume text
    duration_minutes: int = 30  # Interview duration in minutes

class Message(BaseModel):
    role: str
    content: str

class TextToSpeechRequest(BaseModel):
    text: str

class ResumeParseRequest(BaseModel):
    text: str

@app.get("/")
def health_check():
    return {"status": "active", "message": "AI Interviewer Backend v2.0", "version": "2.0.0"}


# ============== AUTHENTICATION ENDPOINTS ==============

@app.post("/auth/register", response_model=Token)
@limiter.limit("5/minute")
async def register(request: Request, user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user account"""
    # Check if email already exists
    if get_user_by_email(db, user_data.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if username already exists
    if get_user_by_username(db, user_data.username):
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # Validate password strength
    if len(user_data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    # Create user
    user = create_user(db, user_data)
    
    # Generate tokens
    access_token = create_access_token(data={"sub": user.id, "email": user.email})
    refresh_token = create_refresh_token(data={"sub": user.id, "email": user.email})
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@app.post("/auth/login", response_model=Token)
@limiter.limit("10/minute")
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login with email and password"""
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": user.id, "email": user.email})
    refresh_token = create_refresh_token(data={"sub": user.id, "email": user.email})
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@app.post("/auth/refresh", response_model=Token)
async def refresh_token(refresh_token: str, db: Session = Depends(get_db)):
    """Refresh access token using refresh token"""
    token_data = verify_token(refresh_token, token_type="refresh")
    if not token_data:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    
    user = db.query(User).filter(User.id == token_data.user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    new_access_token = create_access_token(data={"sub": user.id, "email": user.email})
    new_refresh_token = create_refresh_token(data={"sub": user.id, "email": user.email})
    
    return Token(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@app.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user_required)):
    """Get current user info"""
    return UserResponse.model_validate(current_user)


@app.put("/auth/me", response_model=UserResponse)
async def update_me(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """Update current user profile"""
    if user_update.full_name is not None:
        current_user.full_name = user_update.full_name
    if user_update.email is not None:
        # Check if email is already in use by another user
        existing = get_user_by_email(db, user_update.email)
        if existing and existing.id != current_user.id:
            raise HTTPException(status_code=400, detail="Email already in use")
        current_user.email = user_update.email
    
    db.commit()
    db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@app.post("/auth/change-password")
async def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """Change user password"""
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    if len(password_data.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    
    current_user.hashed_password = get_password_hash(password_data.new_password)
    db.commit()
    
    return {"message": "Password changed successfully"}


@app.get("/auth/settings")
async def get_settings(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """Get user settings"""
    settings = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()
    if not settings:
        settings = UserSettings(user_id=current_user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    return {
        "preferred_topic": settings.preferred_topic,
        "preferred_company": settings.preferred_company,
        "preferred_difficulty": settings.preferred_difficulty,
        "preferred_duration": settings.preferred_duration,
        "enable_tts": settings.enable_tts,
        "theme": settings.theme
    }


@app.put("/auth/settings")
async def update_settings(
    settings_data: dict,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """Update user settings"""
    settings = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()
    if not settings:
        settings = UserSettings(user_id=current_user.id)
        db.add(settings)
    
    for key, value in settings_data.items():
        if hasattr(settings, key):
            setattr(settings, key, value)
    
    db.commit()
    return {"message": "Settings updated successfully"}


# ============== INTERVIEW ENDPOINTS ==============

@app.get("/topics")
def get_topics():
    """Return available interview topics"""
    return {
        "topics": [
            {"id": key, "name": value["name"]} 
            for key, value in INTERVIEW_TOPICS.items()
        ]
    }

@app.get("/companies")
def get_companies():
    """Return available company interview styles"""
    return {
        "companies": [
            {"id": key, "name": value["name"]} 
            for key, value in COMPANY_STYLES.items()
        ]
    }

@app.get("/difficulties")
def get_difficulties():
    """Return available difficulty levels"""
    return {
        "difficulties": [
            {"id": key, "name": key.capitalize(), "description": value["description"]} 
            for key, value in DIFFICULTY_CONFIGS.items()
        ]
    }

@app.post("/tts")
async def text_to_speech(request: TextToSpeechRequest):
    """Convert text to speech using Groq's TTS"""
    try:
        # Use Groq's text-to-speech
        response = client.audio.speech.create(
            model="playht-tts",
            voice="Fritz-PlayHT",  # Professional male voice
            input=request.text,
            response_format="wav"
        )
        
        # Return audio as streaming response
        audio_bytes = response.read()
        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/wav",
            headers={"Content-Disposition": "inline; filename=speech.wav"}
        )
    except Exception as e:
        print(f"TTS Error: {e}")
        raise HTTPException(status_code=500, detail=f"TTS failed: {str(e)}")

@app.post("/resume/parse")
async def parse_resume(file: UploadFile = File(...)):
    """Parse resume file and extract key information using AI"""
    try:
        # Read file content
        content = await file.read()
        
        # For text files, decode directly
        if file.filename.endswith('.txt'):
            resume_text = content.decode('utf-8')
        else:
            # For PDF/DOC, we'll use a simple text extraction
            # In production, use proper PDF parsing library
            try:
                resume_text = content.decode('utf-8', errors='ignore')
            except:
                resume_text = str(content)
        
        # Use AI to extract key information from resume
        extraction_prompt = f"""Analyze this resume and extract key information in a structured format:

RESUME TEXT:
{resume_text[:4000]}  # Limit to 4000 chars

Extract and return in this exact format:
NAME: [candidate name]
EXPERIENCE_YEARS: [total years of experience]
CURRENT_ROLE: [current or most recent job title]
SKILLS: [comma-separated list of top 10 technical skills]
EDUCATION: [highest degree and field]
KEY_PROJECTS: [2-3 notable projects, brief description]
STRENGTHS: [3 key strengths based on resume]
AREAS_TO_PROBE: [3 areas an interviewer should ask about]

Be concise and factual."""

        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": extraction_prompt}],
            temperature=0.3,
            max_tokens=500
        )
        
        parsed_info = completion.choices[0].message.content
        
        return {
            "success": True,
            "raw_text": resume_text[:2000],  # Return truncated raw text
            "parsed_info": parsed_info,
            "filename": file.filename
        }
        
    except Exception as e:
        print(f"Resume Parse Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to parse resume: {str(e)}")

@app.post("/job/analyze")
async def analyze_job_description(job_description: str = Form(...)):
    """Analyze job description and extract key requirements"""
    try:
        analysis_prompt = f"""Analyze this job description and extract key information:

JOB DESCRIPTION:
{job_description[:3000]}

Extract and return:
1. ROLE: Job title and level
2. KEY_REQUIREMENTS: Top 5 must-have skills/qualifications
3. NICE_TO_HAVE: Optional skills mentioned
4. INTERVIEW_FOCUS: What topics an interviewer should focus on
5. SUGGESTED_QUESTIONS: 3 specific questions to ask based on this JD

Be concise and actionable."""

        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": analysis_prompt}],
            temperature=0.3,
            max_tokens=400
        )
        
        analysis = completion.choices[0].message.content
        
        return {
            "success": True,
            "analysis": analysis
        }
        
    except Exception as e:
        print(f"Job Analysis Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze job description: {str(e)}")

@app.post("/interview/start")
@limiter.limit("20/minute")
async def start_interview(
    request: Request,
    session: InterviewSession,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Start a new interview session"""
    session_id = str(uuid.uuid4())
    start_time = time.time()
    
    topic_config = INTERVIEW_TOPICS.get(session.topic, INTERVIEW_TOPICS["general"])
    company_config = COMPANY_STYLES.get(session.company_style, COMPANY_STYLES["default"])
    difficulty_config = DIFFICULTY_CONFIGS.get(session.difficulty, DIFFICULTY_CONFIGS["medium"])
    
    # Build comprehensive system prompt
    full_system_prompt = f"""{topic_config["system_prompt"]}

{company_config["style"]}

{difficulty_config["prompt_modifier"]}"""

    # Add resume context if provided
    if session.resume_text:
        full_system_prompt += f"""

CANDIDATE'S RESUME INFORMATION:
{session.resume_text[:2000]}

Use this information to:
- Ask about specific projects mentioned in their resume
- Probe deeper into their claimed skills
- Reference their experience when asking follow-up questions
- Tailor difficulty based on their experience level"""

    # Add job description context if provided
    if session.job_description:
        full_system_prompt += f"""

TARGET JOB DESCRIPTION:
{session.job_description[:1500]}

Focus your questions on:
- Skills and requirements mentioned in this job description
- Scenarios relevant to this role
- Assess fit for this specific position"""

    full_system_prompt += """

IMPORTANT INSTRUCTIONS:
- After each candidate response, provide a brief score (1-10) at the END of your response in this exact format: [SCORE: X/10]
- The score should reflect: accuracy, depth, communication clarity, and relevance
- Keep your main response under 60 words, then add the score
- Adapt your next question difficulty based on their performance"""
    
    # Create personalized opening message
    if session.resume_text and "NAME:" in session.resume_text:
        # Try to extract name from parsed resume
        name_match = re.search(r'NAME:\s*([^\n]+)', session.resume_text)
        candidate_name = name_match.group(1).strip() if name_match else "there"
    else:
        candidate_name = "there"
    
    # Create opening message based on topic and company
    base_openings = {
        "dsa": f"Hello {candidate_name}! I'll be your interviewer today, conducting this in the style of {company_config['name']}. Let's start with Data Structures & Algorithms. Can you explain what a hash table is and when you'd use one?",
        "system_design": f"Welcome {candidate_name}! I'm conducting this system design interview {company_config['name']}-style. Let's start: How would you design a URL shortener like bit.ly?",
        "behavioral": f"Hi {candidate_name}! I'm excited to learn more about you today. This will be a {company_config['name']}-style behavioral interview. Tell me about yourself and what brings you to this opportunity?",
        "frontend": f"Hello {candidate_name}! Let's dive into frontend development, {company_config['name']}-style. Can you explain the difference between let, const, and var in JavaScript?",
        "backend": f"Welcome {candidate_name}! Let's explore backend development with a {company_config['name']} interview approach. What's the difference between SQL and NoSQL databases?",
        "general": f"Hello {candidate_name}! Welcome to your {company_config['name']}-style mock interview. Tell me about a recent project you've worked on."
    }
    
    opening = base_openings.get(session.topic, base_openings["general"])
    
    # If we have resume info, make opening more personal
    if session.resume_text and "CURRENT_ROLE:" in session.resume_text:
        role_match = re.search(r'CURRENT_ROLE:\s*([^\n]+)', session.resume_text)
        if role_match:
            current_role = role_match.group(1).strip()
            opening = f"Hello {candidate_name}! I see you're currently working as a {current_role}. I'll be conducting this {company_config['name']}-style {topic_config['name']} interview. Let's begin - tell me about a challenging problem you've solved recently."
    
    interview_sessions[session_id] = {
        "topic": session.topic,
        "topic_name": topic_config["name"],
        "difficulty": session.difficulty,
        "company_style": session.company_style,
        "company_name": company_config["name"],
        "system_prompt": full_system_prompt,
        "history": [],
        "scores": [],
        "question_count": 0,
        "enable_tts": session.enable_tts,
        "current_difficulty_adjustment": 0,
        "start_time": start_time,
        "duration_minutes": session.duration_minutes,
        "has_resume": bool(session.resume_text),
        "has_job_description": bool(session.job_description),
        "user_id": current_user.id if current_user else None
    }
    
    interview_sessions[session_id]["history"].append({"role": "assistant", "content": opening})
    interview_sessions[session_id]["question_count"] = 1
    
    # Save to database
    db_interview = Interview(
        session_id=session_id,
        user_id=current_user.id if current_user else None,
        topic=session.topic,
        topic_name=topic_config["name"],
        company_style=session.company_style,
        company_name=company_config["name"],
        difficulty=session.difficulty,
        duration_minutes=session.duration_minutes,
        question_count=1,
        transcript=[{"role": "assistant", "content": opening}],
        has_resume=bool(session.resume_text),
        has_job_description=bool(session.job_description),
        status="active"
    )
    db.add(db_interview)
    db.commit()
    
    return {
        "session_id": session_id,
        "topic": topic_config["name"],
        "company": company_config["name"],
        "difficulty": session.difficulty,
        "opening_message": opening,
        "enable_tts": session.enable_tts,
        "duration_minutes": session.duration_minutes,
        "has_resume": bool(session.resume_text),
        "has_job_description": bool(session.job_description)
    }

@app.post("/interview/{session_id}/analyze")
@limiter.limit("30/minute")
async def analyze_audio(
    request: Request,
    session_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Process audio and continue the interview conversation"""
    
    if session_id not in interview_sessions:
        raise HTTPException(status_code=404, detail="Session not found. Please start a new interview.")
    
    session = interview_sessions[session_id]
    
    try:
        # 1. Save the temporary file
        temp_filename = f"temp_audio_{session_id}.webm"
        with open(temp_filename, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 2. Transcribe the audio (Speech to Text)
        print("Transcribing...")
        with open(temp_filename, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                file=(temp_filename, audio_file.read()),
                model="whisper-large-v3",
                response_format="json",
                language="en",
                temperature=0.0 
            )
        user_text = transcription.text
        print(f"User said: {user_text}")
        
        # Add user message to history
        session["history"].append({"role": "user", "content": user_text})

        # 3. Build messages with full conversation history
        messages = [{"role": "system", "content": session["system_prompt"]}]
        messages.extend(session["history"])
        
        # 4. Generate AI Response with context
        print("Thinking...")
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.7,
            max_tokens=200
        )
        ai_response = completion.choices[0].message.content
        print(f"AI said: {ai_response}")
        
        # 5. Extract score from response
        import re
        score = None
        score_match = re.search(r'\[SCORE:\s*(\d+)/10\]', ai_response)
        if score_match:
            score = int(score_match.group(1))
            session["scores"].append(score)
            # Remove score from displayed response (keep it clean for user)
            display_response = re.sub(r'\s*\[SCORE:\s*\d+/10\]', '', ai_response).strip()
        else:
            display_response = ai_response
        
        # 6. Calculate running average and adaptive difficulty
        avg_score = sum(session["scores"]) / len(session["scores"]) if session["scores"] else None
        
        # Adaptive difficulty adjustment
        if avg_score:
            if avg_score >= 8 and session["current_difficulty_adjustment"] < 2:
                session["current_difficulty_adjustment"] += 1
            elif avg_score <= 4 and session["current_difficulty_adjustment"] > -2:
                session["current_difficulty_adjustment"] -= 1
        
        # Add AI response to history (with score for context)
        session["history"].append({"role": "assistant", "content": ai_response})
        session["question_count"] += 1
        
        # Cleanup temp file
        if os.path.exists(temp_filename):
            os.remove(temp_filename)

        return {
            "user_text": user_text, 
            "ai_response": display_response,
            "question_number": session["question_count"],
            "history_length": len(session["history"]),
            "score": score,
            "average_score": round(avg_score, 1) if avg_score else None,
            "total_scores": len(session["scores"]),
            "difficulty_trend": "harder" if session["current_difficulty_adjustment"] > 0 else ("easier" if session["current_difficulty_adjustment"] < 0 else "stable")
        }

    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/interview/{session_id}/end")
async def end_interview(session_id: str, db: Session = Depends(get_db)):
    """End the interview and get summary"""
    
    if session_id not in interview_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = interview_sessions[session_id]
    
    # Calculate score analytics
    scores = session.get("scores", [])
    avg_score = round(sum(scores) / len(scores), 1) if scores else None
    min_score = min(scores) if scores else None
    max_score = max(scores) if scores else None
    
    # Calculate duration
    start_time = session.get("start_time", time.time())
    duration_seconds = int(time.time() - start_time)
    
    # Generate summary using AI
    score_info = f"\nScores received: {scores}\nAverage score: {avg_score}/10" if scores else ""
    
    summary_prompt = f"""Based on this interview conversation, provide a detailed performance summary:
    
Interview Topic: {session.get('topic_name', session['topic'])}
Company Style: {session.get('company_name', 'Standard')}
Difficulty: {session['difficulty']}
Number of exchanges: {session['question_count']}{score_info}

Conversation:
{chr(10).join([f"{msg['role'].upper()}: {msg['content']}" for msg in session['history']])}

Provide a structured assessment:
1. **Overall Impression** (2-3 sentences)
2. **Technical Accuracy** - Rate and explain
3. **Communication Skills** - Rate and explain  
4. **Problem-Solving Approach** - Rate and explain
5. **Top 3 Strengths**
6. **Top 3 Areas for Improvement**
7. **Specific Recommendations** for next steps
8. **Final Score**: X/10

Be constructive, specific, and actionable."""

    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": summary_prompt}],
            temperature=0.5,
            max_tokens=500
        )
        summary = completion.choices[0].message.content
    except Exception:
        summary = "Unable to generate summary. Please try again."
    
    # Extract strengths and improvements from summary (basic extraction)
    strengths = []
    improvements = []
    
    # Build comprehensive result
    result = {
        "session_id": session_id,
        "topic": session.get("topic_name", session["topic"]),
        "company_style": session.get("company_name", "Standard"),
        "difficulty": session["difficulty"],
        "total_questions": session["question_count"],
        "scores": {
            "individual": scores,
            "average": avg_score,
            "min": min_score,
            "max": max_score,
            "trend": "improving" if len(scores) >= 2 and scores[-1] > scores[0] else ("declining" if len(scores) >= 2 and scores[-1] < scores[0] else "stable")
        },
        "summary": summary,
        "history": session["history"],
        "duration_seconds": duration_seconds
    }
    
    # Update database record if exists, or create new one
    db_interview = db.query(Interview).filter(Interview.session_id == session_id).first()
    if db_interview:
        db_interview.scores = scores
        db_interview.average_score = avg_score
        db_interview.transcript = session["history"]
        db_interview.summary = summary
        db_interview.question_count = session["question_count"]
        db_interview.ended_at = datetime.utcnow()
        db_interview.duration_seconds = duration_seconds
        db_interview.status = "completed"
        db.commit()
    else:
        # Create new interview record (without user_id - will be associated when user saves)
        db_interview = Interview(
            session_id=session_id,
            user_id=None,  # Will be set when user explicitly saves
            topic=session.get("topic", "general"),
            topic_name=session.get("topic_name", "General Technical"),
            company_style=session.get("company_style", "default"),
            company_name=session.get("company_name", "Standard"),
            difficulty=session.get("difficulty", "medium"),
            duration_minutes=session.get("duration_minutes", 30),
            question_count=session["question_count"],
            scores=scores,
            average_score=avg_score,
            transcript=session["history"],
            summary=summary,
            has_resume=bool(session.get("resume_text")),
            has_job_description=bool(session.get("job_description")),
            started_at=datetime.fromtimestamp(session.get("start_time", time.time())),
            ended_at=datetime.utcnow(),
            duration_seconds=duration_seconds,
            status="completed"
        )
        db.add(db_interview)
        db.commit()
    
    del interview_sessions[session_id]
    
    return result

@app.get("/interview/{session_id}/status")
def get_session_status(session_id: str):
    """Get current session status"""
    if session_id not in interview_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = interview_sessions[session_id]
    scores = session.get("scores", [])
    
    # Calculate elapsed time
    start_time = session.get("start_time", time.time())
    elapsed_seconds = int(time.time() - start_time)
    duration_minutes = session.get("duration_minutes", 30)
    remaining_seconds = max(0, (duration_minutes * 60) - elapsed_seconds)
    
    return {
        "session_id": session_id,
        "topic": session.get("topic_name", session["topic"]),
        "company_style": session.get("company_name", "Standard"),
        "difficulty": session["difficulty"],
        "question_count": session["question_count"],
        "history_length": len(session["history"]),
        "current_average": round(sum(scores) / len(scores), 1) if scores else None,
        "enable_tts": session.get("enable_tts", True),
        "elapsed_seconds": elapsed_seconds,
        "remaining_seconds": remaining_seconds,
        "duration_minutes": duration_minutes,
        "is_time_up": remaining_seconds <= 0,
        "has_resume": session.get("has_resume", False),
        "has_job_description": session.get("has_job_description", False)
    }

@app.get("/interview/{session_id}/time")
def get_interview_time(session_id: str):
    """Get interview timer status"""
    if session_id not in interview_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = interview_sessions[session_id]
    start_time = session.get("start_time", time.time())
    elapsed_seconds = int(time.time() - start_time)
    duration_minutes = session.get("duration_minutes", 30)
    remaining_seconds = max(0, (duration_minutes * 60) - elapsed_seconds)
    
    return {
        "elapsed_seconds": elapsed_seconds,
        "elapsed_formatted": f"{elapsed_seconds // 60:02d}:{elapsed_seconds % 60:02d}",
        "remaining_seconds": remaining_seconds,
        "remaining_formatted": f"{remaining_seconds // 60:02d}:{remaining_seconds % 60:02d}",
        "duration_minutes": duration_minutes,
        "progress_percent": min(100, (elapsed_seconds / (duration_minutes * 60)) * 100),
        "is_time_up": remaining_seconds <= 0,
        "is_warning": remaining_seconds <= 300 and remaining_seconds > 0  # 5 min warning
    }

# Keep legacy endpoint for backward compatibility
@app.post("/analyze")
async def analyze_audio_legacy(file: UploadFile = File(...)):
    """Legacy endpoint - creates a temporary session"""
    # Create a quick session
    session_result = start_interview(InterviewSession(topic="general"))
    session_id = session_result["session_id"]
    
    # Process the audio
    result = await analyze_audio(session_id, file)
    
    return result


# ============== PHASE 4: FEEDBACK & ANALYTICS ==============

# In-memory storage for interview history (in production, use database)
interview_history = []

class QuestionFeedback(BaseModel):
    question_index: int
    question: str
    answer: str
    score: Optional[int]
    feedback: Optional[str] = None

@app.post("/interview/{session_id}/question-feedback")
async def get_question_feedback(session_id: str):
    """Generate detailed feedback for each question-answer pair"""
    
    if session_id not in interview_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = interview_sessions[session_id]
    history = session["history"]
    scores = session.get("scores", [])
    
    # Parse conversation into Q&A pairs
    qa_pairs = []
    current_question = None
    score_index = 0
    
    for i, msg in enumerate(history):
        if msg["role"] == "assistant":
            # Clean the question (remove score if present)
            question = re.sub(r'\s*\[SCORE:\s*\d+/10\]', '', msg["content"]).strip()
            current_question = question
        elif msg["role"] == "user" and current_question:
            score = scores[score_index] if score_index < len(scores) else None
            qa_pairs.append({
                "index": len(qa_pairs) + 1,
                "question": current_question,
                "answer": msg["content"],
                "score": score
            })
            score_index += 1
            current_question = None
    
    # Generate detailed feedback for each Q&A pair using AI
    detailed_feedback = []
    
    for qa in qa_pairs:
        feedback_prompt = f"""Analyze this interview question and answer:

QUESTION: {qa['question']}
ANSWER: {qa['answer']}
SCORE: {qa['score']}/10

Provide brief, actionable feedback (max 100 words) covering:
1. What was done well
2. What could be improved
3. A better way to phrase the answer (if applicable)

Format: Direct, constructive feedback without headers."""

        try:
            completion = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": feedback_prompt}],
                temperature=0.5,
                max_tokens=150
            )
            feedback = completion.choices[0].message.content
        except Exception:
            feedback = "Unable to generate feedback."
        
        detailed_feedback.append({
            **qa,
            "feedback": feedback,
            "category": categorize_score(qa['score'])
        })
    
    return {
        "session_id": session_id,
        "total_questions": len(detailed_feedback),
        "questions": detailed_feedback
    }


def categorize_score(score: int) -> str:
    """Categorize score into performance tier"""
    if score is None:
        return "unscored"
    if score >= 8:
        return "excellent"
    elif score >= 6:
        return "good"
    elif score >= 4:
        return "needs_improvement"
    else:
        return "poor"


@app.get("/interview/{session_id}/analytics")
def get_detailed_analytics(session_id: str):
    """Get comprehensive analytics for the interview session"""
    
    if session_id not in interview_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = interview_sessions[session_id]
    scores = session.get("scores", [])
    history = session["history"]
    
    # Calculate time-based metrics
    start_time = session.get("start_time", time.time())
    elapsed_seconds = int(time.time() - start_time)
    
    # Word count analysis
    user_words = []
    ai_words = []
    
    for msg in history:
        words = len(msg["content"].split())
        if msg["role"] == "user":
            user_words.append(words)
        else:
            ai_words.append(words)
    
    avg_user_words = round(sum(user_words) / len(user_words), 1) if user_words else 0
    avg_ai_words = round(sum(ai_words) / len(ai_words), 1) if ai_words else 0
    
    # Score trend analysis
    score_trend = []
    if len(scores) >= 2:
        for i in range(1, len(scores)):
            change = scores[i] - scores[i-1]
            score_trend.append({
                "question": i + 1,
                "score": scores[i],
                "change": change,
                "trend": "up" if change > 0 else ("down" if change < 0 else "stable")
            })
    
    # Performance breakdown
    excellent = sum(1 for s in scores if s >= 8)
    good = sum(1 for s in scores if 6 <= s < 8)
    needs_work = sum(1 for s in scores if 4 <= s < 6)
    poor = sum(1 for s in scores if s < 4)
    
    # Calculate consistency score (standard deviation)
    if len(scores) >= 2:
        mean = sum(scores) / len(scores)
        variance = sum((s - mean) ** 2 for s in scores) / len(scores)
        std_dev = variance ** 0.5
        consistency = max(0, 100 - (std_dev * 20))  # Lower std_dev = higher consistency
    else:
        consistency = 100
    
    return {
        "session_id": session_id,
        "topic": session.get("topic_name", session["topic"]),
        "company_style": session.get("company_name", "Standard"),
        "difficulty": session["difficulty"],
        "duration": {
            "elapsed_seconds": elapsed_seconds,
            "elapsed_formatted": f"{elapsed_seconds // 60}:{elapsed_seconds % 60:02d}",
            "planned_minutes": session.get("duration_minutes", 30)
        },
        "scores": {
            "all": scores,
            "average": round(sum(scores) / len(scores), 1) if scores else None,
            "highest": max(scores) if scores else None,
            "lowest": min(scores) if scores else None,
            "first": scores[0] if scores else None,
            "last": scores[-1] if scores else None,
            "improvement": scores[-1] - scores[0] if len(scores) >= 2 else 0
        },
        "performance_breakdown": {
            "excellent": excellent,
            "good": good,
            "needs_improvement": needs_work,
            "poor": poor,
            "excellent_percent": round(excellent / len(scores) * 100, 1) if scores else 0,
            "pass_rate": round((excellent + good) / len(scores) * 100, 1) if scores else 0
        },
        "engagement": {
            "total_questions": session["question_count"],
            "total_responses": len(user_words),
            "avg_response_length": avg_user_words,
            "avg_question_length": avg_ai_words,
            "total_user_words": sum(user_words),
            "words_per_minute": round(sum(user_words) / (elapsed_seconds / 60), 1) if elapsed_seconds > 0 else 0
        },
        "consistency_score": round(consistency, 1),
        "score_trend": score_trend,
        "difficulty_adjustment": session.get("current_difficulty_adjustment", 0)
    }


@app.post("/interview/{session_id}/export")
def export_interview_report(session_id: str):
    """Export interview as a detailed report"""
    
    if session_id not in interview_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = interview_sessions[session_id]
    scores = session.get("scores", [])
    history = session["history"]
    
    # Calculate analytics
    start_time = session.get("start_time", time.time())
    elapsed_seconds = int(time.time() - start_time)
    avg_score = round(sum(scores) / len(scores), 1) if scores else None
    
    # Build Q&A transcript
    transcript = []
    score_index = 0
    
    for msg in history:
        entry = {
            "role": "Interviewer" if msg["role"] == "assistant" else "You",
            "content": re.sub(r'\s*\[SCORE:\s*\d+/10\]', '', msg["content"]).strip()
        }
        if msg["role"] == "user" and score_index < len(scores):
            entry["score"] = scores[score_index]
            score_index += 1
        transcript.append(entry)
    
    # Build comprehensive report
    report = {
        "report_type": "AI Mock Interview Report",
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "session_id": session_id,
        "interview_config": {
            "topic": session.get("topic_name", session["topic"]),
            "company_style": session.get("company_name", "Standard"),
            "difficulty": session["difficulty"],
            "duration_planned": f"{session.get('duration_minutes', 30)} minutes",
            "duration_actual": f"{elapsed_seconds // 60}:{elapsed_seconds % 60:02d}",
            "resume_provided": session.get("has_resume", False),
            "job_description_provided": session.get("has_job_description", False)
        },
        "performance_summary": {
            "total_questions": session["question_count"],
            "scores": scores,
            "average_score": avg_score,
            "highest_score": max(scores) if scores else None,
            "lowest_score": min(scores) if scores else None,
            "score_trend": "Improving" if len(scores) >= 2 and scores[-1] > scores[0] else (
                "Declining" if len(scores) >= 2 and scores[-1] < scores[0] else "Stable"
            ),
            "performance_grade": get_grade(avg_score) if avg_score else "N/A"
        },
        "transcript": transcript
    }
    
    return report


def get_grade(score: float) -> str:
    """Convert numeric score to letter grade"""
    if score >= 9:
        return "A+"
    elif score >= 8:
        return "A"
    elif score >= 7:
        return "B+"
    elif score >= 6:
        return "B"
    elif score >= 5:
        return "C"
    elif score >= 4:
        return "D"
    else:
        return "F"


@app.post("/interview/history/save")
def save_to_history(session_id: str):
    """Save completed interview to local history (for non-authenticated users)"""
    
    if session_id not in interview_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = interview_sessions[session_id]
    scores = session.get("scores", [])
    
    history_entry = {
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "date": time.strftime("%Y-%m-%d %H:%M:%S"),
        "topic": session.get("topic_name", session["topic"]),
        "company_style": session.get("company_name", "Standard"),
        "difficulty": session["difficulty"],
        "questions_count": session["question_count"],
        "average_score": round(sum(scores) / len(scores), 1) if scores else None,
        "scores": scores,
        "duration_seconds": int(time.time() - session.get("start_time", time.time()))
    }
    
    interview_history.append(history_entry)
    
    return {"success": True, "history_id": history_entry["id"]}


@app.post("/user/interviews/save")
async def save_interview_to_user_history(
    session_id: str,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """Save completed interview to authenticated user's history in database"""
    
    # First check if interview already exists in database (created during end_interview)
    existing = db.query(Interview).filter(Interview.session_id == session_id).first()
    if existing:
        if existing.user_id == current_user.id:
            return {"success": True, "message": "Interview already saved", "interview_id": existing.id}
        elif existing.user_id is None:
            # Associate orphan interview with user
            existing.user_id = current_user.id
            db.commit()
            return {"success": True, "message": "Interview linked to your account", "interview_id": existing.id}
        else:
            # Interview belongs to another user
            raise HTTPException(status_code=403, detail="Interview belongs to another user")
    
    # If not in database, try to get from memory (shouldn't happen after end_interview)
    if session_id not in interview_sessions:
        raise HTTPException(status_code=404, detail="Session not found or already ended")
    
    session = interview_sessions[session_id]
    scores = session.get("scores", [])
    
    # Create new interview record
    interview = Interview(
        session_id=session_id,
        user_id=current_user.id,
        topic=session.get("topic", "general"),
        topic_name=session.get("topic_name", "General Technical"),
        company_style=session.get("company_style", "default"),
        company_name=session.get("company_name", "Standard"),
        difficulty=session.get("difficulty", "medium"),
        duration_minutes=session.get("duration_minutes", 30),
        question_count=session.get("question_count", 0),
        scores=scores,
        average_score=round(sum(scores) / len(scores), 1) if scores else None,
        transcript=session.get("conversation", []),
        has_resume=bool(session.get("resume_text")),
        has_job_description=bool(session.get("job_description")),
        started_at=datetime.fromtimestamp(session.get("start_time", time.time())),
        ended_at=datetime.utcnow(),
        duration_seconds=int(time.time() - session.get("start_time", time.time())),
        status="completed"
    )
    
    db.add(interview)
    db.commit()
    db.refresh(interview)
    
    # Also save individual questions
    for idx, msg in enumerate(session.get("conversation", [])):
        if msg.get("role") == "assistant" and "?" in msg.get("content", ""):
            # This is a question
            question = InterviewQuestion(
                interview_id=interview.id,
                question_number=idx // 2 + 1,
                question=msg.get("content"),
                score=scores[idx // 2] if idx // 2 < len(scores) else None,
                created_at=datetime.utcnow()
            )
            db.add(question)
    
    db.commit()
    
    return {"success": True, "message": "Interview saved successfully", "interview_id": interview.id}


@app.get("/interview/history")
def get_interview_history():
    """Get all past interviews from history"""
    return {
        "total": len(interview_history),
        "interviews": sorted(interview_history, key=lambda x: x["date"], reverse=True)
    }


@app.get("/interview/history/stats")
def get_history_stats():
    """Get aggregated statistics across all interviews"""
    
    if not interview_history:
        return {
            "total_interviews": 0,
            "message": "No interview history yet"
        }
    
    all_scores = []
    topics = {}
    companies = {}
    difficulties = {}
    total_questions = 0
    total_duration = 0
    
    for entry in interview_history:
        # Collect all scores
        if entry.get("scores"):
            all_scores.extend(entry["scores"])
        
        # Count by topic
        topic = entry.get("topic", "Unknown")
        topics[topic] = topics.get(topic, 0) + 1
        
        # Count by company
        company = entry.get("company_style", "Standard")
        companies[company] = companies.get(company, 0) + 1
        
        # Count by difficulty
        diff = entry.get("difficulty", "medium")
        difficulties[diff] = difficulties.get(diff, 0) + 1
        
        # Totals
        total_questions += entry.get("questions_count", 0)
        total_duration += entry.get("duration_seconds", 0)
    
    # Score trends over time
    interview_averages = [
        {"date": e["date"], "score": e["average_score"]}
        for e in interview_history if e.get("average_score")
    ]
    
    return {
        "total_interviews": len(interview_history),
        "total_questions_answered": total_questions,
        "total_practice_time": f"{total_duration // 3600}h {(total_duration % 3600) // 60}m",
        "overall_average_score": round(sum(all_scores) / len(all_scores), 1) if all_scores else None,
        "highest_ever": max(all_scores) if all_scores else None,
        "lowest_ever": min(all_scores) if all_scores else None,
        "topics_practiced": topics,
        "companies_practiced": companies,
        "difficulties_practiced": difficulties,
        "score_history": interview_averages,
        "improvement": round(interview_averages[-1]["score"] - interview_averages[0]["score"], 1) if len(interview_averages) >= 2 else 0
    }


# ============== USER INTERVIEW HISTORY (DATABASE) ==============

@app.get("/user/interviews")
async def get_user_interviews(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
    limit: int = 20,
    offset: int = 0
):
    """Get authenticated user's interview history from database"""
    interviews = db.query(Interview).filter(
        Interview.user_id == current_user.id,
        Interview.status == "completed"
    ).order_by(Interview.started_at.desc()).offset(offset).limit(limit).all()
    
    total = db.query(Interview).filter(
        Interview.user_id == current_user.id,
        Interview.status == "completed"
    ).count()
    
    return {
        "total": total,
        "interviews": [
            {
                "id": i.id,
                "session_id": i.session_id,
                "topic": i.topic_name or i.topic,
                "company_style": i.company_name or i.company_style,
                "difficulty": i.difficulty,
                "question_count": i.question_count,
                "average_score": i.average_score,
                "scores": i.scores,
                "duration_seconds": i.duration_seconds,
                "started_at": i.started_at.isoformat() if i.started_at else None,
                "ended_at": i.ended_at.isoformat() if i.ended_at else None
            }
            for i in interviews
        ]
    }


@app.get("/user/interviews/{interview_id}")
async def get_user_interview_detail(
    interview_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """Get detailed view of a specific interview"""
    interview = db.query(Interview).filter(
        Interview.id == interview_id,
        Interview.user_id == current_user.id
    ).first()
    
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    return {
        "id": interview.id,
        "session_id": interview.session_id,
        "topic": interview.topic_name or interview.topic,
        "company_style": interview.company_name or interview.company_style,
        "difficulty": interview.difficulty,
        "duration_minutes": interview.duration_minutes,
        "question_count": interview.question_count,
        "scores": interview.scores,
        "average_score": interview.average_score,
        "transcript": interview.transcript,
        "summary": interview.summary,
        "strengths": interview.strengths,
        "improvements": interview.improvements,
        "has_resume": interview.has_resume,
        "has_job_description": interview.has_job_description,
        "started_at": interview.started_at.isoformat() if interview.started_at else None,
        "ended_at": interview.ended_at.isoformat() if interview.ended_at else None,
        "duration_seconds": interview.duration_seconds
    }


@app.delete("/user/interviews/{interview_id}")
async def delete_user_interview(
    interview_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """Delete a specific interview from user's history"""
    interview = db.query(Interview).filter(
        Interview.id == interview_id,
        Interview.user_id == current_user.id
    ).first()
    
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    db.delete(interview)
    db.commit()
    
    return {"message": "Interview deleted successfully"}


@app.get("/user/stats")
async def get_user_stats(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """Get comprehensive statistics for authenticated user"""
    interviews = db.query(Interview).filter(
        Interview.user_id == current_user.id,
        Interview.status == "completed"
    ).all()
    
    if not interviews:
        return {
            "total_interviews": 0,
            "message": "No completed interviews yet"
        }
    
    all_scores = []
    topics = {}
    companies = {}
    difficulties = {}
    total_questions = 0
    total_duration = 0
    
    for i in interviews:
        if i.scores:
            all_scores.extend(i.scores)
        
        topic = i.topic_name or i.topic or "Unknown"
        topics[topic] = topics.get(topic, 0) + 1
        
        company = i.company_name or i.company_style or "Standard"
        companies[company] = companies.get(company, 0) + 1
        
        diff = i.difficulty or "medium"
        difficulties[diff] = difficulties.get(diff, 0) + 1
        
        total_questions += i.question_count or 0
        total_duration += i.duration_seconds or 0
    
    # Score progression over time
    score_progression = [
        {
            "date": i.started_at.strftime("%Y-%m-%d") if i.started_at else None,
            "score": i.average_score,
            "topic": i.topic_name or i.topic
        }
        for i in sorted(interviews, key=lambda x: x.started_at or datetime.min)
        if i.average_score
    ]
    
    # Calculate improvement
    improvement = 0
    if len(score_progression) >= 2:
        improvement = round(score_progression[-1]["score"] - score_progression[0]["score"], 1)
    
    return {
        "total_interviews": len(interviews),
        "total_questions_answered": total_questions,
        "total_practice_time_seconds": total_duration,
        "total_practice_time_formatted": f"{total_duration // 3600}h {(total_duration % 3600) // 60}m",
        "overall_average_score": round(sum(all_scores) / len(all_scores), 1) if all_scores else None,
        "highest_score": max(all_scores) if all_scores else None,
        "lowest_score": min(all_scores) if all_scores else None,
        "topics_practiced": topics,
        "companies_practiced": companies,
        "difficulties_practiced": difficulties,
        "score_progression": score_progression,
        "improvement": improvement,
        "member_since": current_user.created_at.strftime("%Y-%m-%d") if current_user.created_at else None,
        "is_premium": current_user.is_premium
    }


# ============== XP & ACHIEVEMENTS SYSTEM ==============

# Achievement definitions
ACHIEVEMENTS = [
    {"id": "first_interview", "name": "First Steps", "description": "Complete your first interview", "xp_reward": 50},
    {"id": "five_interviews", "name": "Getting Serious", "description": "Complete 5 interviews", "xp_reward": 100},
    {"id": "ten_interviews", "name": "Interview Veteran", "description": "Complete 10 interviews", "xp_reward": 200},
    {"id": "perfect_score", "name": "Perfect Performance", "description": "Score 100% on an interview", "xp_reward": 150},
    {"id": "streak_3", "name": "On Fire", "description": "Maintain a 3-day streak", "xp_reward": 75},
    {"id": "streak_7", "name": "Week Warrior", "description": "Maintain a 7-day streak", "xp_reward": 150},
    {"id": "streak_30", "name": "Monthly Master", "description": "Maintain a 30-day streak", "xp_reward": 500},
    {"id": "hard_mode", "name": "Challenge Accepted", "description": "Complete a hard difficulty interview", "xp_reward": 100},
    {"id": "all_topics", "name": "Jack of All Trades", "description": "Try all interview topics", "xp_reward": 200},
    {"id": "high_scorer", "name": "High Achiever", "description": "Average score above 80%", "xp_reward": 150},
    {"id": "speed_demon", "name": "Speed Demon", "description": "Answer 10 questions in one session", "xp_reward": 100},
    {"id": "night_owl", "name": "Night Owl", "description": "Practice after midnight", "xp_reward": 50},
    {"id": "early_bird", "name": "Early Bird", "description": "Practice before 7 AM", "xp_reward": 50},
]


def calculate_level(total_xp: int) -> dict:
    """Calculate level from total XP"""
    level = 1
    xp_required = 100
    remaining_xp = total_xp
    
    while remaining_xp >= xp_required:
        remaining_xp -= xp_required
        level += 1
        xp_required = level * 100
    
    return {
        "level": level,
        "current_xp": remaining_xp,
        "xp_to_next_level": xp_required,
        "progress": round((remaining_xp / xp_required) * 100, 1)
    }


def calculate_xp_gain(score: int, difficulty: str, question_count: int, streak_bonus: int = 0) -> int:
    """Calculate XP gained from an interview"""
    base_xp = score * 10
    difficulty_multiplier = {"easy": 1, "medium": 1.5, "hard": 2}.get(difficulty, 1)
    question_bonus = question_count * 5
    streak_xp = streak_bonus * 10
    
    return int(base_xp * difficulty_multiplier + question_bonus + streak_xp)


@app.get("/user/xp")
async def get_user_xp(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """Get user's XP and level information"""
    user_xp = db.query(UserXP).filter(UserXP.user_id == current_user.id).first()
    
    if not user_xp:
        # Create XP record if doesn't exist
        user_xp = UserXP(user_id=current_user.id)
        db.add(user_xp)
        db.commit()
        db.refresh(user_xp)
    
    level_info = calculate_level(user_xp.total_xp)
    
    return {
        "total_xp": user_xp.total_xp,
        "level": level_info["level"],
        "current_xp": level_info["current_xp"],
        "xp_to_next_level": level_info["xp_to_next_level"],
        "progress": level_info["progress"],
        "current_streak": user_xp.current_streak,
        "longest_streak": user_xp.longest_streak,
        "total_interviews": user_xp.total_interviews,
        "total_questions": user_xp.total_questions,
        "perfect_scores": user_xp.perfect_scores,
        "average_score": round(user_xp.average_score, 1) if user_xp.average_score else 0,
        "last_activity": user_xp.last_activity_date.isoformat() if user_xp.last_activity_date else None
    }


@app.post("/user/xp/add")
async def add_user_xp(
    score: int,
    difficulty: str = "medium",
    question_count: int = 1,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """Add XP after completing an interview"""
    user_xp = db.query(UserXP).filter(UserXP.user_id == current_user.id).first()
    
    if not user_xp:
        user_xp = UserXP(user_id=current_user.id)
        db.add(user_xp)
    
    # Update streak
    today = datetime.utcnow().date()
    if user_xp.last_activity_date:
        last_date = user_xp.last_activity_date.date()
        if last_date == today:
            pass  # Same day, no streak change
        elif (today - last_date).days == 1:
            user_xp.current_streak += 1  # Consecutive day
        else:
            user_xp.current_streak = 1  # Streak broken
    else:
        user_xp.current_streak = 1
    
    # Update longest streak
    if user_xp.current_streak > user_xp.longest_streak:
        user_xp.longest_streak = user_xp.current_streak
    
    # Calculate XP
    xp_gained = calculate_xp_gain(score, difficulty, question_count, user_xp.current_streak)
    user_xp.total_xp += xp_gained
    
    # Update stats
    user_xp.total_interviews += 1
    user_xp.total_questions += question_count
    if score == 100:
        user_xp.perfect_scores += 1
    
    # Update average score
    total_score = (user_xp.average_score * (user_xp.total_interviews - 1)) + score
    user_xp.average_score = total_score / user_xp.total_interviews
    
    user_xp.last_activity_date = datetime.utcnow()
    
    db.commit()
    db.refresh(user_xp)
    
    # Check for new achievements
    new_achievements = check_achievements(user_xp, difficulty, db, current_user.id)
    
    level_info = calculate_level(user_xp.total_xp)
    
    return {
        "xp_gained": xp_gained,
        "total_xp": user_xp.total_xp,
        "level": level_info["level"],
        "progress": level_info["progress"],
        "new_achievements": new_achievements,
        "current_streak": user_xp.current_streak
    }


def check_achievements(user_xp: UserXP, difficulty: str, db: Session, user_id: int) -> list:
    """Check and unlock new achievements"""
    new_achievements = []
    
    # Get existing achievements
    existing = db.query(UserAchievement).filter(UserAchievement.user_id == user_id).all()
    existing_ids = {a.achievement_id for a in existing}
    
    # Check conditions
    checks = [
        ("first_interview", user_xp.total_interviews >= 1),
        ("five_interviews", user_xp.total_interviews >= 5),
        ("ten_interviews", user_xp.total_interviews >= 10),
        ("perfect_score", user_xp.perfect_scores >= 1),
        ("streak_3", user_xp.current_streak >= 3),
        ("streak_7", user_xp.current_streak >= 7),
        ("streak_30", user_xp.current_streak >= 30),
        ("hard_mode", difficulty == "hard"),
        ("high_scorer", user_xp.average_score >= 80),
        ("speed_demon", user_xp.total_questions >= 10),
    ]
    
    # Check time-based achievements
    current_hour = datetime.utcnow().hour
    if 0 <= current_hour < 5:
        checks.append(("night_owl", True))
    if 5 <= current_hour < 7:
        checks.append(("early_bird", True))
    
    for achievement_id, condition in checks:
        if condition and achievement_id not in existing_ids:
            # Unlock achievement
            new_achievement = UserAchievement(user_id=user_id, achievement_id=achievement_id)
            db.add(new_achievement)
            
            # Add XP reward
            achievement_def = next((a for a in ACHIEVEMENTS if a["id"] == achievement_id), None)
            if achievement_def:
                user_xp.total_xp += achievement_def["xp_reward"]
                new_achievements.append(achievement_def)
    
    db.commit()
    return new_achievements


@app.get("/user/achievements")
async def get_user_achievements(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """Get user's achievements"""
    unlocked = db.query(UserAchievement).filter(
        UserAchievement.user_id == current_user.id
    ).all()
    
    unlocked_ids = {a.achievement_id for a in unlocked}
    unlocked_dates = {a.achievement_id: a.unlocked_at for a in unlocked}
    
    return {
        "achievements": [
            {
                **achievement,
                "unlocked": achievement["id"] in unlocked_ids,
                "unlocked_at": unlocked_dates.get(achievement["id"], None)
            }
            for achievement in ACHIEVEMENTS
        ],
        "total_unlocked": len(unlocked),
        "total_achievements": len(ACHIEVEMENTS)
    }


@app.get("/user/dashboard")
async def get_user_dashboard(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """Get comprehensive dashboard data for authenticated user"""
    # Get XP data
    user_xp = db.query(UserXP).filter(UserXP.user_id == current_user.id).first()
    if not user_xp:
        user_xp = UserXP(user_id=current_user.id)
        db.add(user_xp)
        db.commit()
        db.refresh(user_xp)
    
    level_info = calculate_level(user_xp.total_xp)
    
    # Get achievements
    unlocked = db.query(UserAchievement).filter(
        UserAchievement.user_id == current_user.id
    ).all()
    unlocked_ids = [a.achievement_id for a in unlocked]
    
    # Get recent interviews
    recent_interviews = db.query(Interview).filter(
        Interview.user_id == current_user.id,
        Interview.status == "completed"
    ).order_by(Interview.started_at.desc()).limit(10).all()
    
    interview_history = [
        {
            "id": i.id,
            "date": i.started_at.isoformat() if i.started_at else None,
            "topic": i.topic_name or i.topic,
            "difficulty": i.difficulty,
            "score": i.average_score,
            "questions": i.question_count
        }
        for i in recent_interviews
    ]
    
    return {
        "user": {
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email,
            "full_name": current_user.full_name,
            "is_premium": current_user.is_premium,
            "member_since": current_user.created_at.isoformat() if current_user.created_at else None
        },
        "xp": {
            "total_xp": user_xp.total_xp,
            "level": level_info["level"],
            "current_xp": level_info["current_xp"],
            "xp_to_next_level": level_info["xp_to_next_level"],
            "progress": level_info["progress"]
        },
        "stats": {
            "total_interviews": user_xp.total_interviews,
            "total_questions": user_xp.total_questions,
            "average_score": round(user_xp.average_score, 1) if user_xp.average_score else 0,
            "perfect_scores": user_xp.perfect_scores,
            "current_streak": user_xp.current_streak,
            "longest_streak": user_xp.longest_streak
        },
        "achievements": {
            "unlocked": unlocked_ids,
            "total_unlocked": len(unlocked_ids),
            "total_available": len(ACHIEVEMENTS)
        },
        "recent_interviews": interview_history
    }


# ============== GLOBAL STATS ==============

@app.get("/stats/global")
async def get_global_stats(db: Session = Depends(get_db)):
    """Get platform-wide statistics (public)"""
    total_interviews = db.query(Interview).filter(Interview.status == "completed").count()
    total_users = db.query(User).count()
    
    # Get average score across all interviews
    completed_interviews = db.query(Interview).filter(
        Interview.status == "completed",
        Interview.average_score.isnot(None)
    ).all()
    
    avg_scores = [i.average_score for i in completed_interviews if i.average_score]
    platform_avg = round(sum(avg_scores) / len(avg_scores), 1) if avg_scores else None
    
    return {
        "total_interviews_completed": total_interviews,
        "total_users": total_users,
        "platform_average_score": platform_avg,
        "topics_available": len(INTERVIEW_TOPICS),
        "companies_available": len(COMPANY_STYLES)
    }


# ============== PHASE 6: ADVANCED FEATURES ==============

# Common filler words to detect
FILLER_WORDS = [
    "um", "uh", "er", "ah", "like", "you know", "basically", "actually", 
    "literally", "honestly", "right", "so", "well", "I mean", "kind of", 
    "sort of", "just", "really", "very", "totally", "definitely"
]

# STAR method keywords
STAR_KEYWORDS = {
    "situation": ["situation", "context", "background", "scenario", "when", "there was", "at my previous", "in my role"],
    "task": ["task", "responsibility", "goal", "objective", "needed to", "had to", "was asked to", "my job was"],
    "action": ["action", "did", "implemented", "created", "developed", "led", "initiated", "decided", "took steps", "approached"],
    "result": ["result", "outcome", "achieved", "accomplished", "improved", "increased", "decreased", "saved", "led to", "resulted in", "impact"]
}


def analyze_speech_quality(text: str) -> dict:
    """Analyze speech quality metrics from transcribed text"""
    words = text.lower().split()
    word_count = len(words)
    
    # Count filler words
    filler_count = 0
    filler_details = {}
    text_lower = text.lower()
    
    for filler in FILLER_WORDS:
        count = text_lower.count(filler)
        if count > 0:
            filler_count += count
            filler_details[filler] = count
    
    # Calculate filler ratio
    filler_ratio = round(filler_count / word_count * 100, 1) if word_count > 0 else 0
    
    # Sentence analysis
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if s.strip()]
    avg_sentence_length = round(word_count / len(sentences), 1) if sentences else 0
    
    # Vocabulary diversity (unique words ratio)
    unique_words = set(words)
    vocab_diversity = round(len(unique_words) / word_count * 100, 1) if word_count > 0 else 0
    
    # Clarity score (based on filler ratio and sentence structure)
    clarity_score = max(0, min(10, 10 - (filler_ratio * 0.5) - (abs(avg_sentence_length - 15) * 0.1)))
    
    # Confidence indicators
    hedging_words = ["maybe", "perhaps", "might", "could", "possibly", "i think", "i guess", "not sure"]
    hedging_count = sum(text_lower.count(word) for word in hedging_words)
    confidence_score = max(0, min(10, 10 - (hedging_count * 1.5) - (filler_ratio * 0.3)))
    
    # Determine quality level
    if filler_ratio < 3:
        filler_quality = "excellent"
    elif filler_ratio < 6:
        filler_quality = "good"
    elif filler_ratio < 10:
        filler_quality = "fair"
    else:
        filler_quality = "needs_work"
    
    return {
        "word_count": word_count,
        "sentence_count": len(sentences),
        "avg_sentence_length": avg_sentence_length,
        "filler_words": {
            "count": filler_count,
            "ratio_percent": filler_ratio,
            "quality": filler_quality,
            "details": filler_details
        },
        "vocabulary": {
            "unique_words": len(unique_words),
            "diversity_percent": vocab_diversity,
            "quality": "excellent" if vocab_diversity > 60 else ("good" if vocab_diversity > 40 else "fair")
        },
        "clarity_score": round(clarity_score, 1),
        "confidence_score": round(confidence_score, 1),
        "hedging_count": hedging_count
    }


def detect_star_method(text: str) -> dict:
    """Detect STAR method components in behavioral answers"""
    text_lower = text.lower()
    
    detected = {
        "situation": False,
        "task": False,
        "action": False,
        "result": False
    }
    
    evidence = {
        "situation": [],
        "task": [],
        "action": [],
        "result": []
    }
    
    # Check each STAR component
    for component, keywords in STAR_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text_lower:
                detected[component] = True
                evidence[component].append(keyword)
    
    # Calculate STAR completeness
    components_found = sum(detected.values())
    completeness = round(components_found / 4 * 100, 0)
    
    # Generate feedback
    missing = [k.upper() for k, v in detected.items() if not v]
    
    if completeness == 100:
        feedback = "Excellent! Your answer follows the complete STAR method with all components clearly present."
        quality = "excellent"
    elif completeness >= 75:
        feedback = f"Good structure! Consider strengthening the {', '.join(missing)} component(s)."
        quality = "good"
    elif completeness >= 50:
        feedback = f"Partial STAR structure. Missing: {', '.join(missing)}. Try to include these for a stronger answer."
        quality = "fair"
    else:
        feedback = "Your answer could benefit from the STAR method structure. Include: Situation, Task, Action, Result."
        quality = "needs_improvement"
    
    return {
        "detected_components": detected,
        "evidence": evidence,
        "completeness_percent": completeness,
        "quality": quality,
        "feedback": feedback,
        "missing_components": missing
    }


def generate_coaching_tips(speech_analysis: dict, star_analysis: dict, score: int = None) -> list:
    """Generate personalized coaching tips based on analysis"""
    tips = []
    
    # Speech quality tips
    filler_ratio = speech_analysis["filler_words"]["ratio_percent"]
    if filler_ratio > 5:
        top_fillers = sorted(speech_analysis["filler_words"]["details"].items(), key=lambda x: x[1], reverse=True)[:3]
        filler_list = ", ".join([f'"{f[0]}"' for f in top_fillers])
        tips.append({
            "category": "speech",
            "priority": "high" if filler_ratio > 10 else "medium",
            "icon": "🎤",
            "title": "Reduce Filler Words",
            "tip": f"You used filler words {filler_ratio}% of the time. Focus on reducing: {filler_list}. Try pausing instead of using fillers.",
            "practice": "Record yourself answering questions and count filler words. Practice pausing silently instead."
        })
    
    # Sentence length tips
    avg_len = speech_analysis["avg_sentence_length"]
    if avg_len > 25:
        tips.append({
            "category": "clarity",
            "priority": "medium",
            "icon": "📝",
            "title": "Shorten Your Sentences",
            "tip": f"Your average sentence has {avg_len} words. Aim for 15-20 words for clearer communication.",
            "practice": "Practice breaking complex ideas into multiple shorter sentences."
        })
    elif avg_len < 8:
        tips.append({
            "category": "clarity",
            "priority": "low",
            "icon": "📝",
            "title": "Elaborate More",
            "tip": "Your sentences are quite short. Consider providing more detail and context in your answers.",
            "practice": "Use the 'because' technique: finish thoughts with 'because...' to add depth."
        })
    
    # Confidence tips
    if speech_analysis["confidence_score"] < 6:
        tips.append({
            "category": "confidence",
            "priority": "high",
            "icon": "💪",
            "title": "Project More Confidence",
            "tip": "Your language suggests uncertainty. Replace 'I think' with 'I believe' and avoid 'maybe' and 'perhaps'.",
            "practice": "Practice stating your opinions as facts, then add qualifiers only if truly necessary."
        })
    
    # Vocabulary tips
    if speech_analysis["vocabulary"]["diversity_percent"] < 40:
        tips.append({
            "category": "vocabulary",
            "priority": "low",
            "icon": "📚",
            "title": "Expand Your Vocabulary",
            "tip": "Try using more varied vocabulary to demonstrate breadth of knowledge.",
            "practice": "Learn 3 new industry-specific terms each week and practice using them."
        })
    
    # STAR method tips
    if star_analysis["completeness_percent"] < 100:
        missing = star_analysis["missing_components"]
        tips.append({
            "category": "structure",
            "priority": "high" if len(missing) > 2 else "medium",
            "icon": "⭐",
            "title": "Use STAR Method",
            "tip": star_analysis["feedback"],
            "practice": f"Before answering behavioral questions, mentally outline: Situation → Task → Action → Result"
        })
    
    # Score-based tips
    if score is not None:
        if score < 5:
            tips.append({
                "category": "content",
                "priority": "high",
                "icon": "🎯",
                "title": "Focus on Specifics",
                "tip": "Your answer lacked specific details. Include concrete examples, metrics, and outcomes.",
                "practice": "Prepare 5 detailed stories from your experience with specific numbers and results."
            })
        elif score < 7:
            tips.append({
                "category": "content",
                "priority": "medium",
                "icon": "🎯",
                "title": "Add More Impact",
                "tip": "Good foundation, but quantify your achievements more. Use numbers and percentages.",
                "practice": "For each accomplishment, note the specific impact: time saved, revenue generated, problems solved."
            })
    
    # Sort by priority
    priority_order = {"high": 0, "medium": 1, "low": 2}
    tips.sort(key=lambda x: priority_order.get(x["priority"], 3))
    
    return tips[:5]  # Return top 5 tips


@app.post("/interview/{session_id}/speech-analysis")
async def analyze_speech(session_id: str, answer_index: int = -1):
    """Analyze speech quality for a specific answer or the latest one"""
    
    if session_id not in interview_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = interview_sessions[session_id]
    history = session["history"]
    
    # Get user messages only
    user_messages = [msg for msg in history if msg["role"] == "user"]
    
    if not user_messages:
        raise HTTPException(status_code=400, detail="No user responses to analyze")
    
    # Get specific answer or latest
    if answer_index == -1:
        text = user_messages[-1]["content"]
        answer_num = len(user_messages)
    else:
        if answer_index >= len(user_messages):
            raise HTTPException(status_code=400, detail="Invalid answer index")
        text = user_messages[answer_index]["content"]
        answer_num = answer_index + 1
    
    # Perform analysis
    speech_quality = analyze_speech_quality(text)
    star_analysis = detect_star_method(text)
    
    # Get score for this answer if available
    scores = session.get("scores", [])
    score = scores[answer_num - 1] if answer_num <= len(scores) else None
    
    # Generate coaching tips
    coaching_tips = generate_coaching_tips(speech_quality, star_analysis, score)
    
    return {
        "session_id": session_id,
        "answer_number": answer_num,
        "text_analyzed": text[:200] + "..." if len(text) > 200 else text,
        "speech_quality": speech_quality,
        "star_analysis": star_analysis,
        "score": score,
        "coaching_tips": coaching_tips
    }


@app.get("/interview/{session_id}/coaching")
async def get_live_coaching(session_id: str):
    """Get real-time coaching feedback for ongoing interview"""
    
    if session_id not in interview_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = interview_sessions[session_id]
    history = session["history"]
    scores = session.get("scores", [])
    
    # Analyze all user responses
    user_messages = [msg["content"] for msg in history if msg["role"] == "user"]
    
    if not user_messages:
        return {
            "session_id": session_id,
            "status": "waiting",
            "message": "No responses yet. Start answering to receive coaching."
        }
    
    # Aggregate speech analysis
    all_filler_counts = {}
    total_words = 0
    total_fillers = 0
    all_confidence_scores = []
    all_star_completeness = []
    
    for text in user_messages:
        speech = analyze_speech_quality(text)
        star = detect_star_method(text)
        
        total_words += speech["word_count"]
        total_fillers += speech["filler_words"]["count"]
        all_confidence_scores.append(speech["confidence_score"])
        all_star_completeness.append(star["completeness_percent"])
        
        for filler, count in speech["filler_words"]["details"].items():
            all_filler_counts[filler] = all_filler_counts.get(filler, 0) + count
    
    # Calculate aggregates
    overall_filler_ratio = round(total_fillers / total_words * 100, 1) if total_words > 0 else 0
    avg_confidence = round(sum(all_confidence_scores) / len(all_confidence_scores), 1)
    avg_star_completeness = round(sum(all_star_completeness) / len(all_star_completeness), 0)
    avg_score = round(sum(scores) / len(scores), 1) if scores else None
    
    # Top filler words
    top_fillers = sorted(all_filler_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    
    # Generate overall coaching
    strengths = []
    improvements = []
    
    if overall_filler_ratio < 5:
        strengths.append("Clean speech with minimal filler words")
    else:
        improvements.append(f"Reduce filler words (currently {overall_filler_ratio}% of speech)")
    
    if avg_confidence >= 7:
        strengths.append("Confident and assertive communication")
    else:
        improvements.append("Work on projecting more confidence in your tone")
    
    if avg_star_completeness >= 75:
        strengths.append("Good use of STAR method structure")
    else:
        improvements.append("Apply STAR method more consistently")
    
    if avg_score and avg_score >= 7:
        strengths.append("Strong technical/content quality")
    elif avg_score and avg_score < 5:
        improvements.append("Focus on providing more specific examples")
    
    # Determine overall status
    score_factors = [
        avg_score or 5,
        avg_confidence,
        10 - (overall_filler_ratio / 2),
        avg_star_completeness / 10
    ]
    overall_performance = round(sum(score_factors) / len(score_factors), 1)
    
    if overall_performance >= 7:
        status_emoji = "🌟"
        status_message = "Excellent performance! Keep up the great work."
    elif overall_performance >= 5:
        status_emoji = "👍"
        status_message = "Good progress. Focus on the improvement areas below."
    else:
        status_emoji = "💪"
        status_message = "Room for improvement. Review the coaching tips carefully."
    
    return {
        "session_id": session_id,
        "status": "active",
        "responses_analyzed": len(user_messages),
        "overall_performance": {
            "score": overall_performance,
            "emoji": status_emoji,
            "message": status_message
        },
        "metrics": {
            "average_score": avg_score,
            "confidence_score": avg_confidence,
            "filler_ratio_percent": overall_filler_ratio,
            "star_completeness_percent": avg_star_completeness,
            "total_words_spoken": total_words
        },
        "top_filler_words": top_fillers,
        "strengths": strengths,
        "improvements": improvements,
        "quick_tips": [
            "🎯 Pause before answering to collect your thoughts",
            "📊 Include specific numbers and metrics",
            "⭐ Structure behavioral answers: Situation → Task → Action → Result",
            "💪 Replace 'I think' with 'I believe' for more confidence"
        ]
    }


@app.post("/interview/{session_id}/ai-coaching")
async def get_ai_coaching(session_id: str):
    """Get AI-generated personalized coaching based on interview performance"""
    
    if session_id not in interview_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = interview_sessions[session_id]
    history = session["history"]
    scores = session.get("scores", [])
    
    if len(history) < 2:
        raise HTTPException(status_code=400, detail="Need more conversation history for coaching")
    
    # Build coaching prompt
    coaching_prompt = f"""You are an expert interview coach. Analyze this interview conversation and provide personalized coaching feedback.

INTERVIEW DETAILS:
- Topic: {session.get('topic_name', session['topic'])}
- Company Style: {session.get('company_name', 'Standard')}
- Difficulty: {session['difficulty']}
- Questions Asked: {session['question_count']}
- Scores Received: {scores if scores else 'Not available'}
- Average Score: {round(sum(scores)/len(scores), 1) if scores else 'N/A'}

CONVERSATION:
{chr(10).join([f"{msg['role'].upper()}: {msg['content'][:300]}" for msg in history[-10:]])}

Provide coaching in this exact JSON format:
{{
    "overall_grade": "A/B/C/D/F",
    "key_strengths": ["strength1", "strength2", "strength3"],
    "critical_improvements": ["improvement1", "improvement2", "improvement3"],
    "specific_answer_feedback": [
        {{"question_topic": "topic", "what_worked": "...", "what_to_improve": "..."}}
    ],
    "practice_exercises": [
        {{"exercise": "name", "description": "how to do it", "duration": "time"}}
    ],
    "next_steps": "1-2 sentence action plan",
    "motivational_note": "encouraging message"
}}

Be specific, actionable, and encouraging. Focus on the most impactful improvements."""

    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": coaching_prompt}],
            temperature=0.5,
            max_tokens=800
        )
        
        response_text = completion.choices[0].message.content
        
        # Try to parse as JSON
        import json
        try:
            # Find JSON in response
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                coaching_data = json.loads(json_match.group())
            else:
                coaching_data = {"raw_feedback": response_text}
        except json.JSONDecodeError:
            coaching_data = {"raw_feedback": response_text}
        
        return {
            "session_id": session_id,
            "coaching": coaching_data,
            "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "questions_analyzed": session["question_count"]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate coaching: {str(e)}")


@app.get("/interview/{session_id}/improvement-plan")
async def get_improvement_plan(session_id: str):
    """Generate a structured improvement plan based on interview performance"""
    
    if session_id not in interview_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = interview_sessions[session_id]
    history = session["history"]
    scores = session.get("scores", [])
    
    # Analyze all responses
    user_messages = [msg["content"] for msg in history if msg["role"] == "user"]
    
    if not user_messages:
        raise HTTPException(status_code=400, detail="No responses to analyze")
    
    # Aggregate metrics
    speech_metrics = []
    star_metrics = []
    
    for text in user_messages:
        speech_metrics.append(analyze_speech_quality(text))
        star_metrics.append(detect_star_method(text))
    
    # Calculate averages
    avg_filler = round(sum(m["filler_words"]["ratio_percent"] for m in speech_metrics) / len(speech_metrics), 1)
    avg_confidence = round(sum(m["confidence_score"] for m in speech_metrics) / len(speech_metrics), 1)
    avg_clarity = round(sum(m["clarity_score"] for m in speech_metrics) / len(speech_metrics), 1)
    avg_star = round(sum(m["completeness_percent"] for m in star_metrics) / len(star_metrics), 0)
    avg_score = round(sum(scores) / len(scores), 1) if scores else None
    
    # Build improvement plan
    plan_items = []
    
    # Week 1-2: Speech Quality
    if avg_filler > 5:
        plan_items.append({
            "week": "1-2",
            "focus": "Speech Clarity",
            "goal": f"Reduce filler words from {avg_filler}% to under 3%",
            "activities": [
                "Record yourself answering 3 practice questions daily",
                "Count and track your filler word usage",
                "Practice 3-second pauses instead of fillers",
                "Use the 'Toastmasters Ah-Counter' technique"
            ],
            "metrics": ["Filler word percentage", "Pause frequency"]
        })
    
    # Week 2-3: Confidence
    if avg_confidence < 7:
        plan_items.append({
            "week": "2-3",
            "focus": "Confidence Building",
            "goal": f"Increase confidence score from {avg_confidence} to 8+",
            "activities": [
                "Replace hedging language ('I think') with assertive statements",
                "Practice power poses before mock interviews",
                "Prepare and memorize your top 5 achievement stories",
                "Record and review your body language"
            ],
            "metrics": ["Hedging word count", "Self-rated confidence"]
        })
    
    # Week 3-4: STAR Method
    if avg_star < 80:
        plan_items.append({
            "week": "3-4",
            "focus": "STAR Method Mastery",
            "goal": f"Achieve {avg_star}% → 100% STAR completeness",
            "activities": [
                "Write out 10 STAR stories from your experience",
                "Practice verbalizing each component separately",
                "Time yourself: 30 sec Situation, 15 sec Task, 60 sec Action, 30 sec Result",
                "Get feedback from a friend or mentor"
            ],
            "metrics": ["STAR completeness %", "Story bank size"]
        })
    
    # Week 4+: Technical Content
    if avg_score and avg_score < 7:
        plan_items.append({
            "week": "4+",
            "focus": "Technical Depth",
            "goal": f"Improve answer quality from {avg_score}/10 to 8+/10",
            "activities": [
                f"Review common {session.get('topic_name', session['topic'])} interview questions",
                "Study system design fundamentals",
                "Practice explaining concepts to non-technical people",
                "Build a 'technical vocabulary' list for your domain"
            ],
            "metrics": ["Mock interview scores", "Topics mastered"]
        })
    
    # If everything is good, add advanced tips
    if not plan_items:
        plan_items.append({
            "week": "Ongoing",
            "focus": "Excellence & Consistency",
            "goal": "Maintain high performance and handle edge cases",
            "activities": [
                "Practice with different interview styles",
                "Work on handling unexpected questions",
                "Focus on storytelling and engagement",
                "Mentor others to solidify your knowledge"
            ],
            "metrics": ["Consistency score", "Interviewer feedback"]
        })
    
    return {
        "session_id": session_id,
        "current_performance": {
            "content_score": avg_score,
            "confidence_score": avg_confidence,
            "clarity_score": avg_clarity,
            "filler_ratio": avg_filler,
            "star_completeness": avg_star
        },
        "improvement_plan": plan_items,
        "estimated_duration": f"{len(plan_items) * 2} weeks",
        "recommended_practice": "3-4 mock interviews per week",
        "success_criteria": {
            "content_score": "8+/10",
            "confidence_score": "8+/10",
            "filler_ratio": "< 3%",
            "star_completeness": "100%"
        }
    }