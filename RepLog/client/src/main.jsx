import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const API = 'http://localhost:5000/api';

function App() {
  const [page, setPage] = useState('home');
  const [exercises, setExercises] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [form, setForm] = useState({ exercise_id: '', reps: '', weight: '', notes: '' });
  const [message, setMessage] = useState('');

  const load = async () => {
    const [exerciseResponse, workoutResponse] = await Promise.all([
      fetch(`${API}/exercises`),
      fetch(`${API}/workouts`)
    ]);

    const exerciseData = await exerciseResponse.json();
    const workoutData = await workoutResponse.json();

    setExercises(Array.isArray(exerciseData) ? exerciseData : []);
    setWorkouts(Array.isArray(workoutData) ? workoutData : []);

    if (!exerciseResponse.ok || !workoutResponse.ok) {
      setMessage('The API responded with a problem. Please refresh or check the server output.');
    }
  };

  useEffect(() => {
    load().catch(() => setMessage('Start the Express server and check the local fallback data.'));
  }, []);

  const saveWorkout = async (event) => {
    event.preventDefault();
    if (!form.exercise_id || !form.reps || !form.weight) return setMessage('Complete exercise, reps, and weight.');
    const response = await fetch(`${API}/workouts`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ notes: form.notes, sets:[{ exercise_id:Number(form.exercise_id), set_number:1, reps:Number(form.reps), weight:Number(form.weight) }] })
    });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || 'Could not save workout.');
    setForm({ exercise_id:'', reps:'', weight:'', notes:'' }); setMessage('Workout saved!'); await load(); setPage('progress');
  };

  return <div className="app">
    <header><h1>RepLog</h1><nav>
      <button onClick={()=>setPage('home')}>HOME</button>
      <button onClick={()=>setPage('workout')}>WORKOUT</button>
      <button onClick={()=>setPage('exercises')}>EXERCISES</button>
      <button onClick={()=>setPage('progress')}>PROGRESS</button>
    </nav></header>
    <main>
      {message && <div className="message">{message}</div>}
      {page==='home' && <section className="hero"><p className="eyebrow">WORKOUT LOGGING</p><h2>Build your strength.<br/>Track your progress.</h2><p>Record your exercises, sets, reps, and weight in one simple place.</p><button className="primary" onClick={()=>setPage('workout')}>LOG A WORKOUT</button></section>}
      {page==='workout' && <section><h2>Workout Session</h2><form onSubmit={saveWorkout} className="card form">
        <label>Exercise<select value={form.exercise_id} onChange={e=>setForm({...form,exercise_id:e.target.value})}><option value="">Choose an exercise</option>{exercises.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
        <label>Reps<input type="number" min="1" value={form.reps} onChange={e=>setForm({...form,reps:e.target.value})}/></label>
        <label>Weight (kg)<input type="number" min="0" step="0.5" value={form.weight} onChange={e=>setForm({...form,weight:e.target.value})}/></label>
        <label>Notes<textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
        <button className="primary">SAVE WORKOUT</button>
      </form></section>}
      {page==='exercises' && <section><h2>Exercises</h2><div className="grid">{exercises.map(e=><div className="card" key={e.id}><h3>{e.name}</h3><p>Available for workout logging.</p></div>)}</div></section>}
      {page==='progress' && <section><h2>Progress</h2>{workouts.length===0?<div className="card"><p>No workouts recorded yet.</p></div>:workouts.map(w=><div className="card workout" key={w.id}><div><strong>{w.workout_date}</strong>{w.notes&&<p>{w.notes}</p>}</div><div>{w.sets.map(s=><p key={s.id || s.set_number}>{s.exercise}: {s.reps} reps × {s.weight} kg</p>)}</div></div>)}</section>}
    </main>
    <footer>RepLog · Workout Logging & Progress Tracking</footer>
  </div>
}
createRoot(document.getElementById('root')).render(<App />);
