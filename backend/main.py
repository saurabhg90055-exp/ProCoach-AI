"""
AI Interviewer Backend API
MongoDB-powered backend with guest/authenticated user support
"""

import os
import uuid
import io
import re
import time
import asyncio
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
import edge_tts
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

# Language code mapping for Whisper and TTS
LANGUAGE_CODES = {
    'en-US': 'en', 'en-GB': 'en', 'en-IN': 'en',
    'es-ES': 'es', 'es-MX': 'es',
    'fr-FR': 'fr',
    'de-DE': 'de',
    'it-IT': 'it',
    'pt-BR': 'pt', 'pt-PT': 'pt',
    'ru-RU': 'ru',
    'ja-JP': 'ja',
    'ko-KR': 'ko',
    'zh-CN': 'zh', 'zh-TW': 'zh',
    'ar-SA': 'ar',
    'hi-IN': 'hi',
    'ta-IN': 'ta',
    'te-IN': 'te',
    'bn-IN': 'bn',
    'mr-IN': 'mr',
    'gu-IN': 'gu',
    'kn-IN': 'kn',
    'ml-IN': 'ml',
    'pa-IN': 'pa',
    'or-IN': 'or',
    'ur-PK': 'ur',
    'nl-NL': 'nl',
    'pl-PL': 'pl',
    'tr-TR': 'tr',
    'vi-VN': 'vi',
    'th-TH': 'th',
    'id-ID': 'id',
    'ms-MY': 'ms',
    'he-IL': 'he',
    'sv-SE': 'sv',
    'da-DK': 'da',
    'fi-FI': 'fi',
    'no-NO': 'no',
    'uk-UA': 'uk',
    'cs-CZ': 'cs',
    'el-GR': 'el',
    'ro-RO': 'ro',
    'hu-HU': 'hu',
    'fil-PH': 'tl',
    'ne-NP': 'ne',
    'si-LK': 'si'
}

# Language-specific interview prompts
LANGUAGE_PROMPTS = {
    'hi': "आप एक पेशेवर AI साक्षात्कारकर्ता हैं। कृपया हिंदी में जवाब दें।",
    'ta': "நீங்கள் ஒரு தொழில்முறை AI நேர்காணல் எடுப்பவர். தமிழில் பதிலளிக்கவும்.",
    'te': "మీరు ఒక ప్రొఫెషనల్ AI ఇంటర్వ్యూయర్. దయచేసి తెలుగులో సమాధానం ఇవ్వండి.",
    'bn': "আপনি একজন পেশাদার AI সাক্ষাৎকার গ্রহণকারী। দয়া করে বাংলায় উত্তর দিন।",
    'mr': "तुम्ही एक व्यावसायिक AI मुलाखतकार आहात. कृपया मराठीत उत्तर द्या.",
    'gu': "તમે એક વ્યાવસાયિક AI ઇન્ટરવ્યુઅર છો. કૃપા કરીને ગુજરાતીમાં જવાબ આપો.",
    'kn': "ನೀವು ವೃತ್ತಿಪರ AI ಸಂದರ್ಶಕರು. ದಯವಿಟ್ಟು ಕನ್ನಡದಲ್ಲಿ ಉತ್ತರಿಸಿ.",
    'ml': "നിങ്ങൾ ഒരു പ്രൊഫഷണൽ AI ഇന്റർവ്യൂവർ ആണ്. ദയവായി മലയാളത്തിൽ ഉത്തരം നൽകുക.",
    'pa': "ਤੁਸੀਂ ਇੱਕ ਪੇਸ਼ੇਵਰ AI ਇੰਟਰਵਿਊਅਰ ਹੋ। ਕਿਰਪਾ ਕਰਕੇ ਪੰਜਾਬੀ ਵਿੱਚ ਜਵਾਬ ਦਿਓ।",
    'ur': "آپ ایک پیشہ ور AI انٹرویو لینے والے ہیں۔ براہ کرم اردو میں جواب دیں۔",
    'es': "Eres un entrevistador de IA profesional. Por favor responde en español.",
    'fr': "Vous êtes un intervieweur IA professionnel. Veuillez répondre en français.",
    'de': "Sie sind ein professioneller KI-Interviewer. Bitte antworten Sie auf Deutsch.",
    'ja': "あなたはプロのAIインタビュアーです。日本語で回答してください。",
    'ko': "당신은 전문 AI 인터뷰어입니다. 한국어로 대답해 주세요.",
    'zh': "你是一位专业的AI面试官。请用中文回答。",
    'ar': "أنت محاور ذكاء اصطناعي محترف. الرجاء الرد باللغة العربية.",
    'ru': "Вы профессиональный AI-интервьюер. Пожалуйста, отвечайте на русском языке.",
    'pt': "Você é um entrevistador de IA profissional. Por favor, responda em português.",
    'it': "Sei un intervistatore AI professionale. Per favore rispondi in italiano.",
}

