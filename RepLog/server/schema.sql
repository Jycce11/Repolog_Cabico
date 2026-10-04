CREATE TABLE IF NOT EXISTS exercises (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workouts (
  id SERIAL PRIMARY KEY,
  workout_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workout_sets (
  id SERIAL PRIMARY KEY,
  workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  reps INTEGER NOT NULL CHECK (reps > 0),
  weight NUMERIC(8,2) NOT NULL CHECK (weight >= 0)
);

INSERT INTO exercises (name) VALUES
('Bench Press'), ('Squat'), ('Deadlift'), ('Overhead Press'), ('Barbell Row')
ON CONFLICT (name) DO NOTHING;
