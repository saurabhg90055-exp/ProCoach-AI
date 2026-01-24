"""
AI Interviewer Backend API
MongoDB-powered backend with guest/authenticated user support
"""

import os
import uuid
import io
import re
import time
from datetime import datetime
from typing import Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from groq import Groq
from dotenv import load_dotenv
import shutil
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Import MongoDB database and auth modules
from database import (
    init_db, close_mongo_connection, get_database,
    create_user_db, get_user_by_email, get_user_by_username, get_user_by_id,
    update_user, update_user_xp, add_user_achievement, update_user_settings,
    create_interview_db, get_interview_by_session_id, update_interview,
    get_user_interviews as db_get_user_interviews, delete_interview as db_delete_interview,
    save_interview_to_user, get_user_stats as db_get_user_stats, add_transcript_message
)
from auth import (
    UserCreate, UserResponse, UserLogin, Token, PasswordChange, UserUpdate,
    create_user, authenticate_user,
    create_access_token, create_refresh_token, verify_token,
    get_current_user, get_current_user_required, get_password_hash, verify_password,
    user_to_response
)

# Load environment variables from .env file
load_dotenv()

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)


# ============== APPLICATION LIFECYCLE ==============

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle - startup and shutdown"""
    # Startup
    await init_db()
    print("🚀 AI Interviewer API started!")
    yield
    # Shutdown
    await close_mongo_connection()
    print("👋 AI Interviewer API shutdown complete")


app = FastAPI(
    title="AI Mock Interviewer API",
    description="Backend API for AI-powered mock interview practice",
    version="2.0.0",
    lifespan=lifespan
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
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint for container orchestration"""
    return {
        "status": "healthy",
        "service": "ai-interviewer-api",
        "version": "2.0.0",
        "database": "mongodb"
    }

# Store active interview sessions (in production, use Redis)
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

# Achievements definitions
ACHIEVEMENTS = [
    {"id": "first_interview", "name": "First Steps", "description": "Complete your first interview", "xp_reward": 50, "icon": "🎯"},
    {"id": "perfect_10", "name": "Perfect 10", "description": "Get a 10/10 score on a question", "xp_reward": 100, "icon": "⭐"},
    {"id": "streak_3", "name": "Hat Trick", "description": "Practice 3 days in a row", "xp_reward": 75, "icon": "🔥"},
    {"id": "streak_7", "name": "Week Warrior", "description": "Practice 7 days in a row", "xp_reward": 150, "icon": "💪"},
    {"id": "streak_30", "name": "Monthly Master", "description": "Practice 30 days in a row", "xp_reward": 500, "icon": "🏆"},
    {"id": "questions_10", "name": "Getting Started", "description": "Answer 10 questions", "xp_reward": 50, "icon": "📚"},
    {"id": "questions_50", "name": "Dedicated Learner", "description": "Answer 50 questions", "xp_reward": 150, "icon": "📖"},
    {"id": "questions_100", "name": "Century Club", "description": "Answer 100 questions", "xp_reward": 300, "icon": "💯"},
    {"id": "all_topics", "name": "Well Rounded", "description": "Practice all interview topics", "xp_reward": 200, "icon": "🌟"},
    {"id": "avg_8_plus", "name": "High Achiever", "description": "Maintain 8+ average score", "xp_reward": 250, "icon": "🎖️"},
    {"id": "interviews_5", "name": "Committed", "description": "Complete 5 interviews", "xp_reward": 100, "icon": "✅"},
    {"id": "interviews_20", "name": "Interview Pro", "description": "Complete 20 interviews", "xp_reward": 400, "icon": "🎓"},
]


class InterviewSession(BaseModel):
    topic: str = "general"
    difficulty: str = "medium"
    company_style: str = "default"
    enable_tts: bool = True
    job_description: Optional[str] = None
    resume_text: Optional[str] = None
    duration_minutes: int = 30


class Message(BaseModel):
    role: str
    content: str


class TextToSpeechRequest(BaseModel):
    text: str


class ResumeParseRequest(BaseModel):
    text: str


@app.get("/")
def root():
    return {"status": "active", "message": "AI Interviewer Backend v2.0", "version": "2.0.0", "database": "mongodb"}


# ============== AUTHENTICATION ENDPOINTS ==============

