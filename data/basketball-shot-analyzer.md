# ShotIQ — Basketball Shot Analyzer

A full-stack computer vision SaaS platform for analyzing basketball shooting mechanics. Upload a short clip, get biomechanical metrics, pose visualization, and coaching feedback instantly.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser Client                        │
│  Next.js 15 + TypeScript + Tailwind + Recharts             │
│  FFmpeg.wasm (in-browser video trimming)                    │
└───────────────────────┬─────────────────────────────────────┘
                        │ REST API
┌───────────────────────▼─────────────────────────────────────┐
│                    FastAPI Backend                           │
│  JWT Auth · Video Upload · Background CV Analysis          │
│  MediaPipe Pose · OpenCV · SQLAlchemy async               │
└────────────┬──────────────────────────┬─────────────────────┘
             │                          │
      ┌──────▼──────┐          ┌────────▼───────┐
      │ PostgreSQL  │          │  Local Storage │
      │  (Docker)   │          │  /uploads/     │
      └─────────────┘          └────────────────┘
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| Charts | Recharts (radar chart, line chart) |
| Video | HTML5 Video API, FFmpeg.wasm (client-side trim) |
| Backend | Python 3.12, FastAPI, SQLAlchemy (async) |
| Computer Vision | MediaPipe Pose 0.10, OpenCV |
| Database | PostgreSQL 16 |
| Infrastructure | Docker, Docker Compose |

## Features

- **JWT authentication** — register, login, protected routes
- **In-browser video trimming** — FFmpeg.wasm trims clips client-side before upload, no raw footage leaves the browser
- **3-second clip limit** — one shot per analysis, enforced on frontend and backend
- **4-stage shooting arm detection** — wrist height, wrist snap (壓手腕), follow-through, elbow height fallback
- **7 biomechanical metrics** — release angle, elbow angle, knee bend, shoulder alignment, shot duration, jump height, motion smoothness
- **2-panel pose visualization** — Loading and Release frames with skeleton overlay
- **Automated coaching feedback** — rule-based recommendations with priority levels
- **Progress dashboard** — score history, mechanics radar chart, session stats
- **Shot history** — filterable list of all past analyses

## Quick Start

### Prerequisites

- Docker Desktop
- Node.js 22+

### Run with Docker

```bash
git clone <repo>
cd basketball-shot-analyzer
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API docs: http://localhost:8000/docs

### Local Development

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

# Start DB only
docker-compose up db -d

# Run migrations and start server
alembic upgrade head
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

## Environment Variables

### Backend (`.env`)

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://...` | PostgreSQL async connection string |
| `SECRET_KEY` | — | JWT signing key |
| `UPLOAD_DIR` | `./uploads` | Uploaded video storage path |
| `CORS_ORIGINS` | `http://localhost:3000` | Allowed frontend origins |
| `MAX_VIDEO_DURATION` | `3` | Max clip duration in seconds |

### Frontend (`.env.local`)

| Variable | Default |
|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` |

## API Reference

```
POST   /api/auth/register      Register new user
POST   /api/auth/login         Login, receive JWT

GET    /api/users/me           Current user profile

POST   /api/videos/upload      Upload clip (triggers async analysis)
GET    /api/videos             List user's videos

GET    /api/analyses           List all analyses
GET    /api/analyses/{id}      Full analysis with metrics + recommendations

GET    /api/dashboard          Aggregated stats, history, metric averages
```

## Computer Vision Pipeline

```
Video File
    │
    ▼
OpenCV Frame Extraction (max 720px width)
    │
    ▼
MediaPipe Pose (33 landmark keypoints per frame)
    │
    ▼
Shooting Arm Detection (4-stage)
  1. Top-5 mean wrist height (clear profile shots)
  2. Wrist snap magnitude around release (壓手腕)
  3. Post-release follow-through height
  4. Peak elbow height fallback
    │
    ▼
Release Frame Detection
  Score = (wrist_height × 0.65 + elbow_extension × 0.35) × visibility
    │
    ▼
Metric Calculation
  ├─ Release Angle       forearm vector vs horizontal at release frame
  ├─ Elbow Angle         shoulder-elbow-wrist angle at release
  ├─ Knee Bend           hip-knee-ankle angle at loading bottom (start_idx)
  ├─ Shoulder Alignment  Y-difference between shoulders at release
  ├─ Shot Duration       frames from wrist dip bottom to release / fps
  ├─ Jump Height         ankle lift from ground baseline to peak (true departure)
  └─ Motion Smoothness   wrist trajectory jitter score
    │
    ▼
Weighted Score (0-100)
    │
    ▼
