"""
MongoDB Database configuration for AI Interviewer
Switched from SQLAlchemy to MongoDB for scalable document storage
"""

import os
from datetime import datetime
from typing import Optional, List, Dict, Any
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# MongoDB connection
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DATABASE_NAME = "ai_interviewer"

# Global database client
client: Optional[AsyncIOMotorClient] = None
db = None


# ============== HELPER FOR OBJECTID ==============

def str_to_objectid(id_str: str) -> Optional[ObjectId]:
    """Safely convert string to ObjectId"""
    try:
        return ObjectId(id_str)
    except:
        return None


def serialize_doc(doc: dict) -> dict:
    """Convert MongoDB document to JSON-serializable format"""
    if doc is None:
        return None
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    if "user_id" in doc and doc["user_id"] and isinstance(doc["user_id"], ObjectId):
        doc["user_id"] = str(doc["user_id"])
    return doc


# ============== DATABASE CONNECTION ==============

async def connect_to_mongo():
    """Connect to MongoDB"""
    global client, db
    try:
        client = AsyncIOMotorClient(MONGO_URI)
        db = client[DATABASE_NAME]
        
        # Test the connection
        await client.admin.command('ping')
        print(f"✅ Connected to MongoDB: {DATABASE_NAME}")
        
        # Create indexes for better performance
        await create_indexes()
        
        return db
    except Exception as e:
        print(f"❌ MongoDB connection failed: {e}")
        raise e


async def close_mongo_connection():
    """Close MongoDB connection"""
    global client
    if client:
        client.close()
        print("🔌 MongoDB connection closed")


async def create_indexes():
    """Create database indexes for better query performance"""
    global db
    if db is None:
        return
    
    # User indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("username", unique=True)
    
    # Interview indexes
    await db.interviews.create_index("session_id", unique=True)
    await db.interviews.create_index("user_id")
    await db.interviews.create_index("started_at")
    
    # Active session indexes (for persistent sessions)
    await db.active_sessions.create_index("session_id", unique=True)
    await db.active_sessions.create_index("created_at", expireAfterSeconds=7200)  # Auto-expire after 2 hours
    
    # API usage indexes
    await db.api_usage.create_index("user_id")
    await db.api_usage.create_index("created_at")
    
    # Global stats indexes
    await db.global_stats.create_index("stat_key", unique=True)
    
    print("📊 Database indexes created")


# ============== ACTIVE SESSION STORAGE (Replaces in-memory dict) ==============

async def create_active_session(session_id: str, session_data: dict) -> dict:
    """Store an active interview session in MongoDB"""
    session_data["session_id"] = session_id
    session_data["created_at"] = datetime.utcnow()
    session_data["updated_at"] = datetime.utcnow()
    
    try:
        await db.active_sessions.insert_one(session_data)
        return session_data
    except Exception as e:
        print(f"Error creating active session: {e}")
        raise e


async def get_active_session(session_id: str) -> Optional[dict]:
    """Get an active session from MongoDB"""
    session = await db.active_sessions.find_one({"session_id": session_id})
    if session:
        # Remove MongoDB _id for JSON serialization
        session.pop("_id", None)
    return session


async def update_active_session(session_id: str, update_data: dict) -> Optional[dict]:
    """Update an active session in MongoDB"""
    update_data["updated_at"] = datetime.utcnow()
    result = await db.active_sessions.update_one(
        {"session_id": session_id},
        {"$set": update_data}
    )
    if result.modified_count > 0 or result.matched_count > 0:
        return await get_active_session(session_id)
    return None


async def delete_active_session(session_id: str) -> bool:
    """Delete an active session from MongoDB"""
    result = await db.active_sessions.delete_one({"session_id": session_id})
    return result.deleted_count > 0