@app.post("/auth/register", response_model=Token)
@limiter.limit("5/minute")
async def register(request: Request, user_data: UserCreate):
    """Register a new user account"""
    # Check if email already exists
    if await get_user_by_email(user_data.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if username already exists
    if await get_user_by_username(user_data.username):
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # Validate password strength
    if len(user_data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    # Create user
    user = await create_user(user_data)
    
    # Generate tokens
    access_token = create_access_token(data={"sub": user["_id"], "email": user["email"]})
    refresh_token = create_refresh_token(data={"sub": user["_id"], "email": user["email"]})
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=user_to_response(user)
    )


@app.post("/auth/login", response_model=Token)
@limiter.limit("10/minute")
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    """Login with email and password"""
    user = await authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": user["_id"], "email": user["email"]})
    refresh_token = create_refresh_token(data={"sub": user["_id"], "email": user["email"]})
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=user_to_response(user)
    )


@app.post("/auth/refresh", response_model=Token)
async def refresh_token_endpoint(refresh_token: str):
    """Refresh access token using refresh token"""
    token_data = verify_token(refresh_token, token_type="refresh")
    if not token_data:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    
    user = await get_user_by_id(token_data.user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    new_access_token = create_access_token(data={"sub": user["_id"], "email": user["email"]})
    new_refresh_token = create_refresh_token(data={"sub": user["_id"], "email": user["email"]})
    
    return Token(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        user=user_to_response(user)
    )


@app.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user_required)):
    """Get current user info"""
    return user_to_response(current_user)


@app.put("/auth/me", response_model=UserResponse)
async def update_me(
    user_update: UserUpdate,
    current_user: dict = Depends(get_current_user_required)
):
    """Update current user profile"""
    update_data = {}
    
    if user_update.full_name is not None:
        update_data["full_name"] = user_update.full_name
    
    if user_update.email is not None:
        # Check if email is already in use by another user
        existing = await get_user_by_email(user_update.email)
        if existing and existing["_id"] != current_user["_id"]:
            raise HTTPException(status_code=400, detail="Email already in use")
        update_data["email"] = user_update.email
    
    if update_data:
        updated_user = await update_user(current_user["_id"], update_data)
        if updated_user:
            return user_to_response(updated_user)
    
    return user_to_response(current_user)


