import React, { useState } from 'react';
import ColorGame from './ColorGame';
import './App.css';

function App() {
  const [sessionLedger, setSessionLedger] = useState([]);

  // React Callback Hook triggered by Phaser on completion
  const handleGameComplete = (sessionData) => {
    console.log('React received game session data:', sessionData);
    // Append to our history ledger
    setSessionLedger((prev) => [sessionData, ...prev]);
  };

  return (
    <div className="app-root-container">
      {/* Visual background grid and scanline filters */}
      <div className="scanline-overlay"></div>
      <div className="grid-overlay"></div>

      <header className="app-main-header">
        <div className="title-logo">
          <div className="flask-glow-icon">🧪</div>
          <div>
            <h1>THRUMAFORGE</h1>
            <p className="subtitle">Mesa de Química Interactiva y Espectro Cromático</p>
          </div>
        </div>
        <div className="header-status">
          <span className="pulse-indicator"></span>
          <span className="status-label">SENSORES EN LÍNEA</span>
        </div>
      </header>

      <main className="app-main-content">
        <ColorGame onGameComplete={handleGameComplete} />
      </main>

      {/* Lab History Ledger Dashboard */}
      {sessionLedger.length > 0 && (
        <section className="ledger-section">
          <div className="ledger-card">
            <h2 className="ledger-title">📋 HISTORIAL DE INFORMES QUÍMICOS</h2>
            <p className="ledger-subtitle">
              Sesiones de mezcla reportadas al servidor central de Thrumaforge.
            </p>
            <div className="ledger-table-container">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Estudiante</th>
                    <th>Rango</th>
                    <th>Puntaje</th>
                    <th>Intentos</th>
                    <th>Tiempo</th>
                    <th>Fecha / Hora</th>
                    <th>Estado de Envío</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionLedger.map((session, index) => (
                    <tr key={index} className="ledger-row">
                      <td className="text-glow">{session.studentName}</td>
                      <td>
                        {session.labRank === 'Apprentice' ? 'Aprendiz' : session.labRank === 'Researcher' ? 'Investigador' : 'Científico Loco'}
                      </td>
                      <td className="text-gold font-bold">{session.score} EXP</td>
                      <td>{session.attempts}</td>
                      <td>
                        {Math.floor(session.timeSeconds / 60)}m {session.timeSeconds % 60}s
                      </td>
                      <td className="text-muted text-xs">
                        {new Date(session.timestamp).toLocaleTimeString()} - {new Date(session.timestamp).toLocaleDateString()}
                      </td>
                      <td>
                        <span className="badge-sent">⚡ ENVIADO OK</span>
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
        <p>© 2026 - Gremio de Elfos Silvanos del Thrumaforge. Todos los derechos reservados.</p>
        <p className="footer-small">Consola de Control de Seguridad del Laboratorio de Química Reactiva.</p>
      </footer>
    </div>
  );
}

export default App;