async def append_to_session_history(session_id: str, message: dict) -> bool:
    """Append a message to session history"""
    result = await db.active_sessions.update_one(
        {"session_id": session_id},
        {
            "$push": {"history": message},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    return result.modified_count > 0


async def append_to_session_scores(session_id: str, score: int) -> bool:
    """Append a score to session scores"""
    result = await db.active_sessions.update_one(
        {"session_id": session_id},
        {
            "$push": {"scores": score},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    return result.modified_count > 0


async def increment_session_question_count(session_id: str) -> bool:
    """Increment question count in session"""
    result = await db.active_sessions.update_one(
        {"session_id": session_id},
        {
            "$inc": {"question_count": 1},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    return result.modified_count > 0


def get_database():
    """Get database instance"""
    global db
    return db


# ============== USER CRUD OPERATIONS ==============

async def create_user_db(user_data: dict) -> dict:
    """Create a new user"""
    user_data["created_at"] = datetime.utcnow()
    user_data["updated_at"] = datetime.utcnow()
    
    # Default settings and XP data
    if "settings" not in user_data:
        user_data["settings"] = {
            "preferred_topic": "general",
            "preferred_company": "default",
            "preferred_difficulty": "medium",
            "preferred_duration": 30,
            "enable_tts": True,
            "theme": "dark"
        }
    
    if "xp_data" not in user_data:
        user_data["xp_data"] = {
            "total_xp": 0,
            "current_level": 1,
            "current_streak": 0,
            "longest_streak": 0,
            "last_activity_date": None,
            "total_interviews": 0,
            "total_questions": 0,
            "perfect_scores": 0,
            "average_score": 0
        }
    
    if "achievements" not in user_data:
        user_data["achievements"] = []
    
    result = await db.users.insert_one(user_data)
    user_data["_id"] = str(result.inserted_id)
    return user_data


async def get_user_by_email(email: str) -> Optional[dict]:
    """Get user by email"""
    user = await db.users.find_one({"email": email})
    return serialize_doc(user)


async def get_user_by_username(username: str) -> Optional[dict]:
    """Get user by username"""
    user = await db.users.find_one({"username": username})
    return serialize_doc(user)


async def get_user_by_id(user_id: str) -> Optional[dict]:
    """Get user by ID"""
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        return serialize_doc(user)
    except:
        return None


async def update_user(user_id: str, update_data: dict) -> Optional[dict]:
    """Update user data"""
    update_data["updated_at"] = datetime.utcnow()
    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_data}
    )
    if result.modified_count > 0 or result.matched_count > 0:
        return await get_user_by_id(user_id)
    return None


async def update_user_xp(user_id: str, xp_data: dict) -> Optional[dict]:
    """Update user XP data"""
    return await update_user(user_id, {"xp_data": xp_data})


async def add_user_achievement(user_id: str, achievement_id: str) -> bool:
    """Add achievement to user"""
    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$addToSet": {
                "achievements": {
                    "achievement_id": achievement_id,
                    "unlocked_at": datetime.utcnow()
                }
            },
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    return result.modified_count > 0


async def update_user_settings(user_id: str, settings: dict) -> Optional[dict]:
    """Update user settings"""
    return await update_user(user_id, {"settings": settings})


# ============== INTERVIEW CRUD OPERATIONS ==============

async def create_interview_db(interview_data: dict) -> dict:
    """Create a new interview session"""
    interview_data["started_at"] = datetime.utcnow()
    if "questions" not in interview_data:
        interview_data["questions"] = []
    if "scores" not in interview_data:
        interview_data["scores"] = []
    if "transcript" not in interview_data:
        interview_data["transcript"] = []
    if "strengths" not in interview_data:
        interview_data["strengths"] = []
    if "improvements" not in interview_data:
        interview_data["improvements"] = []
    
    result = await db.interviews.insert_one(interview_data)
    interview_data["_id"] = str(result.inserted_id)
    return interview_data


async def get_interview_by_session_id(session_id: str) -> Optional[dict]:
    """Get interview by session ID"""
    interview = await db.interviews.find_one({"session_id": session_id})
    return serialize_doc(interview)


async def get_interview_by_id(interview_id: str) -> Optional[dict]:
    """Get interview by ID"""
    try:
        interview = await db.interviews.find_one({"_id": ObjectId(interview_id)})
        return serialize_doc(interview)
    except:
        return None


async def update_interview(session_id: str, update_data: dict) -> Optional[dict]:
    """Update interview data"""
    result = await db.interviews.update_one(
        {"session_id": session_id},
        {"$set": update_data}
    )
    if result.modified_count > 0 or result.matched_count > 0:
        return await get_interview_by_session_id(session_id)
    return None


async def add_interview_question(session_id: str, question_data: dict) -> bool:
    """Add a question to an interview"""
    result = await db.interviews.update_one(
        {"session_id": session_id},
        {
            "$push": {"questions": question_data},
            "$inc": {"question_count": 1}
        }
    )
    return result.modified_count > 0


async def add_interview_score(session_id: str, score: int) -> bool:
    """Add a score to an interview"""
    result = await db.interviews.update_one(
        {"session_id": session_id},
        {"$push": {"scores": score}}
    )
    return result.modified_count > 0


async def add_transcript_message(session_id: str, message: dict) -> bool:
    """Add a message to interview transcript"""
    result = await db.interviews.update_one(
        {"session_id": session_id},
        {"$push": {"transcript": message}}
    )
    return result.modified_count > 0


async def get_user_interviews(user_id: str, limit: int = 50, skip: int = 0) -> List[dict]:
    """Get all interviews for a user"""
    cursor = db.interviews.find({"user_id": user_id}).sort("started_at", -1).skip(skip).limit(limit)
    interviews = []
    async for interview in cursor:
        interviews.append(serialize_doc(interview))
    return interviews


async def delete_interview(interview_id: str, user_id: str) -> bool:
    """Delete an interview (only if owned by user)"""
    result = await db.interviews.delete_one({
        "_id": ObjectId(interview_id),
        "user_id": user_id
    })
    return result.deleted_count > 0


async def save_interview_to_user(session_id: str, user_id: str) -> Optional[dict]:
    """Assign a guest interview to a user account"""
    result = await db.interviews.update_one(
        {"session_id": session_id},
        {"$set": {"user_id": user_id}}
    )
    if result.modified_count > 0 or result.matched_count > 0:
        return await get_interview_by_session_id(session_id)
    return None


# ============== STATS/ANALYTICS OPERATIONS ==============

async def get_user_stats(user_id: str) -> dict:
    """Get aggregated stats for a user"""
    pipeline = [
        {"$match": {"user_id": user_id, "status": "completed"}},
        {"$group": {
            "_id": "$user_id",
            "total_interviews": {"$sum": 1},
            "total_questions": {"$sum": "$question_count"},
            "all_scores": {"$push": "$scores"},
            "topics_practiced": {"$addToSet": "$topic"}
        }}
    ]
    
    cursor = db.interviews.aggregate(pipeline)
    results = await cursor.to_list(length=1)
    
    if results:
        result = results[0]
        # Flatten scores
        all_scores = []
        for scores in result.get("all_scores", []):
            if scores:
                all_scores.extend(scores)
        
        avg_score = sum(all_scores) / len(all_scores) if all_scores else 0
        perfect_scores = sum(1 for s in all_scores if s >= 9)
        
        return {
            "total_interviews": result.get("total_interviews", 0),
            "total_questions": result.get("total_questions", 0),
            "average_score": round(avg_score, 1),
            "perfect_scores": perfect_scores,
            "topics_practiced": result.get("topics_practiced", [])
        }
    
    return {
        "total_interviews": 0,
        "total_questions": 0,
        "average_score": 0,
        "perfect_scores": 0,
        "topics_practiced": []
    }


async def get_global_stat(key: str) -> Optional[str]:
    """Get a global statistic value"""
    stat = await db.global_stats.find_one({"stat_key": key})
    return stat.get("stat_value") if stat else None


async def set_global_stat(key: str, value: str):
    """Set a global statistic value"""
    await db.global_stats.update_one(
        {"stat_key": key},
        {
            "$set": {
                "stat_value": value,
                "updated_at": datetime.utcnow()
            }
        },
        upsert=True
    )


# ============== API USAGE TRACKING ==============

async def log_api_usage(usage_data: dict):
    """Log API usage for analytics"""
    usage_data["created_at"] = datetime.utcnow()
    await db.api_usage.insert_one(usage_data)


# ============== INITIALIZATION ==============

async def init_db():
    """Initialize database connection"""
    await connect_to_mongo()


async def reset_db():
    """Reset database (for development only)"""
    global db
    if db:
        await db.users.drop()
        await db.interviews.drop()
        await db.api_usage.drop()
        await db.global_stats.drop()
        await create_indexes()
        print("🔄 Database reset successfully!")


# For backwards compatibility
def get_db():
    """Returns database instance (for dependency injection compatibility)"""
    return db


if __name__ == "__main__":
    import asyncio
    asyncio.run(init_db())
