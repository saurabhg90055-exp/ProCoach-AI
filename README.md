# 🎯 ProCoach AI - Your Personal AI Interview Coach

A full-stack AI-powered mock interview platform that helps you practice and improve your interview skills with real-time feedback, speech analysis, and personalized coaching.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Python](https://img.shields.io/badge/python-3.10+-green)
![React](https://img.shields.io/badge/react-19-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

### 🎤 Core Interview Experience
- **Voice-based interviews** - Speak your answers naturally with real-time transcription
- **AI Interviewer** - Powered by Groq's LLaMA 3.3-70B for intelligent follow-up questions
- **Text-to-Speech** - Hear questions spoken aloud (Web Speech API)
- **Multiple topics** - General, Technical, Behavioral, System Design, Case Study, Leadership
- **Resume Upload (Optional)** - AI tailors questions based on your experience

### 🏢 Company-Specific Styles
- **Google** - Algorithmic thinking, complexity analysis
- **Amazon** - Leadership Principles, STAR method focus
- **Meta** - System design at scale, move fast mentality
- **Microsoft** - Growth mindset, collaboration skills
- **Startup** - Versatility, shipping quickly

### 📊 Advanced Analytics
- **Real-time scoring** - 1-10 score for each answer
- **Adaptive difficulty** - Questions adjust based on performance
- **Score progression** - Track improvement over time
- **Performance breakdown** - Excellent/Good/Needs Improvement categories

### 🎯 AI Coaching (Phase 6)
- **Speech quality analysis** - Filler words, clarity, confidence detection
- **STAR method detection** - Automatic S-T-A-R component identification
- **Live coaching panel** - Real-time feedback during interview
- **Personalized improvement plans** - Multi-week training recommendations
- **AI-generated coaching** - Detailed feedback with practice exercises

### 🔐 User System (Phase 5)
- **User authentication** - JWT-based secure login/register
- **Interview history** - Track all past interviews
- **Progress tracking** - See improvement over time
- **User statistics** - Aggregate performance metrics

### 📝 Additional Features
- **Resume parsing** - Upload and analyze your resume
- **Job description analysis** - Tailor interview to specific roles
- **Configurable timer** - 15/30/45/60 minute sessions
- **Export reports** - Download detailed interview reports
- **Audio visualization** - Real-time waveform display

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- Groq API key ([Get free key](https://console.groq.com/keys))

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your GROQ_API_KEY

# Run server
uvicorn main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

### Access the App
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## 🐳 Docker Deployment

```bash
# Set environment variables
export GROQ_API_KEY=your_api_key
export SECRET_KEY=$(python -c "import secrets; print(secrets.token_urlsafe(32))")

# Build and run
docker-compose up --build

# Access at http://localhost
```

## 📁 Project Structure

```
ai-interviewer/
├── backend/
│   ├── main.py           # FastAPI application (2000+ lines)
│   ├── auth.py           # JWT authentication
│   ├── database.py       # SQLAlchemy models
│   ├── requirements.txt  # Python dependencies
│   ├── Dockerfile        # Backend container
│   └── .env.example      # Environment template
├── frontend/
│   ├── src/
│   │   ├── App.jsx       # Main app component
│   │   ├── AudioRecorder.jsx  # Interview UI (1500+ lines)
│   │   ├── App.css       # Styles (1900+ lines)
│   │   └── main.jsx      # Entry point
│   ├── Dockerfile        # Frontend container
│   └── nginx.conf        # Production server config
├── docker-compose.yml    # Container orchestration
└── README.md
```

## 🔌 API Endpoints

### Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/register` | POST | Create new account |
| `/auth/login` | POST | Login (OAuth2) |
| `/auth/me` | GET | Get current user |
| `/auth/refresh` | POST | Refresh token |

### Interview
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/interview/start` | POST | Start new interview |
| `/interview/{id}/analyze` | POST | Submit audio answer |
| `/interview/{id}/end` | POST | End interview, get summary |
| `/interview/{id}/time` | GET | Get timer status |

### Analytics & Coaching
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/interview/{id}/analytics` | GET | Detailed analytics |
| `/interview/{id}/coaching` | GET | Live coaching metrics |
| `/interview/{id}/speech-analysis` | POST | Speech quality analysis |
| `/interview/{id}/ai-coaching` | POST | AI-generated coaching |
| `/interview/{id}/improvement-plan` | GET | Personalized plan |

### Configuration
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/topics` | GET | Available topics |
| `/companies` | GET | Company styles |
| `/difficulties` | GET | Difficulty levels |
| `/health` | GET | Health check |

## 🛠️ Technology Stack

### Backend
- **FastAPI** - Modern async Python framework
- **Groq API** - LLaMA 3.3-70B & Whisper for AI
- **SQLAlchemy** - ORM with SQLite/PostgreSQL
- **JWT** - Secure authentication
- **SlowAPI** - Rate limiting

### Frontend
- **React 19** - UI framework
- **Vite 7** - Build tool
- **Web Speech API** - Browser TTS
- **Vanilla CSS** - Custom dark theme

## 📊 Performance

- **Speech-to-Text**: ~1-2s latency (Whisper Large V3)
- **AI Response**: ~2-3s (LLaMA 3.3-70B)
- **Rate Limits**: 20 interviews/min, 30 analyses/min

## 🔒 Security

- JWT authentication with refresh tokens
- Password hashing with bcrypt
- Rate limiting on all endpoints
- CORS protection
- Environment-based configuration

## 🎨 UI Features

- Dark theme with gradient accents
- Responsive design (mobile-friendly)
- Real-time audio visualization
- Multi-step setup wizard
- Animated transitions
- Score progression charts

## 📈 Roadmap

- [x] Phase 1: Core Interview Flow
- [x] Phase 2: AI Intelligence (TTS, Company Styles)
- [x] Phase 3: Interview Configuration
- [x] Phase 4: Feedback & Analytics
- [x] Phase 5: Backend Architecture (Auth, DB)
- [x] Phase 6: Advanced Features (Coaching)
- [x] Phase 7: Polish & Deploy
- [ ] Phase 8: Video interviews (future)
- [ ] Phase 9: Multiplayer mock interviews (future)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

## 📄 License

MIT License - feel free to use for personal or commercial projects.

## 🙏 Acknowledgments

- [Groq](https://groq.com) - Lightning-fast AI inference
- [FastAPI](https://fastapi.tiangolo.com) - Modern Python web framework
- [React](https://react.dev) - UI library
- [Vite](https://vitejs.dev) - Build tooling

---

**Built with ❤️ for job seekers everywhere. Practice makes perfect!**

*Star ⭐ this repo if you find it helpful!*
