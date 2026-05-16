# Interview AI — Enterprise-Grade Interview Preparation Platform

> Transform your interview preparation with AI-powered insights, tailored resumes, and automated analysis. Built with a modern, scalable, and secure architecture.

---

## 🚀 Overview

Interview AI is a full-stack platform that leverages Google Gemini AI to analyze candidate resumes against job descriptions. It provides detailed interview reports, identifies skill gaps, and generates professionally tailored resumes in PDF format using asynchronous background processing.

### Key Features
- **AI Analysis:** Deep matching between resumes and job requirements.
- **Asynchronous Processing:** Heavy PDF generation handled by BullMQ & Redis to ensure zero API timeouts.
- **Layered Architecture:** Clean separation of concerns (API, Domain, Infrastructure).
- **Security First:** Distributed rate limiting, prompt injection guards, and secure HTTP headers.
- **Enterprise-Ready:** Request tracking (UUID), structured logging (Winston), and standardized API responses.

---

## 🛠 Tech Stack

### Backend
- **Runtime:** Node.js (Express.js)
- **Database:** MongoDB (Mongoose)
- **Background Jobs:** BullMQ + Redis
- **AI Orchestration:** Google Gemini 1.5 Flash
- **PDF Generation:** Puppeteer
- **Validation:** Zod
- **Security:** Helmet, Rate Limit Redis, Bcrypt, JWT

### Frontend
- **Framework:** React.js (Vite)
- **Styling:** SCSS (Feature-based architecture)
- **State Management:** Context API
- **API Client:** Axios

---

## 🏗 Architecture

The project follows a **Clean Layered Architecture** to ensure testability and maintainability:

```text
src/
├── api/v1/             # Controller Layer: Request extraction & API Versioning
├── domain/             # Service Layer: Core business logic & AI orchestration
├── infrastructure/     # Data Layer: Repository pattern & Mongoose models
├── shared/             # Utility Layer: Constants, Response helpers, Middleware
└── queues/             # Job Layer: BullMQ Workers & Queue definitions
```

---

## 🚦 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB
- Redis (Running on port 6379)
- Google Gemini API Key

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/MalikABK/interview-ai-project.git
   cd interview-ai-project
   ```

2. **Setup Backend:**
   ```bash
   cd Backend
   cp .env.example .env
   # Update .env with your MONGO_URI and GOOGLE_GENAI_API_KEY
   npm install
   npm run dev
   ```

3. **Setup Frontend:**
   ```bash
   cd ../Frontend
   npm install
   npm run dev
   ```

### Running with Docker
```bash
docker run --name redis-server -p 6379:6379 -d redis
```

---

## 🔒 Security & Performance

- **Rate Limiting:** Protects against DoS with Redis-backed counters.
- **Graceful Shutdown:** Safely closes DB and Worker connections on termination signals.
- **Input Validation:** Strict Zod schemas for all API boundaries and Environment variables.
- **Concurrency Control:** Background workers are limited to 2 simultaneous PDF generations to prevent memory spikes.

---

## 📡 API Documentation (v1)

### Auth Endpoints
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login & receive JWT cookie
- `POST /api/v1/auth/logout` - Invalidate session

### Interview Endpoints
- `POST /api/v1/interview/` - Generate report (Upload Resume)
- `GET /api/v1/interview/` - List reports (Paginated)
- `POST /api/v1/interview/resume/pdf/:id` - Queue PDF generation
- `GET /api/v1/interview/resume/status/:jobId` - Check generation status

---

## 🤝 Contributing

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License
Distributed under the ISC License. See `LICENSE` for more information.
