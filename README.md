# HRMS — Human Resource Management System

Full-stack HRMS with React Native mobile app and NestJS backend.

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native + TypeScript |
| Backend | NestJS + TypeScript |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Storage | Supabase (→ Azure Blob later) |
| Notifications | Firebase FCM |
| CI/CD | GitHub Actions + Docker |

## Project Structure

```
HRMS/
├── apps/
│   ├── backend/          # NestJS API
│   │   └── src/
│   │       ├── auth/
│   │       ├── users/
│   │       ├── employees/
│   │       ├── attendance/
│   │       ├── leaves/
│   │       ├── payroll/
│   │       ├── notifications/
│   │       └── storage/
│   └── mobile/           # React Native app
│       └── src/
│           ├── navigation/
│           ├── screens/
│           ├── store/
│           ├── services/
│           └── types/
├── .github/workflows/    # CI/CD pipelines
├── docker-compose.yml    # Full stack (prod)
└── docker-compose.dev.yml # Infra only (dev)
```

## Quick Start

### 1. Prerequisites
- Node.js 22+
- Docker Desktop
- Android Studio / Xcode (for mobile)
- Java 17 (for Android builds)

### 2. Environment Setup

```bash
cp .env.example apps/backend/.env
# Edit apps/backend/.env with your Supabase & Firebase credentials
```

### 3. Start Infrastructure (PostgreSQL + Redis)

```bash
docker-compose -f docker-compose.dev.yml up -d
```

### 4. Run Backend

```bash
cd apps/backend
npm install
npm run start:dev
# API:    http://localhost:3000/api/v1
# Swagger: http://localhost:3000/api/docs
```

### 5. Run Mobile App

```bash
cd apps/mobile
npm install
# Android
npx react-native run-android
# iOS (Mac only)
npx react-native run-ios
```

## Backend API Modules

| Module | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login` |
| Users | `GET/POST/PATCH/DELETE /users` |
| Employees | `GET/POST/PATCH/DELETE /employees` |
| Attendance | `POST /attendance/:id/check-in`, `POST /attendance/:id/check-out` |
| Leaves | `GET/POST /leaves`, `PATCH /leaves/:id/approve` |
| Payroll | `POST /payroll/generate`, `GET /payroll/employee/:id` |
| Notifications | `POST /notifications/send` |

## Docker (Production)

```bash
# Build and run everything
docker-compose up --build

# Stop
docker-compose down
```

## CI/CD

- **backend-ci.yml**: Lint → Test → Build → Docker push (on `main`)
- **mobile-ci.yml**: TypeScript check → Test → Android APK (on `main`)

## Environment Variables

See `.env.example` for all required variables. Key ones:

- `JWT_SECRET` — use a long random string in production
- `SUPABASE_*` — from your Supabase project settings
- `FIREBASE_*` — from Firebase service account JSON
