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
            <h1>EL LABORATORIO DE ARTE</h1>
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
        <TeacherDashboard onClose={() => {
          setShowTeacherDashboard(false);
          refreshLedger();
        }} />
      )}

      {/* Lab History Ledger Dashboard */}
      {sessionLedger.length > 0 && (
        <section className="ledger-section">
          <div className="ledger-card">
            <h2 className="ledger-title">Resultados de la prueba</h2>
            <p className="ledger-subtitle">
              Últimas pruebas completadas en el laboratorio.
            </p>
            <div className="ledger-table-container">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Correctas</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionLedger.map((session, index) => (
                    <tr key={index} className="ledger-row">
                      <td className="text-glow">{session.studentName}</td>
                      <td className="font-bold">
                        {session.successes ?? 0} / {session.totalExperiments ?? 3}
                      </td>
                      <td className="text-muted text-xs">
                        {new Date(session.timestamp).toLocaleDateString()}
                      </td>
                      <td>
                        <span className="badge-sent">
                          {session.allPassed ? '✅ Aprobado' : '📋 Terminado'}
                        </span>
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
        <p>© 2026 - El Laboratorio de Arte. Hecho con amor para niñas y niños de 5 a 6 años. 🧪</p>
        <p className="footer-small">🧪 ¡Divertidos experimentos de colores en el laboratorio del bosque mágico!</p>
      </footer>
    </div>
  );
}

export default App;
