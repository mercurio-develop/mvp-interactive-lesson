import React, { useState } from 'react';
import ColorGame from './ColorGame';
import { resultsService } from './resultsService';
import TeacherDashboard from './TeacherDashboard';
import './App.css';

function App() {
  const [showTeacherDashboard, setShowTeacherDashboard] = useState(false);

  const handleGameComplete = async (sessionData) => {
    const result = await resultsService.saveResult(sessionData);
    if (!result.success) {
      console.error('Could not save to cloud; stored locally only.', result.error);
    }
  };

  return (
    <div className="app-root-container">
      <div className="cloud cloud-1">☁️</div>
      <div className="cloud cloud-2">☁️</div>
      <div className="cloud cloud-3">☁️</div>

      <header className="app-main-header">
        <div className="title-logo">
          <div className="flask-glow-icon">🧪</div>
          <div>
            <h1>EL LABORATORIO SECRETO DE LOS COLORES</h1>
            <p className="subtitle">Prueba de mezcla de colores</p>
          </div>
        </div>
        <button className="teacher-panel-trigger-btn" onClick={() => setShowTeacherDashboard(true)}>
          🔬 Panel del Profesor
        </button>
      </header>

      <main className="app-main-content">
        <ColorGame onGameComplete={handleGameComplete} />
      </main>

      {showTeacherDashboard && (
        <TeacherDashboard onClose={() => setShowTeacherDashboard(false)} />
      )}

      <footer className="app-main-footer">
        <p>© 2026 - El Laboratorio Secreto de los Colores</p>
      </footer>
    </div>
  );
}

export default App;
