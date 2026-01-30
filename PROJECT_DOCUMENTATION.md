# 🎯 ProCoach AI - Complete Project Documentation

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Frontend Details](#frontend-details)
5. [Backend Details](#backend-details)
6. [Database Design](#database-design)
7. [API Endpoints](#api-endpoints)
8. [Features Breakdown](#features-breakdown)
9. [File Structure](#file-structure)
10. [Authentication Flow](#authentication-flow)
11. [AI Integration](#ai-integration)
12. [Deployment Guide](#deployment-guide)

---

## 🌟 Project Overview

**ProCoach AI** is a full-stack AI-powered mock interview platform that helps users practice and improve their interview skills with:
- Real-time voice-based interviews
- AI-powered intelligent follow-up questions  
- Multiple interview styles (Google, Amazon, Meta, Microsoft, Startup)
- Video interview mode with facial expression analysis
- Gamification with XP, levels, and achievements
- Comprehensive performance analytics

### Key Highlights
- **Version**: 2.0.0
- **Type**: Full-Stack Web Application
- **License**: MIT
- **Languages**: Python (Backend), JavaScript/React (Frontend)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                 React Frontend (Vite)                        ││
│  │  • Speech Recognition (Web Speech API)                       ││
│  │  • Audio Recording (MediaRecorder API)                       ││
│  │  • Video/Face Detection (face-api.js)                        ││
│  │  • 3D Avatar Rendering (Three.js/React Three Fiber)          ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/REST API
                              │ WebSocket (optional)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND SERVER                               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                 FastAPI Application                          ││
│  │  • JWT Authentication                                        ││
│  │  • Rate Limiting (SlowAPI)                                   ││
│  │  • CORS Middleware                                           ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│              ┌───────────────┼───────────────┐                   │
│              ▼               ▼               ▼                   │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │  Groq AI API    │ │   MongoDB       │ │  Text-to-Speech │    │
│  │  (LLaMA 3.3)    │ │   Database      │ │  (Groq PlayHT)  │    │
│  │  • Chat/Scoring │ │  • Users        │ │  • Voice Output │    │
│  │  • Transcription│ │  • Interviews   │ └─────────────────┘    │
│  └─────────────────┘ │  • Stats        │                        │
│                      └─────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 💻 Technology Stack

### Frontend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.2.0 | UI Framework - Component-based architecture |
| **Vite** | 7.2.4 | Build tool - Fast development server & bundling |
| **Framer Motion** | 12.27.2 | Animations - Smooth UI transitions |
| **Three.js** | 0.182.0 | 3D Graphics - Avatar rendering |
| **@react-three/fiber** | 9.5.0 | React Three.js integration |
| **@react-three/drei** | 10.7.7 | Three.js helpers and utilities |
| **face-api.js** | 0.22.2 | Face detection & expression analysis |
| **Lucide React** | 0.562.0 | Icons - Modern icon library |
| **Sonner** | 2.0.7 | Toast notifications |

### Backend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **FastAPI** | 0.115.0 | Web Framework - High-performance async API |
| **Uvicorn** | 0.30.0 | ASGI Server - Production-ready server |
| **Motor** | 3.3.2 | Async MongoDB driver |
| **PyMongo** | 4.6.1 | MongoDB Python driver |
| **Groq** | 0.9.0 | AI API client - LLaMA access |
| **python-jose** | 3.3.0 | JWT token handling |
| **Passlib/Bcrypt** | 1.7.4/4.1.3 | Password hashing |
| **SlowAPI** | 0.1.9 | Rate limiting |
| **Pydantic** | 2.5.3 | Data validation |

### External Services

| Service | Purpose |
|---------|---------|
| **Groq Cloud** | AI inference - LLaMA 3.3-70B model |
| **MongoDB Atlas** | Cloud database (optional) |
| **Web Speech API** | Browser speech recognition |

---

## 🎨 Frontend Details

### Component Architecture

```
src/
├── App.jsx                    # Main application entry
├── AudioRecorder.jsx          # Core interview recording component (2300+ lines)
├── main.jsx                   # React DOM entry point
│
├── components/
│   ├── audio/
│   │   └── AudioVisualizer    # Real-time audio waveform display
│   │
│   ├── auth/
│   │   └── AuthModal          # Login/Register modal
│   │
│   ├── avatar/
│   │   └── AIAvatar           # Animated AI interviewer avatar
│   │
│   ├── dashboard/
│   │   └── Dashboard          # User statistics & history
│   │
│   ├── effects/
│   │   └── ConfettiCelebration # Achievement celebration effects
│   │
│   ├── gamification/
│   │   └── XPSystem           # Levels, XP, achievements
│   │
│   ├── interview/
│   │   ├── InterviewSetup     # Interview configuration
│   │   └── InterviewSummary   # Post-interview results
│   │
│   ├── landing/
│   │   └── LandingPage        # Marketing landing page
│   │
│   ├── settings/
│   │   └── SettingsPanel      # User preferences
│   │
│   ├── theme/
│   │   └── ThemeProvider      # Dark/Light theme switching
│   │
│   ├── ui/
│   │   ├── LoadingState       # Loading indicators
│   │   ├── RecordButton       # Microphone button
│   │   ├── ScoreDisplay       # Score visualization
│   │   ├── Toast              # Notification toasts
│   │   └── TypingIndicator    # AI typing animation
│   │
│   └── video/
│       ├── CameraControls     # Video camera settings
│       ├── ExpressionIndicator # Facial expression feedback
│       ├── InterviewReplay    # Recording playback
│       ├── LanguageSelector   # Interview language selection
│       ├── LiveCaptions       # Real-time subtitles
│       ├── NetworkQuality     # Connection quality indicator
│       └── VideoFeed          # Camera video display
│
├── contexts/
│   ├── AuthContext.jsx        # Authentication state management
│   └── ToastContext.jsx       # Toast notification state
│
├── hooks/
│   ├── useAudioRecorder.js    # Audio recording logic
│   ├── useExpressionAnalysis.js # Facial expression analysis
│   ├── useFaceDetection.js    # Face detection setup
│   ├── useKeyboardShortcuts.jsx # Keyboard shortcut handling
│   └── useVideoRecording.js   # Video recording logic
│
├── services/
│   └── api.js                 # API communication service (345 lines)
│
└── utils/
    └── soundEffects.js        # Audio feedback sounds
```

### Key Frontend Features

#### 1. **AI Avatar Component** (`AIAvatar.jsx`)
- Animated professional interviewer face
- Multiple expression states: idle, speaking, listening, thinking, happy, encouraging, impressed
- Natural blinking and micro-expressions
- Breathing animation for life-like appearance
- Video mode feedback integration
- Professional glasses design

#### 2. **Audio Recording** (`AudioRecorder.jsx`)
- MediaRecorder API integration
- Real-time audio level visualization
- Speech-to-text transcription
- Noise suppression & echo cancellation
- Multi-language support

#### 3. **Face Detection** (`useFaceDetection.js`)
- face-api.js integration
- Expression recognition (happy, sad, angry, surprised, neutral)
- Confidence level calculation
- Eye contact tracking
- Engagement scoring

#### 4. **State Management**
- React Context API for global state
- Local state with useState/useReducer
- LocalStorage persistence
- Server sync for authenticated users

---

## 🔧 Backend Details

### API Structure

```
backend/
├── main.py            # FastAPI application (2076 lines)
│   ├── Lifespan management
│   ├── CORS configuration
│   ├── Rate limiting setup
│   ├── Authentication endpoints
│   ├── Interview endpoints
│   ├── User management
│   ├── TTS endpoints
│   └── Analytics endpoints
│
├── database.py        # MongoDB operations (415 lines)
│   ├── Connection management
│   ├── User CRUD operations
│   ├── Interview CRUD operations
│   ├── Statistics queries
│   └── Index creation
│
├── auth.py            # Authentication (221 lines)
│   ├── JWT token creation/verification
│   ├── Password hashing
│   ├── User authentication
│   └── Token refresh
│
├── requirements.txt   # Python dependencies
└── Dockerfile         # Container configuration
```

### Interview Topics Configuration

```python
INTERVIEW_TOPICS = {
    "dsa": "Data Structures & Algorithms",
    "system_design": "System Design",
    "behavioral": "Behavioral Interview",
    "frontend": "Frontend Development",
    "backend": "Backend Development",
    "general": "General Technical"
}
```

### Company Interview Styles

| Company | Style Focus |
|---------|-------------|
| **Google** | Algorithmic thinking, complexity analysis, Socratic method |
| **Amazon** | Leadership Principles, STAR method, metrics-driven |
| **Meta** | Move fast culture, scale thinking, practical solutions |
| **Microsoft** | Growth mindset, collaboration, enterprise scale |
| **Startup** | Versatility, scrappiness, shipping quickly |

### Difficulty Levels

| Level | Description |
|-------|-------------|
| **Easy** | Entry-level questions, more hints provided |
| **Medium** | Standard interview difficulty |
| **Hard** | Senior-level, challenging questions with deep probing |

---

## 🗄️ Database Design

### MongoDB Collections

#### Users Collection
```javascript
{
  _id: ObjectId,
  email: String (unique),
  username: String (unique),
  hashed_password: String,
  full_name: String,
  is_active: Boolean,
  is_premium: Boolean,
  created_at: DateTime,
  updated_at: DateTime,
  settings: {
    preferred_topic: String,
    preferred_company: String,
    preferred_difficulty: String,
    preferred_duration: Number,
    enable_tts: Boolean,
    theme: String
  },
  xp_data: {
    total_xp: Number,
    current_level: Number,
    current_streak: Number,
    longest_streak: Number,
    last_activity_date: DateTime,
    total_interviews: Number,
    total_questions: Number,
    perfect_scores: Number,
    average_score: Number
  },
  achievements: [String]
}
```

#### Interviews Collection
```javascript
{
  _id: ObjectId,
  session_id: String (unique),
  user_id: ObjectId (optional),
  topic: String,
  company_style: String,
  difficulty: String,
  mode: String,  // 'audio' | 'video'
  started_at: DateTime,
  ended_at: DateTime,
  duration_minutes: Number,
  questions_asked: Number,
  average_score: Number,
  transcript: [{
    role: String,
    content: String,
    timestamp: DateTime,
    score: Number (optional)
  }],
  video_data: {
    expression_summary: Object,
    confidence_average: Number,
    eye_contact_score: Number
  },
  feedback: String
}
```

### Database Indexes

```python
# User indexes
await db.users.create_index("email", unique=True)
await db.users.create_index("username", unique=True)

# Interview indexes
await db.interviews.create_index("session_id", unique=True)
await db.interviews.create_index("user_id")
await db.interviews.create_index("started_at")
```

---

## 🔌 API Endpoints

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create new user account |
| POST | `/auth/login` | Login with credentials |
| POST | `/auth/refresh` | Refresh access token |
| GET | `/auth/me` | Get current user info |
| PUT | `/auth/me` | Update user profile |
| POST | `/auth/change-password` | Change password |
| GET | `/auth/settings` | Get user settings |
| PUT | `/auth/settings` | Update settings |

### Interview Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/topics` | List available topics |
| GET | `/companies` | List company styles |
| GET | `/difficulties` | List difficulty levels |
| POST | `/interview/start` | Start new interview session |
| POST | `/interview/chat` | Send message to AI |
| POST | `/interview/end` | End interview session |
| GET | `/interview/{session_id}` | Get interview details |
| POST | `/interview/{session_id}/score` | Get answer score |

### User Data Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/user/interviews` | List user's interviews |
| POST | `/user/interviews/save` | Save interview to history |
| DELETE | `/user/interviews/{id}` | Delete interview |
| GET | `/user/stats` | Get user statistics |
| GET | `/user/dashboard` | Get dashboard data |
| POST | `/user/xp/add` | Add XP points |

### Utility Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/tts` | Text-to-speech conversion |
| POST | `/transcribe` | Audio transcription |
| POST | `/resume/parse` | Parse resume file |
| GET | `/health` | Health check |

---

## ✨ Features Breakdown

### 1. Voice-Based Interviews
- **Web Speech API** for real-time speech recognition
- **Groq Whisper** for audio file transcription
- Multi-language support (English, Spanish, French, German, etc.)
- Background noise filtering

### 2. AI Interviewer
- Powered by **Groq LLaMA 3.3-70B** model
- Context-aware follow-up questions
- Adaptive difficulty based on performance
- Company-specific interview styles
- Natural conversation flow

### 3. Video Interview Mode
- Real-time face detection
- Expression analysis (confidence, engagement)
- Eye contact tracking
- Posture assessment
- Video recording for replay

### 4. Gamification System
- **XP Points**: Earned for completing interviews
- **Levels**: Progress through levels (1-50+)
- **Streaks**: Daily practice tracking
- **Achievements**: 12+ unlockable badges
  - First Interview (50 XP)
  - Perfect 10 (100 XP)
  - Week Warrior (150 XP)
  - Century Club (300 XP)
  - And more...

### 5. Analytics Dashboard
- Interview history with full transcripts
- Score progression charts
- Performance breakdown by topic
- Improvement trends
- Weak area identification

### 6. AI Coaching Features
- STAR method detection in behavioral answers
- Filler word tracking
- Speech clarity analysis
- Personalized improvement tips
- Practice exercises generation

---

## 📁 Complete File Structure

```
ai-interviewer/
│
├── 📄 docker-compose.yml      # Container orchestration
├── 📄 README.md               # Project documentation
├── 📄 .gitignore              # Git ignore rules
│
├── 📁 backend/
│   ├── 📄 main.py             # FastAPI app (2076 lines)
│   ├── 📄 database.py         # MongoDB operations (415 lines)
│   ├── 📄 auth.py             # Authentication (221 lines)
│   ├── 📄 requirements.txt    # Python dependencies
│   ├── 📄 Dockerfile          # Backend container
│   └── 📁 __pycache__/        # Python bytecode cache
│
└── 📁 frontend/
    ├── 📄 package.json        # NPM dependencies
    ├── 📄 vite.config.js      # Vite configuration
    ├── 📄 index.html          # HTML entry point
    ├── 📄 eslint.config.js    # Linting rules
    ├── 📄 nginx.conf          # Production server config
    ├── 📄 Dockerfile          # Frontend container
    ├── 📄 README.md           # Frontend documentation
    │
    ├── 📁 public/
    │   └── 📁 models/         # Face detection models
    │       ├── face_expression_model-*
    │       ├── face_landmark_68_model-*
    │       └── tiny_face_detector_model-*
    │
    └── 📁 src/
        ├── 📄 main.jsx        # React entry
        ├── 📄 App.jsx         # Main component (368 lines)
        ├── 📄 App.css         # Global styles
        ├── 📄 index.css       # Base styles
        ├── 📄 AudioRecorder.jsx # Core component (2300+ lines)
        │
        ├── 📁 assets/         # Static assets
        │
        ├── 📁 components/
        │   ├── 📄 index.js    # Component exports
        │   │
        │   ├── 📁 audio/
        │   │   ├── 📄 AudioVisualizer.jsx
        │   │   ├── 📄 AudioVisualizer.css
        │   │   └── 📄 index.js
        │   │
        │   ├── 📁 auth/
        │   │   ├── 📄 AuthModal.jsx
        │   │   ├── 📄 AuthModal.css
        │   │   └── 📄 index.js
        │   │
        │   ├── 📁 avatar/
        │   │   ├── 📄 AIAvatar.jsx (562 lines)
        │   │   ├── 📄 AIAvatar.css (800+ lines)
        │   │   └── 📄 index.js
        │   │
        │   ├── 📁 dashboard/
        │   │   ├── 📄 Dashboard.jsx
        │   │   └── 📄 Dashboard.css
        │   │
        │   ├── 📁 effects/
        │   │   ├── 📄 ConfettiCelebration.jsx
        │   │   └── 📄 ConfettiCelebration.css
        │   │
        │   ├── 📁 gamification/
        │   │   ├── 📄 XPSystem.jsx
        │   │   └── 📄 XPSystem.css
        │   │
        │   ├── 📁 interview/
        │   │   ├── 📄 InterviewSetup.jsx
        │   │   ├── 📄 InterviewSetup.css
        │   │   ├── 📄 InterviewSummary.jsx
        │   │   └── 📄 InterviewSummary.css
        │   │
        │   ├── 📁 landing/
        │   │   ├── 📄 LandingPage.jsx
        │   │   ├── 📄 LandingPage.css
        │   │   └── 📄 index.js
        │   │
        │   ├── 📁 settings/
        │   │   ├── 📄 SettingsPanel.jsx
        │   │   └── 📄 SettingsPanel.css
        │   │
        │   ├── 📁 theme/
        │   │   ├── 📄 ThemeProvider.jsx
        │   │   └── 📄 ThemeProvider.css
        │   │
        │   ├── 📁 ui/
        │   │   ├── 📄 LoadingState.jsx
        │   │   ├── 📄 RecordButton.jsx
        │   │   ├── 📄 ScoreDisplay.jsx
        │   │   ├── 📄 Toast.jsx
        │   │   ├── 📄 TypingIndicator.jsx
        │   │   └── 📄 index.js
        │   │
        │   └── 📁 video/
        │       ├── 📄 CameraControls.jsx
        │       ├── 📄 ExpressionIndicator.jsx
        │       ├── 📄 InterviewReplay.jsx
        │       ├── 📄 LanguageSelector.jsx
        │       ├── 📄 LiveCaptions.jsx
        │       ├── 📄 NetworkQuality.jsx
        │       └── 📄 index.js
        │
        ├── 📁 contexts/
        │   ├── 📄 AuthContext.jsx
        │   └── 📄 ToastContext.jsx
        │
        ├── 📁 hooks/
        │   ├── 📄 useAudioRecorder.js
        │   ├── 📄 useExpressionAnalysis.js
        │   ├── 📄 useFaceDetection.js
        │   ├── 📄 useKeyboardShortcuts.jsx
        │   ├── 📄 useVideoRecording.js
        │   └── 📄 index.js
        │
        ├── 📁 services/
        │   └── 📄 api.js (345 lines)
        │
        └── 📁 utils/
            └── 📄 soundEffects.js
```

---

## 🔐 Authentication Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │     │   Server    │     │  Database   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │  POST /auth/register                  │
       │  {email, username, password}          │
       │ ─────────────────►│                   │
       │                   │                   │
       │                   │  Create user      │
       │                   │ ─────────────────►│
       │                   │                   │
       │                   │  Hash password    │
       │                   │  (bcrypt)         │
       │                   │                   │
       │                   │  Generate JWT     │
       │                   │  (access + refresh)
       │                   │                   │
       │  {access_token,   │                   │
       │   refresh_token}  │                   │
       │ ◄─────────────────│                   │
       │                   │                   │
       │  Store token in   │                   │
       │  localStorage     │                   │
       │                   │                   │
       │  GET /auth/me     │                   │
       │  Authorization:   │                   │
       │  Bearer {token}   │                   │
       │ ─────────────────►│                   │
       │                   │                   │
       │                   │  Verify JWT       │
       │                   │  Get user by ID   │
       │                   │ ─────────────────►│
       │                   │                   │
       │  {user data}      │                   │
       │ ◄─────────────────│                   │
       │                   │                   │
```

### Token Structure

```javascript
// Access Token (JWT)
{
  "sub": "user_id",           // User ID
  "email": "user@example.com",
  "exp": 1706700000,          // Expiration (24h)
  "type": "access"
}

// Refresh Token (JWT)
{
  "sub": "user_id",
  "email": "user@example.com",
  "exp": 1707300000,          // Expiration (7 days)
  "type": "refresh"
}
```

---

## 🤖 AI Integration

### Groq API Usage

#### 1. Chat/Interview (LLaMA 3.3-70B)
```python
response = client.chat.completions.create(
    model="llama-3.3-70b-versatile",
    messages=[
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message}
    ],
    temperature=0.7,
    max_tokens=500
)
```

#### 2. Audio Transcription (Whisper)
```python
transcription = client.audio.transcriptions.create(
    model="whisper-large-v3-turbo",
    file=audio_file,
    language=language
)
```

#### 3. Text-to-Speech (PlayHT)
```python
response = client.audio.speech.create(
    model="playht-tts",
    voice="Ariana-PlayHT",  # Professional female voice
    input=text,
    response_format="wav"
)
```

### AI Interviewer Personas

| Persona | Topic | Personality |
|---------|-------|-------------|
| **Sarah** | DSA | Warm, encouraging, technical |
| **Alex** | System Design | Thoughtful, collaborative |
| **Maya** | Behavioral | Empathetic, curious |
| **Jordan** | Frontend | Enthusiastic, practical |
| **Marcus** | Backend | Pragmatic, security-minded |
| **Sam** | General | Adaptable, supportive |

---

## 🚀 Deployment Guide

### Local Development

#### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
# Create .env with GROQ_API_KEY
uvicorn main:app --reload --port 8000
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Docker Deployment

```bash
# Set environment variables
export GROQ_API_KEY=your_api_key
export SECRET_KEY=your_secret_key

# Build and run
docker-compose up -d

# Access
# Frontend: http://localhost:80
# Backend: http://localhost:8000
```

### Production Checklist

- [ ] Set strong SECRET_KEY
- [ ] Configure MongoDB Atlas for production
- [ ] Enable HTTPS/SSL
- [ ] Set up proper CORS origins
- [ ] Configure rate limiting
- [ ] Set up monitoring/logging
- [ ] Enable database backups

---

## 📊 Performance Metrics

| Metric | Value |
|--------|-------|
| Frontend Bundle Size | ~2.5 MB (production) |
| API Response Time | <500ms average |
| TTS Latency | ~1-2 seconds |
| Transcription Speed | Real-time |
| Face Detection FPS | 30+ FPS |

---

## 🔮 Future Roadmap

- [ ] Mobile app (React Native)
- [ ] Code execution sandbox
- [ ] Team/Enterprise features
- [ ] Interview recording sharing
- [ ] AI-generated practice problems
- [ ] Interview preparation courses
- [ ] Mock interview scheduling with humans

---

## 👥 Contributors

- **Developer**: Saurabh
- **Version**: 2.0.0
- **Last Updated**: January 2026

---

## 📄 License

MIT License - Free to use and modify for personal and commercial projects.

---

*This documentation provides a comprehensive overview of the ProCoach AI project for presentation purposes. For technical questions, refer to the source code or API documentation at `/docs`.*