@app.post("/auth/change-password")
async def change_password(
    password_data: PasswordChange,
    current_user: dict = Depends(get_current_user_required)
):
    """Change user password"""
    if not verify_password(password_data.current_password, current_user.get("hashed_password", "")):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    if len(password_data.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    
    hashed = get_password_hash(password_data.new_password)
    await update_user(current_user["_id"], {"hashed_password": hashed})
    
    return {"message": "Password changed successfully"}


@app.get("/auth/settings")
async def get_settings(current_user: dict = Depends(get_current_user_required)):
    """Get user settings"""
    settings = current_user.get("settings", {})
    return {
        "preferred_topic": settings.get("preferred_topic", "general"),
        "preferred_company": settings.get("preferred_company", "default"),
        "preferred_difficulty": settings.get("preferred_difficulty", "medium"),
        "preferred_duration": settings.get("preferred_duration", 30),
        "enable_tts": settings.get("enable_tts", True),
        "theme": settings.get("theme", "dark")
    }


@app.put("/auth/settings")
async def update_settings_endpoint(
    settings_data: dict,
    current_user: dict = Depends(get_current_user_required)
):
    """Update user settings"""
    current_settings = current_user.get("settings", {})
    
    for key, value in settings_data.items():
        if key in ["preferred_topic", "preferred_company", "preferred_difficulty", 
                   "preferred_duration", "enable_tts", "theme"]:
            current_settings[key] = value
    
    await update_user_settings(current_user["_id"], current_settings)
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
        response = client.audio.speech.create(
            model="playht-tts",
            voice="Fritz-PlayHT",
            input=request.text,
            response_format="wav"
        )
        
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
        content = await file.read()
        
        if file.filename.endswith('.txt'):
            resume_text = content.decode('utf-8')
        else:
            try:
                resume_text = content.decode('utf-8', errors='ignore')
            except:
                resume_text = str(content)
        
        extraction_prompt = f"""Analyze this resume and extract key information in a structured format:

RESUME TEXT:
{resume_text[:4000]}

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
            "raw_text": resume_text[:2000],
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
    current_user: Optional[dict] = Depends(get_current_user)
):
    """Start a new interview session - works for both guests and authenticated users"""
    session_id = str(uuid.uuid4())
    start_time = time.time()
    
    topic_config = INTERVIEW_TOPICS.get(session.topic, INTERVIEW_TOPICS["general"])
    company_config = COMPANY_STYLES.get(session.company_style, COMPANY_STYLES["default"])
    difficulty_config = DIFFICULTY_CONFIGS.get(session.difficulty, DIFFICULTY_CONFIGS["medium"])
    
    # Build comprehensive system prompt
    full_system_prompt = f"""{topic_config["system_prompt"]}

{company_config["style"]}

{difficulty_config["prompt_modifier"]}"""

    if session.resume_text:
        full_system_prompt += f"""

CANDIDATE'S RESUME INFORMATION:
{session.resume_text[:2000]}

Use this information to ask about specific projects and probe their claimed skills."""

    if session.job_description:
        full_system_prompt += f"""

TARGET JOB DESCRIPTION:
{session.job_description[:1500]}

Focus your questions on skills and requirements mentioned in this job description."""

    full_system_prompt += """

IMPORTANT INSTRUCTIONS:
- After each candidate response, provide a brief score (1-10) at the END of your response in this exact format: [SCORE: X/10]
- The score should reflect: accuracy, depth, communication clarity, and relevance
- Keep your main response under 60 words, then add the score
- Adapt your next question difficulty based on their performance"""
    
    # Create personalized opening message
    candidate_name = "there"
    if session.resume_text and "NAME:" in session.resume_text:
        name_match = re.search(r'NAME:\s*([^\n]+)', session.resume_text)
        candidate_name = name_match.group(1).strip() if name_match else "there"
    
    base_openings = {
        "dsa": f"Hello {candidate_name}! I'll be your interviewer today, conducting this in the style of {company_config['name']}. Let's start with Data Structures & Algorithms. Can you explain what a hash table is and when you'd use one?",
        "system_design": f"Welcome {candidate_name}! I'm conducting this system design interview {company_config['name']}-style. Let's start: How would you design a URL shortener like bit.ly?",
        "behavioral": f"Hi {candidate_name}! I'm excited to learn more about you today. This will be a {company_config['name']}-style behavioral interview. Tell me about yourself and what brings you to this opportunity?",
        "frontend": f"Hello {candidate_name}! Let's dive into frontend development, {company_config['name']}-style. Can you explain the difference between let, const, and var in JavaScript?",
        "backend": f"Welcome {candidate_name}! Let's explore backend development with a {company_config['name']} interview approach. What's the difference between SQL and NoSQL databases?",
        "general": f"Hello {candidate_name}! Welcome to your {company_config['name']}-style mock interview. Tell me about a recent project you've worked on."
    }
    
    opening = base_openings.get(session.topic, base_openings["general"])
    
    # Get user_id if authenticated
    user_id = current_user["_id"] if current_user else None
    
    # Store in memory for active session
    interview_sessions[session_id] = {
        "topic": session.topic,
        "topic_name": topic_config["name"],
        "difficulty": session.difficulty,
        "company_style": session.company_style,
        "company_name": company_config["name"],
        "system_prompt": full_system_prompt,
        "history": [{"role": "assistant", "content": opening}],
        "scores": [],
        "question_count": 1,
        "enable_tts": session.enable_tts,
        "current_difficulty_adjustment": 0,
        "start_time": start_time,
        "duration_minutes": session.duration_minutes,
        "has_resume": bool(session.resume_text),
        "has_job_description": bool(session.job_description),
        "user_id": user_id
    }
    
    # Save to MongoDB only if authenticated user
    if user_id:
        await create_interview_db({
            "session_id": session_id,
            "user_id": user_id,
            "topic": session.topic,
            "topic_name": topic_config["name"],
            "company_style": session.company_style,
            "company_name": company_config["name"],
            "difficulty": session.difficulty,
            "duration_minutes": session.duration_minutes,
            "question_count": 1,
            "transcript": [{"role": "assistant", "content": opening}],
            "has_resume": bool(session.resume_text),
            "has_job_description": bool(session.job_description),
            "status": "active"
        })
    
    return {
        "session_id": session_id,
        "topic": topic_config["name"],
        "company": company_config["name"],
        "difficulty": session.difficulty,
        "opening_message": opening,
        "enable_tts": session.enable_tts,
        "duration_minutes": session.duration_minutes,
        "has_resume": bool(session.resume_text),
        "has_job_description": bool(session.job_description),
        "is_guest": user_id is None
    }


@app.post("/interview/{session_id}/analyze")
@limiter.limit("30/minute")
async def analyze_audio(
    request: Request,
    session_id: str,
    file: UploadFile = File(...)
):
    """Process audio and continue the interview conversation"""
    
    if session_id not in interview_sessions:
        raise HTTPException(status_code=404, detail="Session not found. Please start a new interview.")
    
    session = interview_sessions[session_id]
    
    try:
        # Save temporary file
        temp_filename = f"temp_audio_{session_id}.webm"
        with open(temp_filename, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Transcribe audio
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
        
        session["history"].append({"role": "user", "content": user_text})

        # Build messages
        messages = [{"role": "system", "content": session["system_prompt"]}]
        messages.extend(session["history"])
        
        # Generate AI Response
        print("Thinking...")
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.7,
            max_tokens=200
        )
        ai_response = completion.choices[0].message.content
        print(f"AI said: {ai_response}")
        
        # Extract score
        score = None
        score_match = re.search(r'\[SCORE:\s*(\d+)/10\]', ai_response)
        if score_match:
            score = int(score_match.group(1))
            session["scores"].append(score)
            display_response = re.sub(r'\s*\[SCORE:\s*\d+/10\]', '', ai_response).strip()
        else:
            display_response = ai_response
        
        # Calculate running average
        avg_score = sum(session["scores"]) / len(session["scores"]) if session["scores"] else None
        
        # Adaptive difficulty
        if avg_score:
            if avg_score >= 8 and session["current_difficulty_adjustment"] < 2:
                session["current_difficulty_adjustment"] += 1
            elif avg_score <= 4 and session["current_difficulty_adjustment"] > -2:
                session["current_difficulty_adjustment"] -= 1
        
        session["history"].append({"role": "assistant", "content": ai_response})
        session["question_count"] += 1
        
        # Update MongoDB if user is authenticated
        if session.get("user_id"):
            await update_interview(session_id, {
                "transcript": session["history"],
                "scores": session["scores"],
                "question_count": session["question_count"]
            })
        
        # Cleanup
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
async def end_interview(session_id: str):
    """End the interview and get summary"""
    
    if session_id not in interview_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = interview_sessions[session_id]
    
    scores = session.get("scores", [])
    avg_score = round(sum(scores) / len(scores), 1) if scores else None
    min_score = min(scores) if scores else None
    max_score = max(scores) if scores else None
    
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
        "duration_seconds": duration_seconds,
        "is_guest": session.get("user_id") is None
    }
    
    # Update MongoDB if user is authenticated
    if session.get("user_id"):
        await update_interview(session_id, {
            "scores": scores,
            "average_score": avg_score,
            "transcript": session["history"],
            "summary": summary,
            "question_count": session["question_count"],
            "ended_at": datetime.utcnow(),
            "duration_seconds": duration_seconds,
            "status": "completed"
        })
    
    del interview_sessions[session_id]
    
    return result


@app.get("/interview/{session_id}/status")
def get_session_status(session_id: str):
    """Get current session status"""
    if session_id not in interview_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = interview_sessions[session_id]
    scores = session.get("scores", [])
    
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
        "has_job_description": session.get("has_job_description", False),
        "is_guest": session.get("user_id") is None
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
        "is_warning": remaining_seconds <= 300 and remaining_seconds > 0
    }


# ============== USER DATA ENDPOINTS (REQUIRE AUTH) ==============

@app.post("/user/interviews/save")
async def save_interview_to_user_history(
    session_id: str,
    current_user: dict = Depends(get_current_user_required)
):
    """Save a guest interview to authenticated user's history"""
    
    # Check if interview exists in database
    existing = await get_interview_by_session_id(session_id)
    if existing:
        if existing.get("user_id") == current_user["_id"]:
            return {"success": True, "message": "Interview already saved", "interview_id": existing["_id"]}
        elif existing.get("user_id") is None:
            # Link orphan interview to user
            await save_interview_to_user(session_id, current_user["_id"])
            return {"success": True, "message": "Interview linked to your account", "interview_id": existing["_id"]}
        else:
            raise HTTPException(status_code=403, detail="Interview belongs to another user")
    
    # If not in DB, check memory
    if session_id not in interview_sessions:
        raise HTTPException(status_code=404, detail="Session not found or already ended")
    
    session = interview_sessions[session_id]
    scores = session.get("scores", [])
    
    # Create interview record
    interview_data = {
        "session_id": session_id,
        "user_id": current_user["_id"],
        "topic": session.get("topic", "general"),
        "topic_name": session.get("topic_name", "General Technical"),
        "company_style": session.get("company_style", "default"),
        "company_name": session.get("company_name", "Standard"),
        "difficulty": session.get("difficulty", "medium"),
        "duration_minutes": session.get("duration_minutes", 30),
        "question_count": session.get("question_count", 0),
        "scores": scores,
        "average_score": round(sum(scores) / len(scores), 1) if scores else None,
        "transcript": session.get("history", []),
        "has_resume": bool(session.get("resume_text")),
        "has_job_description": bool(session.get("job_description")),
        "started_at": datetime.fromtimestamp(session.get("start_time", time.time())),
        "ended_at": datetime.utcnow(),
        "duration_seconds": int(time.time() - session.get("start_time", time.time())),
        "status": "completed"
    }
    
    result = await create_interview_db(interview_data)
    
    # Update session to mark as saved
    interview_sessions[session_id]["user_id"] = current_user["_id"]
    
    return {"success": True, "message": "Interview saved successfully", "interview_id": result["_id"]}


@app.get("/user/interviews")
async def get_user_interviews_endpoint(
    current_user: dict = Depends(get_current_user_required),
    limit: int = 20,
    offset: int = 0
):
    """Get authenticated user's interview history"""
    interviews = await db_get_user_interviews(current_user["_id"], limit=limit, skip=offset)
    
    return {
        "total": len(interviews),
        "interviews": [
            {
                "id": i.get("_id"),
                "session_id": i.get("session_id"),
                "topic": i.get("topic_name") or i.get("topic"),
                "company_style": i.get("company_name") or i.get("company_style"),
                "difficulty": i.get("difficulty"),
                "question_count": i.get("question_count"),
                "average_score": i.get("average_score"),
                "scores": i.get("scores"),
                "duration_seconds": i.get("duration_seconds"),
                "started_at": i.get("started_at").isoformat() if i.get("started_at") else None,
                "ended_at": i.get("ended_at").isoformat() if i.get("ended_at") else None
            }
            for i in interviews if i.get("status") == "completed"
        ]
    }


@app.get("/user/interviews/{interview_id}")
async def get_user_interview_detail(
    interview_id: str,
    current_user: dict = Depends(get_current_user_required)
):
    """Get detailed view of a specific interview"""
    from database import get_interview_by_id
    
    interview = await get_interview_by_id(interview_id)
    
    if not interview or interview.get("user_id") != current_user["_id"]:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    return {
        "id": interview.get("_id"),
        "session_id": interview.get("session_id"),
        "topic": interview.get("topic_name") or interview.get("topic"),
        "company_style": interview.get("company_name") or interview.get("company_style"),
        "difficulty": interview.get("difficulty"),
        "duration_minutes": interview.get("duration_minutes"),
        "question_count": interview.get("question_count"),
        "scores": interview.get("scores"),
        "average_score": interview.get("average_score"),
        "transcript": interview.get("transcript"),
        "summary": interview.get("summary"),
        "strengths": interview.get("strengths"),
        "improvements": interview.get("improvements"),
        "has_resume": interview.get("has_resume"),
        "has_job_description": interview.get("has_job_description"),
        "started_at": interview.get("started_at").isoformat() if interview.get("started_at") else None,
        "ended_at": interview.get("ended_at").isoformat() if interview.get("ended_at") else None,
        "duration_seconds": interview.get("duration_seconds")
    }


@app.delete("/user/interviews/{interview_id}")
async def delete_user_interview_endpoint(
    interview_id: str,
    current_user: dict = Depends(get_current_user_required)
):
    """Delete a specific interview from user's history"""
    deleted = await db_delete_interview(interview_id, current_user["_id"])
    
    if not deleted:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    return {"message": "Interview deleted successfully"}


@app.get("/user/stats")
async def get_user_stats_endpoint(current_user: dict = Depends(get_current_user_required)):
    """Get user statistics"""
    stats = await db_get_user_stats(current_user["_id"])
    xp_data = current_user.get("xp_data", {})
    
    return {
        "total_interviews": xp_data.get("total_interviews", stats.get("total_interviews", 0)),
        "total_questions": xp_data.get("total_questions", stats.get("total_questions", 0)),
        "average_score": xp_data.get("average_score", stats.get("average_score", 0)),
        "perfect_scores": xp_data.get("perfect_scores", stats.get("perfect_scores", 0)),
        "current_streak": xp_data.get("current_streak", 0),
        "longest_streak": xp_data.get("longest_streak", 0),
        "topics_practiced": stats.get("topics_practiced", [])
    }


@app.get("/user/xp")
async def get_user_xp(current_user: dict = Depends(get_current_user_required)):
    """Get user XP and level info"""
    xp_data = current_user.get("xp_data", {"total_xp": 0})
    total_xp = xp_data.get("total_xp", 0)
    level_info = calculate_level(total_xp)
    
    return {
        "total_xp": total_xp,
        "level": level_info["level"],
        "current_xp": level_info["current_xp"],
        "xp_to_next_level": level_info["xp_to_next_level"],
        "progress": level_info["progress"],
        "current_streak": xp_data.get("current_streak", 0),
        "longest_streak": xp_data.get("longest_streak", 0)
    }


def calculate_level(total_xp: int) -> dict:
    """Calculate level from total XP"""
    level = 1
    xp_for_next = 100
    remaining_xp = total_xp
    
    while remaining_xp >= xp_for_next:
        remaining_xp -= xp_for_next
        level += 1
        xp_for_next = int(xp_for_next * 1.2)
    
    return {
        "level": level,
        "current_xp": remaining_xp,
        "xp_to_next_level": xp_for_next,
        "progress": round((remaining_xp / xp_for_next) * 100, 1)
    }


@app.post("/user/xp/add")
async def add_user_xp(
    score: int,
    difficulty: str,
    question_count: int,
    current_user: dict = Depends(get_current_user_required)
):
    """Add XP based on interview performance"""
    difficulty_multipliers = {"easy": 1.0, "medium": 1.25, "hard": 1.5}
    multiplier = difficulty_multipliers.get(difficulty, 1.0)
    
    base_xp = score * 10
    question_bonus = question_count * 5
    xp_earned = int((base_xp + question_bonus) * multiplier)
    
    xp_data = current_user.get("xp_data", {"total_xp": 0})
    xp_data["total_xp"] = xp_data.get("total_xp", 0) + xp_earned
    xp_data["total_interviews"] = xp_data.get("total_interviews", 0) + 1
    xp_data["total_questions"] = xp_data.get("total_questions", 0) + question_count
    
    if score >= 9:
        xp_data["perfect_scores"] = xp_data.get("perfect_scores", 0) + 1
    
    # Update streak
    today = datetime.utcnow().date()
    last_activity = xp_data.get("last_activity_date")
    
    if last_activity:
        if isinstance(last_activity, str):
            last_activity = datetime.fromisoformat(last_activity).date()
        elif isinstance(last_activity, datetime):
            last_activity = last_activity.date()
        
        if (today - last_activity).days == 1:
            xp_data["current_streak"] = xp_data.get("current_streak", 0) + 1
        elif (today - last_activity).days > 1:
            xp_data["current_streak"] = 1
    else:
        xp_data["current_streak"] = 1
    
    xp_data["longest_streak"] = max(xp_data.get("longest_streak", 0), xp_data.get("current_streak", 0))
    xp_data["last_activity_date"] = datetime.utcnow()
    
    await update_user_xp(current_user["_id"], xp_data)
    
    # Check achievements
    achievements_earned = await check_achievements(current_user["_id"], xp_data, score)
    
    level_info = calculate_level(xp_data["total_xp"])
    
    return {
        "xp_earned": xp_earned,
        "total_xp": xp_data["total_xp"],
        "level": level_info["level"],
        "progress": level_info["progress"],
        "new_achievements": achievements_earned
    }


async def check_achievements(user_id: str, xp_data: dict, latest_score: int) -> list:
    """Check and award achievements"""
    user = await get_user_by_id(user_id)
    current_achievements = [a["achievement_id"] for a in user.get("achievements", [])]
    new_achievements = []
    
    # Check each achievement
    achievement_checks = {
        "first_interview": xp_data.get("total_interviews", 0) >= 1,
        "perfect_10": latest_score == 10,
        "streak_3": xp_data.get("current_streak", 0) >= 3,
        "streak_7": xp_data.get("current_streak", 0) >= 7,
        "streak_30": xp_data.get("current_streak", 0) >= 30,
        "questions_10": xp_data.get("total_questions", 0) >= 10,
        "questions_50": xp_data.get("total_questions", 0) >= 50,
        "questions_100": xp_data.get("total_questions", 0) >= 100,
        "interviews_5": xp_data.get("total_interviews", 0) >= 5,
        "interviews_20": xp_data.get("total_interviews", 0) >= 20,
    }
    
    for ach_id, condition in achievement_checks.items():
        if condition and ach_id not in current_achievements:
            await add_user_achievement(user_id, ach_id)
            achievement = next((a for a in ACHIEVEMENTS if a["id"] == ach_id), None)
            if achievement:
                new_achievements.append(achievement)
                # Award XP for achievement
                xp_data["total_xp"] = xp_data.get("total_xp", 0) + achievement["xp_reward"]
    
    if new_achievements:
        await update_user_xp(user_id, xp_data)
    
    return new_achievements


@app.get("/user/achievements")
async def get_user_achievements(current_user: dict = Depends(get_current_user_required)):
    """Get user's achievements"""
    user_achievements = current_user.get("achievements", [])
    unlocked_ids = {a["achievement_id"] for a in user_achievements}
    unlocked_dates = {a["achievement_id"]: a.get("unlocked_at") for a in user_achievements}
    
    return {
        "achievements": [
            {
                **achievement,
                "unlocked": achievement["id"] in unlocked_ids,
                "unlocked_at": unlocked_dates.get(achievement["id"])
            }
            for achievement in ACHIEVEMENTS
        ],
        "total_unlocked": len(unlocked_ids),
        "total_achievements": len(ACHIEVEMENTS)
    }


class UserSyncData(BaseModel):
    total_xp: int = 0
    achievements: List[str] = []
    stats: Optional[dict] = None


@app.post("/user/sync")
async def sync_user_data(
    data: UserSyncData,
    current_user: dict = Depends(get_current_user_required)
):
    """
    Sync local guest data with user's server profile.
    Called after login/register to merge progress made as guest.
    """
    xp_data = current_user.get("xp_data", {"total_xp": 0})
    xp_before = xp_data.get("total_xp", 0)
    
    # Sync XP - take maximum
    if data.total_xp > 0:
        xp_data["total_xp"] = max(xp_data.get("total_xp", 0), data.total_xp)
    
    # Sync stats
    if data.stats:
        if data.stats.get('totalInterviews', 0) > xp_data.get('total_interviews', 0):
            xp_data['total_interviews'] = data.stats['totalInterviews']
        if data.stats.get('perfectScores', 0) > xp_data.get('perfect_scores', 0):
            xp_data['perfect_scores'] = data.stats['perfectScores']
        if data.stats.get('streak', 0) > xp_data.get('current_streak', 0):
            xp_data['current_streak'] = data.stats['streak']
        if data.stats.get('streak', 0) > xp_data.get('longest_streak', 0):
            xp_data['longest_streak'] = data.stats['streak']
    
    await update_user_xp(current_user["_id"], xp_data)
    
    # Sync achievements
    current_achievements = [a["achievement_id"] for a in current_user.get("achievements", [])]
    added_achievements = []
    
    for ach_id in data.achievements:
        if ach_id not in current_achievements:
            ach_def = next((a for a in ACHIEVEMENTS if a["id"] == ach_id), None)
            if ach_def:
                await add_user_achievement(current_user["_id"], ach_id)
                added_achievements.append(ach_id)
    
    return {
        "success": True,
        "xp_before": xp_before,
        "xp_after": xp_data["total_xp"],
        "xp_synced": xp_data["total_xp"] - xp_before,
        "achievements_added": added_achievements,
        "total_achievements": len(current_achievements) + len(added_achievements)
    }


@app.get("/user/dashboard")
async def get_user_dashboard(current_user: dict = Depends(get_current_user_required)):
    """Get comprehensive dashboard data"""
    xp_data = current_user.get("xp_data", {"total_xp": 0})
    level_info = calculate_level(xp_data.get("total_xp", 0))
    
    user_achievements = current_user.get("achievements", [])
    unlocked_ids = [a["achievement_id"] for a in user_achievements]
    
    recent_interviews = await db_get_user_interviews(current_user["_id"], limit=10)
    
    interview_history = [
        {
            "id": i.get("_id"),
            "date": i.get("started_at").isoformat() if i.get("started_at") else None,
            "topic": i.get("topic_name") or i.get("topic"),
            "difficulty": i.get("difficulty"),
            "score": i.get("average_score"),
            "questions": i.get("question_count")
        }
        for i in recent_interviews if i.get("status") == "completed"
    ]
    
    return {
        "user": {
            "id": current_user["_id"],
            "username": current_user.get("username"),
            "email": current_user.get("email"),
            "full_name": current_user.get("full_name"),
            "is_premium": current_user.get("is_premium", False),
            "member_since": current_user.get("created_at").isoformat() if current_user.get("created_at") else None
        },
        "xp": {
            "total_xp": xp_data.get("total_xp", 0),
            "level": level_info["level"],
            "current_xp": level_info["current_xp"],
            "xp_to_next_level": level_info["xp_to_next_level"],
            "progress": level_info["progress"]
        },
        "stats": {
            "total_interviews": xp_data.get("total_interviews", 0),
            "total_questions": xp_data.get("total_questions", 0),
            "average_score": round(xp_data.get("average_score", 0), 1),
            "perfect_scores": xp_data.get("perfect_scores", 0),
            "current_streak": xp_data.get("current_streak", 0),
            "longest_streak": xp_data.get("longest_streak", 0)
        },
        "achievements": {
            "unlocked": unlocked_ids,
            "total_unlocked": len(unlocked_ids),
            "total_available": len(ACHIEVEMENTS)
        },
        "recent_interviews": interview_history
    }


# ============== FEEDBACK & COACHING ENDPOINTS ==============

@app.post("/interview/{session_id}/question-feedback")
async def get_question_feedback(session_id: str):
    """Generate detailed feedback for each question-answer pair"""
    
    if session_id not in interview_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = interview_sessions[session_id]
    history = session["history"]
    scores = session.get("scores", [])
    
    qa_pairs = []
    current_question = None
    score_index = 0
    
    for msg in history:
        if msg["role"] == "assistant":
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
    
    detailed_feedback = []
    
    for qa in qa_pairs[:5]:  # Limit to first 5 for performance
        feedback_prompt = f"""Analyze this interview Q&A briefly:

QUESTION: {qa['question']}
ANSWER: {qa['answer']}
SCORE: {qa['score']}/10

Give 2-3 sentences of feedback and suggest a better answer in 2-3 sentences."""

        try:
            completion = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": feedback_prompt}],
                temperature=0.5,
                max_tokens=200
            )
            feedback = completion.choices[0].message.content
        except:
            feedback = "Unable to generate feedback."
        
        detailed_feedback.append({
            **qa,
            "feedback": feedback
        })
    
    return {
        "session_id": session_id,
        "feedback": detailed_feedback,
        "total_questions": len(qa_pairs)
    }


