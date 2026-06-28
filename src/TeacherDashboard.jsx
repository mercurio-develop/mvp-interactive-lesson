import React, { useState, useEffect } from 'react';
import { resultsService } from './resultsService';

function TeacherDashboard({ onClose }) {
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinError, setPinError] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  const [confirmClear, setConfirmClear] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [syncStatus, setSyncStatus] = useState({ isCloud: false, msg: '' });

  // Get the configured PIN (from env or default to '1234')
  const expectedPin = import.meta.env.VITE_TEACHER_PIN || '1234';

  useEffect(() => {
    const isCloud = resultsService.isCloudConnected();
    setSyncStatus({
      isCloud,
      msg: isCloud
        ? 'Sincronizado con la Nube ☁️'
        : 'Modo Local Simulado (Sin Conexión) 🔌'
    });
  }, []);

  const loadResults = async () => {
    setLoading(true);
    try {
      const data = await resultsService.getResults();
      setResults(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadResults();
    }
  }, [isAuthenticated]);

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pin === expectedPin) {
      setIsAuthenticated(true);
      setPinError('');
    } else {
      setPinError('PIN Incorrecto. ¡Prueba otra vez! 🍂');
      setPin('');
    }
  };

  const handleClearHistory = async () => {
    setLoading(true);
    try {
      await resultsService.clearResults();
      setResults([]);
      setConfirmClear(false);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // CSV Exporter
  const handleExportCSV = () => {
    if (results.length === 0) return;

    // Header definition
    const headers = ['Nombre', 'Correctas', 'Total', 'Aprobado', 'Fecha y Hora'];
    const rows = results.map(r => [
      r.studentName,
      r.successes ?? 0,
      r.totalExperiments ?? 3,
      r.allPassed ? 'Si' : 'No',
      new Date(r.timestamp).toLocaleString()
    ]);

    // CSV compile
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF"
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');

    // Trigger download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `reporte_laboratorio_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate Metrics
  const totalStudents = results.length;
  const avgCorrect = totalStudents
    ? (results.reduce((acc, r) => acc + (r.successes ?? 0), 0) / totalStudents).toFixed(1)
    : 0;
  const passRate = totalStudents
    ? Math.round((results.filter((r) => r.allPassed || (r.successes ?? 0) === (r.totalExperiments ?? 3)).length / totalStudents) * 100)
    : 0;

  // Search & Filter
  const filteredResults = results
    .filter(r => r.studentName.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'date_desc') return new Date(b.timestamp) - new Date(a.timestamp);
      if (sortBy === 'date_asc') return new Date(a.timestamp) - new Date(b.timestamp);
      if (sortBy === 'score_desc') return (b.successes ?? 0) - (a.successes ?? 0);
      if (sortBy === 'score_asc') return (a.successes ?? 0) - (b.successes ?? 0);
      if (sortBy === 'name_asc') return a.studentName.localeCompare(b.studentName);
      return 0;
    });

  if (!isAuthenticated) {
    return (
      <div className="teacher-lockscreen-overlay">
        <div className="lockscreen-card">
          <button className="lockscreen-close-btn" onClick={onClose}>✕</button>
          <div className="lockscreen-header">
            <span className="lockscreen-icon">🔑</span>
            <h2>Panel del Profesor</h2>
            <p>Ingresa el PIN de seguridad para ver las calificaciones de los pequeños científicos.</p>
          </div>
          <form onSubmit={handlePinSubmit} className="lockscreen-form">
            <input
              type="password"
              placeholder="PIN de Seguridad"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              maxLength={10}
              autoFocus
              className="lock-input"
            />
            {pinError && <p className="lock-error-msg">{pinError}</p>}
            <button type="submit" className="lock-btn">
              Desbloquear Panel 🌳
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="teacher-dashboard-overlay">
      <div className="dashboard-container">
        {/* Header */}
        <header className="dashboard-header">
          <div className="dashboard-title-area">
            <span className="dashboard-emoji">🔬</span>
            <div>
              <h2>Panel del Profesor — Calificaciones</h2>
              <p className="dashboard-desc">
                Monitorea el progreso de los alumnos y exporta sus resultados.
              </p>
            </div>
          </div>
          <div className="dashboard-actions">
            <button onClick={loadResults} className="dash-btn secondary" disabled={loading}>
              🔄 Actualizar
            </button>
            <button onClick={onClose} className="dash-btn close-btn">
              ✕ Cerrar Panel
            </button>
          </div>
        </header>

        {/* Sync Status Alert Banner */}
        <div className={`sync-banner ${syncStatus.isCloud ? 'cloud' : 'local'}`}>
          <span className="banner-icon">{syncStatus.isCloud ? '🟢' : '⚠️'}</span>
          <div className="banner-text">
            <strong>{syncStatus.msg}</strong>
            {!syncStatus.isCloud && (
              <span className="banner-subtext">
                {' '}— Los datos están guardados temporalmente en este navegador. Para usar en múltiples dispositivos, configura las variables de entorno de Supabase en tu archivo <code>.env</code> (<code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>).
              </span>
            )}
          </div>
        </div>

        {/* Stats Metrics row */}
        <section className="stats-row">
          <div className="stat-card">
            <span className="stat-icon">🎒</span>
            <div className="stat-value">{totalStudents}</div>
            <div className="stat-label">Pruebas realizadas</div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">✅</span>
            <div className="stat-value">{avgCorrect} / 3</div>
            <div className="stat-label">Promedio correctas</div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">🏆</span>
            <div className="stat-value">{passRate}%</div>
            <div className="stat-label">Aprobados (3/3)</div>
          </div>
        </section>

        {/* Controls row */}
        <section className="controls-row">
          <div className="search-box">
            🔍
            <input
              type="text"
              placeholder="Buscar por científico(a)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="clear-search-btn" onClick={() => setSearchQuery('')}>✕</button>
            )}
          </div>

          <div className="sort-box">
            Ordenar por:
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="date_desc">Fecha (Recientes primero)</option>
              <option value="date_asc">Fecha (Antiguos primero)</option>
              <option value="score_desc">Correctas (Mayor a menor)</option>
              <option value="score_asc">Correctas (Menor a mayor)</option>
              <option value="name_asc">Nombre (A - Z)</option>
            </select>
          </div>

          <div className="control-buttons">
            <button
              onClick={() => setShowShareModal(true)}
              className="dash-btn secondary"
            >
              🔗 Compartir Juego
            </button>
            <button
              onClick={handleExportCSV}
              className="dash-btn success"
              disabled={results.length === 0}
            >
              📥 Exportar a Excel (CSV)
            </button>
            <button
              onClick={() => setConfirmClear(true)}
              className="dash-btn danger"
              disabled={results.length === 0}
            >
              🗑️ Limpiar Datos
            </button>
          </div>
        </section>

        {/* Table Area */}
        <main className="table-area">
          {loading ? (
            <div className="loading-state">
              <span className="spinner">🧪</span> Cargando resultados mágicos...
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🍃</span>
              {searchQuery ? (
                <p>No se encontraron científicos con el nombre "{searchQuery}".</p>
              ) : (
                <p>Aún no hay exámenes registrados en el laboratorio. ¡Invita a los alumnos a jugar!</p>
              )}
            </div>
          ) : (
            <div className="dashboard-table-wrapper">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Correctas</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((r) => (
                    <tr key={r.id} className="dashboard-table-row">
                      <td className="student-name-cell">{r.studentName}</td>
                      <td className="score-cell font-bold">
                        {r.successes ?? 0} / {r.totalExperiments ?? 3}
                      </td>
                      <td>
                        {(r.allPassed || (r.successes ?? 0) === (r.totalExperiments ?? 3))
                          ? '✅ Aprobado'
                          : '📋 Terminado'}
                      </td>
                      <td className="timestamp-cell">
                        {new Date(r.timestamp).toLocaleDateString()}{' '}
                        {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {/* Clear Confirmation Modal */}
      {confirmClear && (
        <div className="confirm-modal-overlay">
          <div className="confirm-modal-card">
            <h3>⚠️ ¿Limpiar todo el historial?</h3>
            <p>
              Esta acción borrará permanentemente todos los resultados guardados de los alumnos. 
              <strong> Esta acción no se puede deshacer.</strong>
            </p>
            <div className="confirm-modal-actions">
              <button
                onClick={handleClearHistory}
                className="dash-btn danger confirm-btn"
                disabled={loading}
              >
                Sí, borrar todo
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="dash-btn secondary confirm-btn"
                disabled={loading}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal with Dynamic QR code */}
      {showShareModal && (
        <div className="confirm-modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="confirm-modal-card" onClick={(e) => e.stopPropagation()} style={{ borderColor: 'var(--wood-dark)' }}>
            <h3 style={{ color: 'var(--wood-dark)', marginBottom: '8px' }}>📱 Compartir con Alumnos</h3>
            <p style={{ fontSize: '13px', color: '#854d0e', marginBottom: '16px' }}>
              Escanea este código QR con la cámara de una tablet o teléfono para abrir el laboratorio:
            </p>
            
            <div style={{ background: '#fff', padding: '16px', borderRadius: '16px', display: 'inline-block', border: '3px solid #e6dfd3', marginBottom: '16px', boxShadow: '0 4px 10px rgba(120, 53, 15, 0.05)' }}>
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=78350f&bgcolor=fdfbf7&data=${encodeURIComponent(window.location.origin)}`} 
                alt="Código QR del Juego" 
                style={{ display: 'block', width: '200px', height: '200px' }}
              />
            </div>
            
            <div style={{ fontSize: '12px', wordBreak: 'break-all', background: 'var(--bg-input)', padding: '10px', borderRadius: '10px', color: 'var(--text-dark)', marginBottom: '20px', border: '1px solid #e6dfd3', fontFamily: 'monospace' }}>
              {window.location.origin}
            </div>

            <div className="confirm-modal-actions">
              <button
                onClick={() => setShowShareModal(false)}
                className="dash-btn secondary confirm-btn"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeacherDashboard;