# Company interview styles with enhanced personality
COMPANY_STYLES = {
    "google": {
        "name": "Google",
        "style": """GOOGLE INTERVIEW STYLE:
You embody Google's intellectual curiosity and collaborative spirit.
- Use Socratic method: "What if we changed this constraint?", "How would you optimize that?"
- Focus on algorithmic thinking and time/space complexity
- Encourage thinking out loud: "Walk me through your thought process..."
- Be friendly but rigorous: "That's clever! Now what about edge cases?"
- Use "Googley" phrases: "Let's think about this at scale...", "What's the most elegant solution?"""
    },
    "amazon": {
        "name": "Amazon",
        "style": """AMAZON LEADERSHIP PRINCIPLES STYLE:
You interview like a seasoned Amazon Bar Raiser, deeply focused on Leadership Principles.
- Always probe for specifics using STAR: "Tell me about a specific time when..."
- Reference LPs naturally: "That shows great Customer Obsession", "How did you demonstrate Ownership?"
- Dig deep: "What did YOU specifically do?", "What was the measurable impact?"
- Be direct but professional: "I need more concrete details here..."
- Look for data: "What were the metrics?", "How did you measure success?"""
    },
    "meta": {
        "name": "Meta",
        "style": """META/FACEBOOK INTERVIEW STYLE:
You embody Meta's "Move Fast" culture while maintaining technical rigor.
- Be direct and efficient: "Let's get straight to it...", "What's the fastest path to solution?"
- Focus on impact: "How would this affect 3 billion users?", "What's the real-world impact?"
- Encourage practical thinking: "In production at Meta scale, what breaks?"
- Value shipping: "How would you MVP this?", "What's the 80/20 solution?"
- Be informal but sharp: "Cool approach! What's the trade-off though?"""
    },
    "microsoft": {
        "name": "Microsoft",
        "style": """MICROSOFT INTERVIEW STYLE:
You represent Microsoft's growth mindset and collaborative culture.
- Emphasize learning: "What did you learn from that?", "How would you approach it differently now?"
- Focus on collaboration: "How did you work with the team?", "Who did you need to influence?"
- Be supportive: "That's a great foundation, let's build on it..."
- Value diverse solutions: "There's multiple ways to solve this - what's your preference and why?"
- Think enterprise: "How would this work across a large organization?"""
    },
    "startup": {
        "name": "Startup",
        "style": """STARTUP CTO INTERVIEW STYLE:
You're a hands-on startup CTO looking for versatile problem-solvers.
- Be casual but probe deeply: "Cool! So walk me through how you'd actually build this..."
- Value scrappiness: "What would you do with limited resources?", "How do you prioritize?"
- Look for initiative: "Tell me about something you built on your own", "Side projects?"
- Move fast: "If you had to ship this tomorrow, what would you cut?"
- Assess learning speed: "You haven't used X before - how would you learn it quickly?"""
    },
    "default": {
        "name": "Standard",
        "style": """PROFESSIONAL INTERVIEW STYLE:
You are a balanced, professional interviewer creating a positive experience.
- Be warm and encouraging: "Great to meet you!", "Thanks for that thoughtful answer"
- Fair assessment: Acknowledge strengths before suggesting improvements
- Natural conversation: Use transitions like "Building on that...", "Let's explore another area..."
- Constructive feedback: "Good start! To strengthen that answer, you might also consider..."""
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

# Interview topic configurations with enhanced natural speech
INTERVIEW_TOPICS = {
    "dsa": {
        "name": "Data Structures & Algorithms",
        "system_prompt": """You are Sarah, a friendly senior software engineer at a top tech company conducting a DSA interview.

PERSONALITY & SPEECH STYLE:
- Warm but professional - use phrases like "That's a great start!", "I like where you're going with this"
- Use natural transitions: "Interesting approach...", "Let me build on that...", "Now here's where it gets fun..."
- When they struggle: "No worries, let's think through this together...", "What if we break it down..."
- Celebrate wins: "Exactly right!", "Perfect!", "You nailed that one!"

TECHNICAL FOCUS:
Ask about arrays, linked lists, trees, graphs, sorting, searching, dynamic programming.
Start with easier concepts and gradually increase difficulty based on their responses.
Keep responses conversational and under 60 words. Provide gentle hints if stuck."""
    },
    "system_design": {
        "name": "System Design",
        "system_prompt": """You are Alex, a principal architect with 15 years of experience conducting a system design interview.

PERSONALITY & SPEECH STYLE:
- Thoughtful and collaborative: "Let's explore that together...", "Walk me through your thinking..."
- Use real-world context: "At scale, we'd see...", "In production, this becomes interesting because..."
- Encourage exploration: "What trade-offs do you see?", "How would this change if we 10x the users?"
- Validate good ideas: "That's a solid approach!", "Smart thinking on the caching layer"

TECHNICAL FOCUS:
Discuss scalability, databases, caching, load balancing, microservices, API design.
Start high-level, then drill into specifics they mention. Guide through the design naturally."""
    },
    "behavioral": {
        "name": "Behavioral Interview",
        "system_prompt": """You are Maya, a warm and experienced HR director conducting a behavioral interview.

PERSONALITY & SPEECH STYLE:
- Genuinely curious: "I'd love to hear more about that...", "That sounds challenging - how did you handle it?"
- Empathetic: "That must have been tough", "I can see why that was a difficult situation"
- Use STAR method naturally: "Can you walk me through a specific example?", "What was the outcome?"
- Build rapport: "That's really interesting!", "I appreciate you sharing that"

FOCUS AREAS:
Leadership, teamwork, conflict resolution, challenges overcome, career growth.
Listen for specifics and follow up naturally. Be encouraging and supportive."""
    },
    "frontend": {
        "name": "Frontend Development",
        "system_prompt": """You are Jordan, an enthusiastic senior frontend engineer who loves modern web development.

PERSONALITY & SPEECH STYLE:
- Passionate about frontend: "Oh, that's a great topic!", "Frontend has evolved so much here..."
- Practical focus: "In a real app, you'd want to consider...", "I've seen this pattern work well..."
- Debug together: "Let's think about what happens when...", "What would the user experience be if...?"
- Encouraging: "Nice catch!", "Good instinct on that one"

TECHNICAL FOCUS:
HTML, CSS, JavaScript, React, state management, performance, accessibility.
Include scenario-based questions. Explain concepts when correcting gently."""
    },
    "backend": {
        "name": "Backend Development",
        "system_prompt": """You are Marcus, a pragmatic senior backend engineer who values clean architecture.

PERSONALITY & SPEECH STYLE:
- Direct but friendly: "Good foundation, let's dig deeper...", "That works, but consider this..."
- Security-minded: "What could go wrong here?", "How would you protect against..."
- Systems thinking: "How does this scale?", "What happens under load?"
- Appreciative: "Solid answer!", "That's exactly the trade-off I was looking for"

TECHNICAL FOCUS:
APIs, databases, authentication, server architecture, security, testing.
Include real-world scenarios. Probe deeper on interesting technical points."""
    },
    "general": {
        "name": "General Technical",
        "system_prompt": """You are Sam, a friendly technical interviewer who adapts to the candidate's experience level.

PERSONALITY & SPEECH STYLE:
- Adaptable and warm: "Let's start with something fun...", "Tell me what excites you about tech"
- Encouraging: "Great explanation!", "I like how you think about that"
- Natural flow: "Building on that...", "Now let's shift gears a bit..."
- Supportive corrections: "Almost there! The key difference is...", "Good thinking, and also consider..."

Keep responses conversational (under 50 words). Be encouraging but honest about improvements."""
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
    mode: str = "audio"  # 'audio' | 'video'
    language: str = "en-US"  # Interview language code


class Message(BaseModel):
    role: str
    content: str


class TextToSpeechRequest(BaseModel):
    text: str


class EdgeTTSRequest(BaseModel):
    text: str
    voice: str = "en-US-AriaNeural"  # Default to natural female voice


class ResumeParseRequest(BaseModel):
    text: str


class ExpressionData(BaseModel):
    """Expression data captured from video interview"""
    confidence: float = 0
    eyeContact: float = 0
    emotion: str = "neutral"
    engagement: float = 0
    posture: str = "unknown"
    timestamp: Optional[int] = None


class VideoAnalysisRequest(BaseModel):
    """Request for video analysis with expression data"""
    expression_data: ExpressionData
    transcript: Optional[str] = None


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
    """Convert text to speech using Groq's enhanced TTS with better voice"""
    try:
        # Use a more natural, professional female voice for the interviewer
        # Available PlayHT voices: Fritz, Ariana, Jennifer, etc.
        # Ariana provides a warmer, more professional interview tone
        response = client.audio.speech.create(
            model="playht-tts",
            voice="Ariana-PlayHT",  # Warmer, more natural female voice
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
        # Fallback to Fritz if Ariana fails
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
        except Exception as fallback_error:
            raise HTTPException(status_code=500, detail=f"TTS failed: {str(fallback_error)}")


@app.post("/tts/edge")
async def edge_text_to_speech(request: EdgeTTSRequest):
    """
    Free Edge TTS using Microsoft's Text-to-Speech engine.
    
    Available voices (all free, high-quality neural voices):
    - en-US-AriaNeural (female, conversational - DEFAULT)
    - en-US-JennyNeural (female, professional)
    - en-US-GuyNeural (male, conversational)
    - en-US-DavisNeural (male, professional)
    - en-GB-SoniaNeural (female, British)
    - en-AU-NatashaNeural (female, Australian)
    """
    try:
        # Create communicate instance for edge-tts
        communicate = edge_tts.Communicate(request.text, request.voice)
        
        # Collect audio data in memory
        audio_buffer = io.BytesIO()
        
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_buffer.write(chunk["data"])
        
        audio_buffer.seek(0)
        
        return StreamingResponse(
            audio_buffer,
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=speech.mp3"}
        )
    except Exception as e:
        print(f"Edge TTS Error: {e}")
        raise HTTPException(status_code=500, detail=f"Edge TTS failed: {str(e)}")


@app.get("/tts/voices")
async def get_available_voices():
    """Get list of available Edge TTS voices"""
    return {
        "voices": [
            {"id": "en-US-AriaNeural", "name": "Aria", "gender": "Female", "locale": "US English", "recommended": True},
            {"id": "en-US-JennyNeural", "name": "Jenny", "gender": "Female", "locale": "US English"},
            {"id": "en-US-GuyNeural", "name": "Guy", "gender": "Male", "locale": "US English"},
            {"id": "en-US-DavisNeural", "name": "Davis", "gender": "Male", "locale": "US English"},
            {"id": "en-GB-SoniaNeural", "name": "Sonia", "gender": "Female", "locale": "UK English"},
            {"id": "en-AU-NatashaNeural", "name": "Natasha", "gender": "Female", "locale": "Australian English"},
            {"id": "en-IN-NeerjaNeural", "name": "Neerja", "gender": "Female", "locale": "Indian English"},
            {"id": "en-US-ChristopherNeural", "name": "Christopher", "gender": "Male", "locale": "US English"},
            {"id": "en-US-EricNeural", "name": "Eric", "gender": "Male", "locale": "US English"},
            {"id": "en-US-MichelleNeural", "name": "Michelle", "gender": "Female", "locale": "US English"}
        ],
        "default": "en-US-AriaNeural"
    }


@app.post("/resume/parse")
async def parse_resume(file: UploadFile = File(...)):
    """Parse resume file and extract key information using AI with enhanced question generation"""
    try:
        content = await file.read()
        
        if file.filename.endswith('.txt'):
            resume_text = content.decode('utf-8')
        else:
            try:
                resume_text = content.decode('utf-8', errors='ignore')
            except:
                resume_text = str(content)
        
        extraction_prompt = f"""Analyze this resume thoroughly and extract information for a technical interview:

RESUME TEXT:
{resume_text[:5000]}

Extract and return in this EXACT format (be specific and detailed):

NAME: [Full name of candidate]
EXPERIENCE_YEARS: [Total years of professional experience]
CURRENT_ROLE: [Most recent job title and company]
TOP_SKILLS: [Top 5 technical skills with proficiency indicators - list specific technologies]
NOTABLE_PROJECTS: [2-3 most impressive projects with brief technical details]
EDUCATION: [Degrees, institutions, relevant coursework]
CAREER_HIGHLIGHTS: [2-3 quantifiable achievements e.g., "Improved performance by 40%"]
TECHNICAL_DEPTH: [Areas where candidate shows deep expertise]
POTENTIAL_GAPS: [Skills/areas that might need probing]
SUGGESTED_QUESTIONS: [5 specific interview questions based on THIS resume, referencing actual projects/skills mentioned]

Be factual and specific. The questions should directly reference items from the resume."""

        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": extraction_prompt}],
            temperature=0.3,
            max_tokens=800
        )
        
        parsed_info = completion.choices[0].message.content
        
        return {
            "success": True,
            "raw_text": resume_text[:3000],
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

═══════════════════════════════════════════════════════════
CANDIDATE'S RESUME - CRITICAL: USE THIS FOR PERSONALIZED QUESTIONS
═══════════════════════════════════════════════════════════
{session.resume_text[:2500]}

🎯 MANDATORY RESUME-BASED QUESTIONING RULES:
1. Your FIRST 2-3 questions MUST directly reference something from their resume
2. Ask about SPECIFIC projects they mentioned: "I see you worked on [project] - tell me more about..."
3. Probe their claimed skills: "You listed [skill] - can you solve this problem using it?"
4. Challenge experience claims: "With [X] years in [role], how would you approach..."
5. Connect resume to interview topic: "Given your background in [area], how does that apply to..."

EXAMPLE GOOD OPENERS (adapt to their resume):
- "I noticed you led [project] at [company] - what was the biggest technical challenge there?"
- "You mentioned experience with [technology] - let's dive into that with a practical scenario..."
- "Your work on [achievement] caught my eye - can you walk me through the architecture?"

DO NOT ask generic questions when you have resume context. Make every question feel personalized.
═══════════════════════════════════════════════════════════"""

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
- Adapt your next question difficulty based on their performance
- Use natural speech patterns with fillers like "I see...", "Interesting!", "Let me ask you about..."
- Vary your tone: be encouraging after good answers, gently redirecting after weak ones"""

    # Add language-specific prompt if not English
    whisper_lang = LANGUAGE_CODES.get(session.language, 'en')
    if whisper_lang != 'en' and whisper_lang in LANGUAGE_PROMPTS:
        full_system_prompt += f"""

═══════════════════════════════════════════════════════════
LANGUAGE REQUIREMENT - CRITICAL
═══════════════════════════════════════════════════════════
{LANGUAGE_PROMPTS[whisper_lang]}
You MUST conduct this entire interview in the specified language.
All questions, feedback, and responses should be in this language.
═══════════════════════════════════════════════════════════"""
    
    # Create personalized opening message
    candidate_name = "there"
    resume_project = None
    resume_skill = None
    resume_role = None
    
    if session.resume_text:
        # Extract name
        name_match = re.search(r'NAME:\s*([^\n]+)', session.resume_text)
        candidate_name = name_match.group(1).strip() if name_match else "there"
        
        # Extract a project to reference
        project_match = re.search(r'(?:NOTABLE_PROJECTS|KEY_PROJECTS|PROJECTS):\s*([^\n]+)', session.resume_text, re.IGNORECASE)
        if project_match:
            resume_project = project_match.group(1).strip()[:100]
        
        # Extract top skill
        skill_match = re.search(r'(?:TOP_SKILLS|SKILLS):\s*([^\n,]+)', session.resume_text, re.IGNORECASE)
        if skill_match:
            resume_skill = skill_match.group(1).strip()
            
        # Extract current role
        role_match = re.search(r'(?:CURRENT_ROLE|ROLE):\s*([^\n]+)', session.resume_text, re.IGNORECASE)
        if role_match:
            resume_role = role_match.group(1).strip()
    
    # Generate resume-aware openings if resume is available
    if session.resume_text and (resume_project or resume_skill or resume_role):
        resume_openings = {
            "dsa": f"Hi {candidate_name}! Great to meet you. I've reviewed your background{' as a ' + resume_role if resume_role else ''} and I'm excited to dive into some DSA questions. {('I noticed you worked on ' + resume_project + ' - we might touch on that later. ') if resume_project else ''}Let's start with something foundational: Can you walk me through how you'd implement a hash map from scratch?",
            "system_design": f"Welcome {candidate_name}! I see you have experience{' as a ' + resume_role if resume_role else ''}{(' with ' + resume_skill) if resume_skill else ''}. {('Your work on ' + resume_project + ' caught my eye. ') if resume_project else ''}Let's discuss system design - imagine you need to design a system similar to something you've built before. How would you approach designing a scalable notification service?",
            "behavioral": f"Hi {candidate_name}! Thanks for joining me today. I've looked through your background{' and your role as ' + resume_role if resume_role else ''} looks really interesting. {('I\'d love to hear about ' + resume_project + ' in more detail. ') if resume_project else ''}But first, tell me a bit about yourself and what you're looking for in your next opportunity?",
            "frontend": f"Hello {candidate_name}! I see you have frontend experience{(' with ' + resume_skill) if resume_skill else ''}{' as a ' + resume_role if resume_role else ''}. {('The ' + resume_project + ' project sounds interesting! ') if resume_project else ''}Let's start by discussing something you've likely encountered - how would you optimize the performance of a React application that's getting slow?",
            "backend": f"Welcome {candidate_name}! Your background{' as a ' + resume_role if resume_role else ''}{(' working with ' + resume_skill) if resume_skill else ''} is impressive. {('I\'m curious about ' + resume_project + '. ') if resume_project else ''}Let's dive into backend concepts - can you tell me about your experience with database design and when you'd choose SQL vs NoSQL?",
            "general": f"Hi {candidate_name}! Great to connect with you. I've reviewed your resume{' - ' + resume_role if resume_role else ''} looks like a great background. {('I\'d love to hear about ' + resume_project + '. ') if resume_project else ''}Let's start with what you're most proud of from your recent work experience?"
        }
        opening = resume_openings.get(session.topic, resume_openings["general"])
    else:
        # Fallback to generic but natural openings
        base_openings = {
            "dsa": f"Hello {candidate_name}! I'll be your interviewer today, and we'll be doing this {company_config['name']}-style. Let's warm up with Data Structures & Algorithms. Can you explain what a hash table is and walk me through when you'd use one in practice?",
            "system_design": f"Welcome {candidate_name}! I'm excited to do this system design interview with you, {company_config['name']}-style. Let's start with a classic: How would you design a URL shortener like bit.ly? Feel free to think out loud.",
            "behavioral": f"Hi {candidate_name}! I'm really looking forward to getting to know you today. This will be a {company_config['name']}-style behavioral interview. To kick things off, tell me about yourself and what's driving you to explore new opportunities?",
            "frontend": f"Hello {candidate_name}! Let's have some fun with frontend development today, {company_config['name']}-style. To get started, can you explain the practical differences between let, const, and var in JavaScript?",
            "backend": f"Welcome {candidate_name}! Let's explore backend development together with a {company_config['name']} approach. To warm up, what's your experience with SQL vs NoSQL databases, and how do you decide which to use?",
            "general": f"Hello {candidate_name}! Welcome to your mock interview. I'm here to help you practice and improve. Let's start with something you know well - tell me about a recent project you've worked on that you're proud of."
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
        "user_id": user_id,
        "mode": session.mode,
        "language": session.language,
        "whisper_lang": whisper_lang,
        # Video mode specific data
        "expression_history": [],
        "video_metrics": {
            "avg_confidence": 0,
            "avg_eye_contact": 0,
            "avg_engagement": 0,
            "emotion_distribution": {},
            "confidence_trend": "stable"
        }
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
            "status": "active",
            "mode": session.mode
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
        "is_guest": user_id is None,
        "mode": session.mode
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
        
        # Get language for transcription from session
        whisper_lang = session.get("whisper_lang", "en")
        
        # Transcribe audio with correct language
        print(f"Transcribing in {whisper_lang}...")
        with open(temp_filename, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                file=(temp_filename, audio_file.read()),
                model="whisper-large-v3",
                response_format="json",
                language=whisper_lang,
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
    else:
        # Save guest interview to DB without user_id so it can be claimed later
        interview_data = {
            "session_id": session_id,
            "user_id": None,  # Will be linked when user saves to history
            "topic": session.get("topic", "general"),
            "topic_name": session.get("topic_name", "General Technical"),
            "company_style": session.get("company_style", "default"),
            "company_name": session.get("company_name", "Standard"),
            "difficulty": session.get("difficulty", "medium"),
            "duration_minutes": session.get("duration_minutes", 30),
            "question_count": session.get("question_count", 0),
            "scores": scores,
            "average_score": avg_score,
            "transcript": session.get("history", []),
            "summary": summary,
            "has_resume": bool(session.get("resume_text")),
            "has_job_description": bool(session.get("job_description")),
            "started_at": datetime.fromtimestamp(session.get("start_time", time.time())),
            "ended_at": datetime.utcnow(),
            "duration_seconds": duration_seconds,
            "status": "completed"
        }
        await create_interview_db(interview_data)
    
    del interview_sessions[session_id]
    
    return result


# ============== VIDEO INTERVIEW ENDPOINTS ==============

@app.post("/interview/{session_id}/video/expression")
async def record_expression_data(session_id: str, expression: ExpressionData):
    """Record expression data snapshot from video interview"""
    
    if session_id not in interview_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = interview_sessions[session_id]
    
    # Add timestamp if not provided
    if not expression.timestamp:
        expression.timestamp = int(time.time() * 1000)
    
    # Add to expression history
    session["expression_history"].append({
        "confidence": expression.confidence,
        "eyeContact": expression.eyeContact,
        "emotion": expression.emotion,
        "engagement": expression.engagement,
        "posture": expression.posture,
        "timestamp": expression.timestamp
    })
    
    # Update running metrics
    history = session["expression_history"]
    if len(history) > 0:
        session["video_metrics"]["avg_confidence"] = round(
            sum(h["confidence"] for h in history) / len(history), 1
        )
        session["video_metrics"]["avg_eye_contact"] = round(
            sum(h["eyeContact"] for h in history) / len(history), 1
        )
        session["video_metrics"]["avg_engagement"] = round(
            sum(h["engagement"] for h in history) / len(history), 1
        )
        
        # Calculate emotion distribution
        emotion_counts = {}
        for h in history:
            emotion_counts[h["emotion"]] = emotion_counts.get(h["emotion"], 0) + 1
        session["video_metrics"]["emotion_distribution"] = {
            k: round(v / len(history) * 100, 1) 
            for k, v in emotion_counts.items()
        }
        
        # Calculate confidence trend
        if len(history) >= 10:
            mid = len(history) // 2
            first_half_avg = sum(h["confidence"] for h in history[:mid]) / mid
            second_half_avg = sum(h["confidence"] for h in history[mid:]) / (len(history) - mid)
            if second_half_avg > first_half_avg + 10:
                session["video_metrics"]["confidence_trend"] = "improving"
            elif second_half_avg < first_half_avg - 10:
                session["video_metrics"]["confidence_trend"] = "declining"
            else:
                session["video_metrics"]["confidence_trend"] = "stable"
    
    return {
        "success": True,
        "total_samples": len(history),
        "current_metrics": session["video_metrics"]
    }


@app.get("/interview/{session_id}/video/metrics")
async def get_video_metrics(session_id: str):
    """Get current video interview metrics"""
    
    if session_id not in interview_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = interview_sessions[session_id]
    
    return {
        "session_id": session_id,
        "mode": session.get("mode", "audio"),
        "metrics": session["video_metrics"],
        "total_samples": len(session["expression_history"]),
        "expression_history": session["expression_history"][-20:]  # Last 20 samples
    }


@app.post("/interview/{session_id}/video/analyze")
@limiter.limit("30/minute")
async def analyze_video_response(
    request: Request,
    session_id: str,
    file: UploadFile = File(...),
    confidence: float = Form(0),
    eye_contact: float = Form(0),
    emotion: str = Form("neutral"),
    engagement: float = Form(0)
):
    """Process audio with expression data for video interview"""
    
    if session_id not in interview_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = interview_sessions[session_id]
    
    # Record expression data
    expression_snapshot = {
        "confidence": confidence,
        "eyeContact": eye_contact,
        "emotion": emotion,
        "engagement": engagement,
        "timestamp": int(time.time() * 1000)
    }
    session["expression_history"].append(expression_snapshot)
    
    try:
        # Save and transcribe audio (same as regular analyze)
        temp_filename = f"temp_audio_{session_id}.webm"
        with open(temp_filename, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Transcribe audio
        with open(temp_filename, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                file=audio_file,
                model="whisper-large-v3-turbo",
                response_format="text"
            )
        
        user_response = transcription.strip()
        
        # Clean up temp file
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
        
        # Add expression context to the AI prompt for video mode
        expression_context = ""
        if session.get("mode") == "video":
            # Determine coaching hint based on expression
            coaching_hint = ""
            if confidence < 40:
                coaching_hint = "The candidate appears nervous - be encouraging and supportive."
            elif confidence > 75 and engagement > 70:
                coaching_hint = "The candidate is confident and engaged - you can ask more challenging follow-ups."
            elif eye_contact < 30:
                coaching_hint = "Low eye contact detected - gently encourage them to look at the camera."
            elif emotion == "confused":
                coaching_hint = "The candidate seems confused - consider rephrasing or offering a hint."
            elif emotion == "frustrated":
                coaching_hint = "Signs of frustration - offer some encouragement before continuing."
            
            expression_context = f"""

═══════════════════════════════════════════════════════════
VIDEO INTERVIEW BODY LANGUAGE ANALYSIS
═══════════════════════════════════════════════════════════
Current expression data for this response:
📊 Confidence Level: {confidence:.0f}% {'🟢 Strong' if confidence > 70 else '🟡 Moderate' if confidence > 40 else '🔴 Low'}
👁️ Eye Contact: {eye_contact:.0f}% {'🟢 Good' if eye_contact > 60 else '🟡 Fair' if eye_contact > 30 else '🔴 Needs work'}
😊 Detected Emotion: {emotion}
⚡ Engagement Level: {engagement:.0f}%

{coaching_hint}

IMPORTANT: Naturally incorporate body language feedback when appropriate:
- If confidence is low, say something encouraging like "Take your time, you're doing well..."
- If eye contact is poor, you might say "I can tell you're thinking hard - feel free to look at me when you're ready"
- If engagement is high, match their energy!
- Do NOT robotically read out the metrics - be natural and human.
═══════════════════════════════════════════════════════════
"""
        
        # Build conversation for AI
        messages = [{"role": "system", "content": session["system_prompt"] + expression_context}]
        messages.extend(session["history"])
        messages.append({"role": "user", "content": user_response})
        
        # Get AI response
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.7,
            max_tokens=300
        )
        
        ai_response = completion.choices[0].message.content
        
        # Extract score
        score = None
        score_match = re.search(r'\[SCORE:\s*(\d+(?:\.\d+)?)/10\]', ai_response)
        if score_match:
            score = float(score_match.group(1))
            session["scores"].append(score)
            ai_response_clean = re.sub(r'\s*\[SCORE:\s*\d+(?:\.\d+)?/10\]', '', ai_response)
        else:
            ai_response_clean = ai_response
        
        # Update session history (don't add expression to history - causes API error)
        session["history"].append({"role": "user", "content": user_response})
        session["history"].append({"role": "assistant", "content": ai_response_clean})
        
        # Store expression data separately
        if "expression_snapshots" not in session:
            session["expression_snapshots"] = []
        session["expression_snapshots"].append({"expression": expression_snapshot, "score": score})
        session["question_count"] += 1
        
        # Calculate averages
        scores = session["scores"]
        avg_score = round(sum(scores) / len(scores), 1) if scores else None
        
        return {
            "transcription": user_response,
            "response": ai_response_clean,
            "score": score,
            "average_score": avg_score,
            "question_count": session["question_count"],
            "expression_data": expression_snapshot,
            "video_metrics": session["video_metrics"],
            "difficulty_trend": session["video_metrics"]["confidence_trend"]
        }
        
    except Exception as e:
        print(f"Video analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/interview/{session_id}/video/end")
async def end_video_interview(session_id: str):
    """End video interview and get comprehensive summary with expression analysis"""
    
    if session_id not in interview_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = interview_sessions[session_id]
    
    scores = session.get("scores", [])
    avg_score = round(sum(scores) / len(scores), 1) if scores else None
    min_score = min(scores) if scores else None
    max_score = max(scores) if scores else None
    
    start_time = session.get("start_time", time.time())
    duration_seconds = int(time.time() - start_time)
    
    video_metrics = session.get("video_metrics", {})
    expression_history = session.get("expression_history", [])
    
    # Generate comprehensive video summary using AI
    expression_summary = f"""
Video Interview Expression Analysis:
- Average Confidence: {video_metrics.get('avg_confidence', 0)}%
- Average Eye Contact: {video_metrics.get('avg_eye_contact', 0)}%  
- Average Engagement: {video_metrics.get('avg_engagement', 0)}%
- Confidence Trend: {video_metrics.get('confidence_trend', 'stable')}
- Emotion Distribution: {video_metrics.get('emotion_distribution', {})}
- Total Expression Samples: {len(expression_history)}
"""
    
    summary_prompt = f"""Based on this VIDEO interview conversation and expression analysis, provide a comprehensive assessment:
    
Interview Topic: {session.get('topic_name', session['topic'])}
Company Style: {session.get('company_name', 'Standard')}
Difficulty: {session['difficulty']}
Number of exchanges: {session['question_count']}
Scores: {scores}
Average score: {avg_score}/10

{expression_summary}

Conversation:
{chr(10).join([f"{msg['role'].upper()}: {msg['content']}" for msg in session['history'][:10]])}

Provide a structured VIDEO interview assessment:
1. **Overall Impression** (considering both content AND body language)
2. **Technical Performance** - Rate and explain
3. **Communication & Presence** - Rate based on expression data
4. **Confidence Analysis** - Based on {video_metrics.get('avg_confidence', 0)}% average confidence
5. **Eye Contact Assessment** - Based on {video_metrics.get('avg_eye_contact', 0)}% eye contact
6. **Body Language Strengths**
7. **Body Language Areas to Improve**
8. **Specific Recommendations** for video interviews
9. **Final Overall Score**: X/10

Be constructive and specific about video presence."""

    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": summary_prompt}],
            temperature=0.5,
            max_tokens=600
        )
        summary = completion.choices[0].message.content
    except Exception:
        summary = "Unable to generate video summary. Please try again."
    
    # Calculate combined score (50% technical, 30% confidence, 20% eye contact)
    technical_score = avg_score or 5
    confidence_score = (video_metrics.get("avg_confidence", 50) / 100) * 10
    eye_contact_score = (video_metrics.get("avg_eye_contact", 50) / 100) * 10
    
    combined_score = round(
        (technical_score * 0.5) + 
        (confidence_score * 0.3) + 
        (eye_contact_score * 0.2), 
        1
    )
    
    result = {
        "session_id": session_id,
        "mode": "video",
        "topic": session.get("topic_name", session["topic"]),
        "company_style": session.get("company_name", "Standard"),
        "difficulty": session["difficulty"],
        "total_questions": session["question_count"],
        "scores": {
            "individual": scores,
            "average": avg_score,
            "min": min_score,
            "max": max_score,
            "trend": "improving" if len(scores) >= 2 and scores[-1] > scores[0] else "stable"
        },
        "video_metrics": video_metrics,
        "combined_score": combined_score,
        "score_breakdown": {
            "technical": round(technical_score, 1),
            "confidence": round(confidence_score, 1),
            "eye_contact": round(eye_contact_score, 1)
        },
        "expression_summary": {
            "total_samples": len(expression_history),
            "confidence_trend": video_metrics.get("confidence_trend", "stable"),
            "dominant_emotion": max(
                video_metrics.get("emotion_distribution", {"neutral": 100}).items(),
                key=lambda x: x[1]
            )[0] if video_metrics.get("emotion_distribution") else "neutral"
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
            "combined_score": combined_score,
            "video_metrics": video_metrics,
            "transcript": session["history"],
            "summary": summary,
            "question_count": session["question_count"],
            "ended_at": datetime.utcnow(),
            "duration_seconds": duration_seconds,
            "status": "completed",
            "mode": "video"
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
