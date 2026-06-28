import React, { useState, useEffect } from 'react';
import ColorGame from './ColorGame';
import { resultsService } from './resultsService';
import TeacherDashboard from './TeacherDashboard';
import './App.css';

function App() {
  const [sessionLedger, setSessionLedger] = useState([]);
  const [showTeacherDashboard, setShowTeacherDashboard] = useState(false);

  // Load results on mount
  const refreshLedger = async () => {
    const data = await resultsService.getResults();
    setSessionLedger(data);
  };

  useEffect(() => {
    refreshLedger();
  }, []);

  // Hook triggered on game completion
  const handleGameComplete = async (sessionData) => {
    console.log('React received game session data:', sessionData);
    await resultsService.saveResult(sessionData);
    await refreshLedger();
  };

  return (
    <div className="app-root-container">
      {/* Drifting Clouds for Ghibli aesthetic */}
      <div className="cloud cloud-1">☁️</div>
      <div className="cloud cloud-2">☁️</div>
      <div className="cloud cloud-3">☁️</div>

      {/* Main header bar styled as a cozy lab board */}
      <header className="app-main-header">
        <div className="title-logo">
          <div className="flask-glow-icon">🧪</div>
          <div>
            <h1>EL LABORATORIO DEL BOSQUE</h1>
            <p className="subtitle">¡Experimentos mágicos de colores! 🍃</p>
          </div>
        </div>
        <div className="header-status">
          <button className="teacher-panel-trigger-btn" onClick={() => setShowTeacherDashboard(true)}>
            🔬 Panel del Profesor
          </button>
          <span className="pulse-indicator"></span>
          <span className="status-label">🧪 LABORATORIO ACTIVO</span>
        </div>
      </header>

      <main className="app-main-content">
        <ColorGame onGameComplete={handleGameComplete} />
      </main>

      {showTeacherDashboard && (
        <TeacherDashboard onClose={() => {
          setShowTeacherDashboard(false);
          refreshLedger();
        }} />
      )}

      {/* Lab History Ledger Dashboard */}
      {sessionLedger.length > 0 && (
        <section className="ledger-section">
          <div className="ledger-card">
            <h2 className="ledger-title">🔬 REGISTRO DE PEQUEÑOS CIENTÍFICOS</h2>
            <p className="ledger-subtitle">
              Experimentos de mezcla completados en el laboratorio del bosque.
            </p>
            <div className="ledger-table-container">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Científico(a)</th>
                    <th>Rango Científico</th>
                    <th>Ciencia ✨</th>
                    <th>Intentos</th>
                    <th>Tiempo en el Lab</th>
                    <th>Fecha / Hora</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionLedger.map((session, index) => (
                    <tr key={index} className="ledger-row">
                      <td className="text-glow">{session.studentName}</td>
                      <td>
                        {session.labRank === 'Apprentice' ? 'Ayudante de Lab 🌱' : session.labRank === 'Researcher' ? 'Científico(a) del Bosque 🌸' : 'Gran Sabio del Lab 🌳'}
                      </td>
                      <td className="text-gold font-bold">{session.score} CIENCIA</td>
                      <td>{session.attempts}</td>
                      <td>
                        {Math.floor(session.timeSeconds / 60)}m {session.timeSeconds % 60}s
                      </td>
                      <td className="text-muted text-xs">
                        {new Date(session.timestamp).toLocaleTimeString()} - {new Date(session.timestamp).toLocaleDateString()}
                      </td>
                      <td>
                        <span className="badge-sent">🌟 COMPLETADO</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <footer className="app-main-footer">
        <p>© 2026 - El Laboratorio del Bosque. Hecho con amor para niñas y niños de 5 a 6 años. 🧪</p>
        <p className="footer-small">🧪 ¡Divertidos experimentos de colores en el laboratorio del bosque mágico!</p>
      </footer>
    </div>
  );
}

export default App;
