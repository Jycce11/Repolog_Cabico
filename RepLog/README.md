# RepLog

RepLog is a workout logging and progress tracking web application for solo lifters. It records exercises, sets, reps, and weight and displays saved workout history.

## Stack
- React + Vite
- Node.js + Express
- PostgreSQL

## Setup

### 1. Install
Install Node.js, npm, PostgreSQL, and Git.

### 2. Database
Create a PostgreSQL database named `replog`, then run `server/schema.sql` in that database.

Example with psql:
```bash
createdb replog
psql -d replog -f server/schema.sql
```

### 3. Environment
Copy `server/.env.example` to `server/.env` and set your PostgreSQL password:
```env
PORT=5000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/replog
```

### 4. Install dependencies
From the project root:
```bash
npm install
npm run install:all
```

### 5. Run
From the project root:
```bash
npm run dev
```

Open `http://localhost:5173`.
The API runs at `http://localhost:5000`.

## API
- `GET /api/health` — checks API/database status
- `GET /api/exercises` — lists exercises
- `POST /api/exercises` — creates an exercise
- `GET /api/workouts` — lists saved workouts
- `POST /api/workouts` — saves a workout and its sets
- `GET /api/progress/:exerciseId` — gets progress data for an exercise

## Main flow
Dashboard → Workout Session → record exercise/reps/weight → Save Workout → Progress.

## Project structure
- `client/` React frontend
- `server/` Express API and PostgreSQL schema
- `server/schema.sql` database tables and starter exercises
- `server/.env` local configuration (do not commit)