@app.get("/interview/{session_id}/coaching")
async def get_coaching_tips(session_id: str):
    """Generate personalized coaching based on interview performance"""
    
    if session_id not in interview_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = interview_sessions[session_id]
    history = session["history"]
    scores = session.get("scores", [])
    
    avg_score = sum(scores) / len(scores) if scores else 0
    
    coaching_prompt = f"""Based on this {session.get('topic_name', 'technical')} interview:

Average score: {avg_score:.1f}/10
Total questions: {session['question_count']}
Difficulty: {session['difficulty']}

Recent responses:
{chr(10).join([f"- {msg['content'][:100]}..." for msg in history[-6:] if msg['role'] == 'user'])}

Provide 3 specific, actionable coaching tips to improve performance."""

    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": coaching_prompt}],
            temperature=0.5,
            max_tokens=300
        )
        coaching = completion.choices[0].message.content
    except:
        coaching = "Keep practicing and focus on clear, structured answers."
    
    return {
        "session_id": session_id,
        "coaching": coaching,
        "average_score": round(avg_score, 1),
        "questions_analyzed": session["question_count"]
    }


# ============== GLOBAL STATS ==============

@app.get("/stats/global")
async def get_global_stats():
    """Get platform-wide statistics (public)"""
    db = get_database()
    
    total_interviews = await db.interviews.count_documents({"status": "completed"})
    total_users = await db.users.count_documents({})
    
    pipeline = [
        {"$match": {"status": "completed", "average_score": {"$exists": True, "$ne": None}}},
        {"$group": {"_id": None, "avg_score": {"$avg": "$average_score"}}}
    ]
    
    cursor = db.interviews.aggregate(pipeline)
    results = await cursor.to_list(length=1)
    platform_avg = round(results[0]["avg_score"], 1) if results else None
    
    return {
        "total_interviews_completed": total_interviews,
        "total_users": total_users,
        "platform_average_score": platform_avg,
        "topics_available": len(INTERVIEW_TOPICS),
        "companies_available": len(COMPANY_STYLES)
    }


# ============== EXPORT ENDPOINT ==============

@app.post("/interview/{session_id}/export")
async def export_interview_report(session_id: str):
    """Generate exportable interview report"""
    
    if session_id not in interview_sessions:
        # Check database for completed interview
        interview = await get_interview_by_session_id(session_id)
        if not interview:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return {
            "session_id": session_id,
            "report": {
                "topic": interview.get("topic_name") or interview.get("topic"),
                "company_style": interview.get("company_name") or interview.get("company_style"),
                "difficulty": interview.get("difficulty"),
                "average_score": interview.get("average_score"),
                "summary": interview.get("summary"),
                "date": interview.get("started_at").isoformat() if interview.get("started_at") else None
            }
        }
    
    session = interview_sessions[session_id]
    scores = session.get("scores", [])
    
    return {
        "session_id": session_id,
        "report": {
            "topic": session.get("topic_name", session["topic"]),
            "company_style": session.get("company_name", "Standard"),
            "difficulty": session["difficulty"],
            "total_questions": session["question_count"],
            "average_score": round(sum(scores) / len(scores), 1) if scores else None,
            "scores": scores,
            "transcript": session["history"]
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
