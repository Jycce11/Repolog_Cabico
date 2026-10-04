import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { fileURLToPath, pathToFileURL } from 'node:url';

dotenv.config();
const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = process.env.PORT || 5000;
const fallbackDataPath = path.join(__dirname, 'local-data.json');

const starterExercises = [
  { id: 1, name: 'Bench Press' },
  { id: 2, name: 'Squat' },
  { id: 3, name: 'Deadlift' },
  { id: 4, name: 'Overhead Press' },
  { id: 5, name: 'Barbell Row' }
];

export function seedFallbackData() {
  return {
    exercises: starterExercises.map((exercise) => ({ ...exercise })),
    workouts: []
  };
}

function readFallbackData(dataPath) {
  if (dataPath === ':memory:') {
    return seedFallbackData();
  }

  try {
    if (!fs.existsSync(dataPath)) {
      const seeded = seedFallbackData();
      fs.writeFileSync(dataPath, JSON.stringify(seeded, null, 2));
      return seeded;
    }

    const raw = fs.readFileSync(dataPath, 'utf8');
    if (!raw.trim()) {
      const seeded = seedFallbackData();
      fs.writeFileSync(dataPath, JSON.stringify(seeded, null, 2));
      return seeded;
    }

    const parsed = JSON.parse(raw);
    if (!parsed.exercises || !Array.isArray(parsed.exercises)) {
      const seeded = seedFallbackData();
      fs.writeFileSync(dataPath, JSON.stringify({ ...seeded, workouts: parsed.workouts || [] }, null, 2));
      return { ...seeded, workouts: parsed.workouts || [] };
    }

    return parsed;
  } catch (error) {
    console.warn('Falling back to a fresh local database because persisted data could not be loaded:', error.message);
    const seeded = seedFallbackData();
    try { fs.writeFileSync(dataPath, JSON.stringify(seeded, null, 2)); } catch {}
    return seeded;
  }
}

