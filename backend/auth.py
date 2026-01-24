"""
Authentication utilities for AI Interviewer
MongoDB-based authentication with JWT tokens
"""

import os
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer

from database import get_user_by_email, get_user_by_username, get_user_by_id, create_user_db

# ============== CONFIGURATION ==============

SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production-ai-interviewer-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)


# ============== PYDANTIC MODELS ==============

class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str
    full_name: Optional[str] = None


class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    full_name: Optional[str]
    is_active: bool
    is_premium: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    email: str
    password: str


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user: UserResponse


class TokenData(BaseModel):
    user_id: Optional[str] = None
    email: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None


# ============== PASSWORD UTILITIES ==============

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)


# ============== TOKEN UTILITIES ==============

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a new JWT access token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """Create a new JWT refresh token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str, token_type: str = "access") -> Optional[TokenData]:
    """Verify and decode a JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != token_type:
            return None
        user_id: str = payload.get("sub")
        email: str = payload.get("email")
        if user_id is None:
            return None
        return TokenData(user_id=user_id, email=email)
    except JWTError:
        return None


# ============== USER UTILITIES (ASYNC FOR MONGODB) ==============

async def create_user(user: UserCreate) -> dict:
    """Create a new user in MongoDB"""
    hashed_password = get_password_hash(user.password)
    user_data = {
        "email": user.email,
        "username": user.username,
        "hashed_password": hashed_password,
        "full_name": user.full_name,
        "is_active": True,
        "is_premium": False
    }
    return await create_user_db(user_data)


async def authenticate_user(email: str, password: str) -> Optional[dict]:
    """Authenticate user with email and password"""
    user = await get_user_by_email(email)
    if not user:
        return None
    if not verify_password(password, user.get("hashed_password", "")):
        return None
    return user


# ============== DEPENDENCY FUNCTIONS (ASYNC) ==============

async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme)
) -> Optional[dict]:
    """Get current authenticated user (optional - returns None if not authenticated)"""
    if not token:
        return None
    
    token_data = verify_token(token)
    if not token_data:
        return None
    
    user = await get_user_by_id(token_data.user_id)
    if not user or not user.get("is_active", False):
        return None
    
    return user


async def get_current_user_required(
    token: str = Depends(oauth2_scheme)
) -> dict:
    """Get current authenticated user (required - raises error if not authenticated)"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not token:
        raise credentials_exception
    
    token_data = verify_token(token)
    if not token_data:
        raise credentials_exception
    
    user = await get_user_by_id(token_data.user_id)
    if not user:
        raise credentials_exception
    
    if not user.get("is_active", False):
        raise HTTPException(status_code=400, detail="Inactive user")
    
    return user


async def get_premium_user(
    user: dict = Depends(get_current_user_required)
) -> dict:
    """Require premium user access"""
    if not user.get("is_premium", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Premium subscription required"
        )
    return user


def user_to_response(user: dict) -> UserResponse:
    """Convert MongoDB user document to UserResponse"""
    return UserResponse(
        id=user.get("_id", ""),
        email=user.get("email", ""),
        username=user.get("username", ""),
        full_name=user.get("full_name"),
        is_active=user.get("is_active", True),
        is_premium=user.get("is_premium", False),
        created_at=user.get("created_at", datetime.utcnow())
    )