Pose Visualization (2-panel JPEG: Loading + Release)
    │
    ▼
Recommendation Generation (priority 1-3)
    │
    ▼
Persist to PostgreSQL
```

## Metrics & Ideal Ranges

| Metric | Ideal Range | Unit | Notes |
|---|---|---|---|
| Release Angle | 45-55° | degrees | Forearm vs horizontal |
| Elbow Angle at Release | 155-175° | degrees | Near full extension |
| Knee Bend at Setup | 70-120° | degrees | Low weight (2D projection error on profile shots) |
| Shoulder Alignment | 0-3 | deviation | Y-difference × 100 |
| Shot Duration | 0.4-0.9 | seconds | Dip bottom to release |
| Jump Height Estimate | 0.02-0.18 | normalized | Ankle lift, not hip displacement |
| Motion Smoothness | 75-100 | score | 100 = no jitter |

## Scoring & Grades

Each metric contributes a weighted component score (0-100). Distance from ideal range is penalized linearly.

| Metric | Weight |
|---|---|
| Release Angle | 30% |
| Elbow Angle | 27% |
| Motion Smoothness | 20% |
| Shoulder Alignment | 15% |
| Knee Bend | 8% |

| Grade | Score |
|---|---|
| A | 88+ |
| B | 75-87 |
| C | 60-74 |
| D | < 60 |

## Recording Tips

- **Film from 45-90° side angle** — front-on shots hide elbow extension and knee depth
- **Player should fill at least half the frame height** — MediaPipe accuracy drops significantly with small subjects
- **Select exactly one shot** — the 3-second clip should contain: catch/setup → loading dip → release

## Database Schema

```
users         id, email, password_hash, full_name, created_at
videos        id, user_id, filename, file_path, original_duration,
              selected_start_time, selected_end_time, status, created_at
analyses      id, video_id, score, shooting_arm, frames_analyzed,
              processing_time_seconds, pose_image_path, error_message, created_at
metrics       id, analysis_id, metric_name, metric_value, metric_unit,
              ideal_min, ideal_max
recommendations  id, analysis_id, recommendation_text, metric_key, priority
```

## Project Structure

```
basketball-shot-analyzer/
├── backend/
│   ├── app/
│   │   ├── api/           # FastAPI route handlers
│   │   ├── core/          # Config, security, dependencies
│   │   ├── cv/            # MediaPipe pose analysis + recommendations
│   │   ├── db/            # SQLAlchemy engine + session
│   │   ├── models/        # ORM models
│   │   ├── schemas/       # Pydantic DTOs
│   │   ├── services/      # Analysis orchestration
│   │   └── main.py
│   ├── alembic/           # DB migrations
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/           # Next.js App Router pages
│   │   ├── features/      # Feature modules (dashboard, upload, analysis, history)
│   │   ├── lib/           # API client, utilities
│   │   ├── store/         # Zustand auth store
│   │   └── types/         # TypeScript interfaces
│   ├── Dockerfile
│   └── package.json
├── preview_pose.py        # Local CV preview tool (Tasks API, click-to-select)
└── docker-compose.yml
```

## Local CV Preview Tool

For inspecting pose detection without the full Docker stack:

```bash
python preview_pose.py test-videos/your-video.mp4
```

- Click on a person to select them (orange = selected, grey = others)
- Shows wrist heights and dominant arm estimate per person
- Space to pause, Q to quit, R to reset selection
- Downloads `pose_landmarker_full.task` model on first run (~28 MB)

## Roadmap

**Phase 1 (Current)**
- [x] JWT auth
- [x] In-browser video trimming (FFmpeg.wasm)
- [x] MediaPipe pose analysis
- [x] 7 biomechanical metrics
- [x] 2-panel pose visualization (Loading + Release)
- [x] 4-stage shooting arm detection with wrist snap
- [x] Score + automated coaching feedback
- [x] Progress dashboard

**Phase 2**
- [ ] Shot make/miss detection (ball tracking)
- [ ] Multi-shot session analysis (consistency across shots)
- [ ] PDF report export
- [ ] AWS S3 video storage

**Phase 3**
- [ ] Mobile PWA
- [ ] Real-time analysis via WebRTC
- [ ] Comparison against NBA player baselines
- [ ] Team/coach accounts

## Production Notes

- Replace `SECRET_KEY` with a cryptographically random 32-byte string
- Set `CORS_ORIGINS` to your actual domain
- Use S3/R2 for video storage (replace `file_path` with object key in `Video` model)
- Add rate limiting on upload endpoints (`slowapi`)
- Use Alembic migrations instead of `create_all`