function writeFallbackData(dataPath, data) {
  if (dataPath === ':memory:') return;
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

export function createApp({ dataPath = fallbackDataPath } = {}) {
  const app = express();
  const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;
  const fallbackState = readFallbackData(dataPath);

  app.use(cors());
  app.use(express.json());

  const isFallbackMode = !pool;

  app.get('/api/health', async (req, res) => {
    if (pool) {
      try {
        await pool.query('SELECT 1');
        return res.json({ ok: true, message: 'RepLog API is running' });
      } catch (error) {
        console.warn('PostgreSQL unavailable, falling back to local data store:', error.message);
      }
    }

    return res.json({ ok: true, mode: 'fallback', message: 'RepLog API is running in local fallback mode' });
  });

  app.get('/api/exercises', async (req, res) => {
    if (pool) {
      try {
        const { rows } = await pool.query('SELECT * FROM exercises ORDER BY name');
        return res.json(rows);
      } catch (error) {
        console.warn('PostgreSQL query failed, using fallback data:', error.message);
      }
    }

    return res.json(fallbackState.exercises);
  });

  app.post('/api/exercises', async (req, res) => {
    const { name } = req.body;
    const trimmed = name?.trim();
    if (!trimmed) return res.status(400).json({ error: 'Exercise name is required' });

    if (pool) {
      try {
        const { rows } = await pool.query('INSERT INTO exercises (name) VALUES ($1) RETURNING *', [trimmed]);
        return res.status(201).json(rows[0]);
      } catch (error) {
        console.warn('PostgreSQL exercise insert failed, using fallback data:', error.message);
      }
    }

    const existing = fallbackState.exercises.find((exercise) => exercise.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return res.status(400).json({ error: 'Exercise already exists or is invalid' });

    const newExercise = { id: Date.now(), name: trimmed };
    fallbackState.exercises.push(newExercise);
    writeFallbackData(dataPath, fallbackState);
    return res.status(201).json(newExercise);
  });

  app.get('/api/workouts', async (req, res) => {
    if (pool) {
      try {
        const { rows } = await pool.query(`
          SELECT w.id, w.workout_date, w.notes, w.created_at,
            COALESCE(json_agg(json_build_object(
              'id', ws.id, 'exercise_id', ws.exercise_id, 'exercise', e.name,
              'set_number', ws.set_number, 'reps', ws.reps, 'weight', ws.weight
            ) ORDER BY ws.set_number) FILTER (WHERE ws.id IS NOT NULL), '[]') AS sets
          FROM workouts w
          LEFT JOIN workout_sets ws ON ws.workout_id = w.id
          LEFT JOIN exercises e ON e.id = ws.exercise_id
          GROUP BY w.id
          ORDER BY w.workout_date DESC, w.id DESC
        `);
        return res.json(rows);
      } catch (error) {
        console.warn('PostgreSQL workout query failed, using fallback data:', error.message);
      }
    }

    return res.json(fallbackState.workouts);
  });

  app.post('/api/workouts', async (req, res) => {
    const { workout_date, notes, sets } = req.body;
    if (!Array.isArray(sets) || sets.length === 0) return res.status(400).json({ error: 'At least one set is required' });

    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const workout = await client.query(
          'INSERT INTO workouts (workout_date, notes) VALUES ($1, $2) RETURNING *',
          [workout_date || new Date().toISOString().slice(0, 10), notes || null]
        );
        for (const item of sets) {
          await client.query(
            'INSERT INTO workout_sets (workout_id, exercise_id, set_number, reps, weight) VALUES ($1,$2,$3,$4,$5)',
            [workout.rows[0].id, item.exercise_id, item.set_number, item.reps, item.weight]
          );
        }
        await client.query('COMMIT');
        return res.status(201).json({ ...workout.rows[0], sets });
      } catch (error) {
        await client.query('ROLLBACK');
        console.warn('PostgreSQL workout save failed:', error.message);
        return res.status(400).json({ error: error.message });
      } finally { client.release(); }
    }

    const workoutId = Date.now();
    const exerciseNameMap = Object.fromEntries(fallbackState.exercises.map((exercise) => [exercise.id, exercise.name]));
    const nextWorkout = {
      id: workoutId,
      workout_date: workout_date || new Date().toISOString().slice(0, 10),
      notes: notes || '',
      created_at: new Date().toISOString(),
      sets: sets.map((item, index) => ({
        id: Date.now() + index + 1,
        exercise_id: Number(item.exercise_id),
        exercise: exerciseNameMap[Number(item.exercise_id)] || 'Exercise',
        set_number: Number(item.set_number || index + 1),
        reps: Number(item.reps),
        weight: Number(item.weight)
      }))
    };
    fallbackState.workouts.unshift(nextWorkout);
    writeFallbackData(dataPath, fallbackState);
    return res.status(201).json(nextWorkout);
  });

  app.get('/api/progress/:exerciseId', async (req, res) => {
    if (pool) {
      try {
        const { rows } = await pool.query(`
          SELECT w.workout_date, ws.set_number, ws.reps, ws.weight
          FROM workout_sets ws
          JOIN workouts w ON w.id = ws.workout_id
          WHERE ws.exercise_id = $1
          ORDER BY w.workout_date ASC, ws.set_number ASC
        `, [req.params.exerciseId]);
        return res.json(rows);
      } catch (error) {
        console.warn('PostgreSQL progress query failed, using fallback data:', error.message);
      }
    }

    const exerciseId = Number(req.params.exerciseId);
    const rows = fallbackState.workouts.flatMap((workout) =>
      workout.sets
        .filter((set) => Number(set.exercise_id) === exerciseId)
        .map((set) => ({
          workout_date: workout.workout_date,
          set_number: set.set_number,
          reps: set.reps,
          weight: set.weight
        }))
    );

    return res.json(rows);
  });

  return app;
}

const app = createApp();
const isEntryPoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  app.listen(port, () => console.log(`RepLog API running at http://localhost:${port}`));
}

export { app, fallbackDataPath };
