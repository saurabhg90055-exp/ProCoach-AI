"""
Database configuration and models for AI Interviewer
Phase 5: Backend Architecture
"""

from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os

# Database URL - SQLite for development, PostgreSQL for production
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./ai_interviewer.db")

# Create engine
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


# ============== DATABASE MODELS ==============

class User(Base):
    """User account model"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    is_premium = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    interviews = relationship("Interview", back_populates="user")
    settings = relationship("UserSettings", back_populates="user", uselist=False)


class UserSettings(Base):
    """User preferences and settings"""
    __tablename__ = "user_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    preferred_topic = Column(String(50), default="general")
    preferred_company = Column(String(50), default="default")
    preferred_difficulty = Column(String(20), default="medium")
    preferred_duration = Column(Integer, default=30)
    enable_tts = Column(Boolean, default=True)
    theme = Column(String(20), default="dark")
    
    # Relationships
    user = relationship("User", back_populates="settings")


class Interview(Base):
    """Interview session record"""
    __tablename__ = "interviews"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(36), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Nullable for guest users
    
    # Interview configuration
    topic = Column(String(50), nullable=False)
    topic_name = Column(String(100))
    company_style = Column(String(50))
    company_name = Column(String(100))
    difficulty = Column(String(20))
    duration_minutes = Column(Integer, default=30)
    
    # Interview data
    question_count = Column(Integer, default=0)
    scores = Column(JSON, default=list)  # List of scores
    average_score = Column(Float, nullable=True)
    transcript = Column(JSON, default=list)  # Full conversation history
    
    # Metadata
    has_resume = Column(Boolean, default=False)
    has_job_description = Column(Boolean, default=False)
    resume_summary = Column(Text, nullable=True)
    job_description_summary = Column(Text, nullable=True)
    
    # AI-generated feedback
    summary = Column(Text, nullable=True)
    strengths = Column(JSON, default=list)
    improvements = Column(JSON, default=list)
    
    # Timestamps
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    
    # Status
    status = Column(String(20), default="active")  # active, completed, abandoned
    
    # Relationships
    user = relationship("User", back_populates="interviews")
    questions = relationship("InterviewQuestion", back_populates="interview")


class InterviewQuestion(Base):
    """Individual question-answer pairs with feedback"""
    __tablename__ = "interview_questions"
    
    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(Integer, ForeignKey("interviews.id"))
    question_number = Column(Integer)
    
    # Q&A content
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=True)
    
    # Scoring
    score = Column(Integer, nullable=True)
    category = Column(String(20), nullable=True)  # excellent, good, needs_improvement, poor
    
    # AI feedback
    feedback = Column(Text, nullable=True)
    better_answer = Column(Text, nullable=True)
    
    # Metadata
    response_time_seconds = Column(Integer, nullable=True)
    word_count = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    interview = relationship("Interview", back_populates="questions")


class APIUsage(Base):
    """Track API usage for rate limiting and analytics"""
    __tablename__ = "api_usage"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    ip_address = Column(String(45))  # IPv6 compatible
    endpoint = Column(String(100))
    method = Column(String(10))
    status_code = Column(Integer)
    response_time_ms = Column(Integer)
    tokens_used = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class GlobalStats(Base):
    """Global platform statistics"""
    __tablename__ = "global_stats"
    
    id = Column(Integer, primary_key=True, index=True)
    stat_key = Column(String(50), unique=True, index=True)
    stat_value = Column(String(255))
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserXP(Base):
    """User XP and gamification data"""
    __tablename__ = "user_xp"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    total_xp = Column(Integer, default=0)
    current_level = Column(Integer, default=1)
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    last_activity_date = Column(DateTime, nullable=True)
    total_interviews = Column(Integer, default=0)
    total_questions = Column(Integer, default=0)
    perfect_scores = Column(Integer, default=0)
    average_score = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserAchievement(Base):
    """User unlocked achievements"""
    __tablename__ = "user_achievements"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    achievement_id = Column(String(50), nullable=False)
    unlocked_at = Column(DateTime, default=datetime.utcnow)
    
    # Composite unique constraint
    __table_args__ = (
        {'extend_existing': True}
    )


# ============== DATABASE UTILITIES ==============

def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created successfully!")


def reset_db():
    """Reset database (for development only)"""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("🔄 Database reset successfully!")


if __name__ == "__main__":
    init_db()
