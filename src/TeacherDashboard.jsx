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
    let cancelled = false;

    (async () => {
      const configured = resultsService.isCloudConfigured();
      if (!configured) {
        if (!cancelled) {
          setSyncStatus({
            isCloud: false,
            msg: 'Modo Local Simulado (Sin Conexión) 🔌',
          });
        }
        return;
      }

      const isCloud = await resultsService.isCloudConnected();
      if (!cancelled) {
        setSyncStatus({
          isCloud,
          msg: isCloud
            ? 'Sincronizado con la Nube ☁️'
            : 'Supabase configurado, pero sin conexión a la base de datos ⚠️',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadResults = async () => {
    setLoading(true);
    try {
      const data = await resultsService.getResults();
      setResults(data);
      const configured = resultsService.isCloudConfigured();
      const isCloud = configured ? await resultsService.isCloudConnected() : false;
      setSyncStatus({
        isCloud,
        msg: isCloud
          ? `Sincronizado con la Nube ☁️ (${data.length} resultados)`
          : configured
            ? 'Datos locales — no se pudo conectar con Supabase ⚠️'
            : 'Modo Local (configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en producción) 🔌',
      });
    } catch (e) {
      console.error(e);
      setSyncStatus({ isCloud: false, msg: 'Error al cargar resultados ⚠️' });
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
    const rows = results.map((r) => [
      r.studentName,
      r.successes ?? 0,
      r.totalExperiments ?? 3,
      r.allPassed ? 'Si' : 'No',
      new Date(r.timestamp).toLocaleString(),
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
              <h2>
                <span className="dash-title-full">Panel del Profesor — Calificaciones</span>
                <span className="dash-title-short">Panel del Profesor</span>
              </h2>
              <p className="dashboard-desc">
                Monitorea el progreso de los alumnos y exporta sus resultados.
              </p>
            </div>
          </div>
          <div className="dashboard-actions">
            <button onClick={loadResults} className="dash-btn secondary" disabled={loading}>
              <span className="btn-label-full">🔄 Actualizar</span>
              <span className="btn-label-short">🔄</span>
            </button>
            <button onClick={onClose} className="dash-btn close-btn">
              <span className="btn-label-full">✕ Cerrar Panel</span>
              <span className="btn-label-short">✕ Cerrar</span>
            </button>
          </div>
        </header>

        {/* Sync Status Alert Banner */}
        <div className={`sync-banner ${syncStatus.isCloud ? 'cloud' : 'local'}`}>
          <span className="banner-icon">{syncStatus.isCloud ? '🟢' : '⚠️'}</span>
          <div className="banner-text">
            <strong>{syncStatus.msg}</strong>
            {!syncStatus.isCloud && (
              <>
                <span className="banner-subtext banner-subtext-full">
                  {' '}— Los datos están guardados temporalmente en este navegador. Para usar en múltiples dispositivos, configura las variables de entorno de Supabase en tu archivo <code>.env</code> (<code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>).
                </span>
                <span className="banner-subtext banner-subtext-short">
                  {' '}— Datos guardados en este dispositivo.
                </span>
              </>
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
              <span className="btn-label-full">🔗 Compartir Juego</span>
              <span className="btn-label-short">🔗 Compartir</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="dash-btn success"
              disabled={results.length === 0}
            >
              <span className="btn-label-full">📥 Exportar a Excel (CSV)</span>
              <span className="btn-label-short">📥 Exportar CSV</span>
            </button>
            <button
              onClick={() => setConfirmClear(true)}
              className="dash-btn danger"
              disabled={results.length === 0}
            >
              <span className="btn-label-full">🗑️ Limpiar Datos</span>
              <span className="btn-label-short">🗑️ Limpiar</span>
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
            <>
              <div className="dashboard-table-wrapper dashboard-desktop-only">
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
                    {filteredResults.map((r) => {
                      const passed = r.allPassed || (r.successes ?? 0) === (r.totalExperiments ?? 3);
                      return (
                        <tr key={r.id} className="dashboard-table-row">
                          <td className="student-name-cell">{r.studentName}</td>
                          <td className="score-cell font-bold">
                            {r.successes ?? 0} / {r.totalExperiments ?? 3}
                          </td>
                          <td>{passed ? '✅ Aprobado' : '📋 Terminado'}</td>
                          <td className="timestamp-cell">
                            {new Date(r.timestamp).toLocaleDateString()}{' '}
                            {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="dashboard-mobile-list dashboard-mobile-only">
                {filteredResults.map((r) => {
                  const passed = r.allPassed || (r.successes ?? 0) === (r.totalExperiments ?? 3);
                  return (
                    <article key={r.id} className={`result-card ${passed ? 'passed' : 'finished'}`}>
                      <div className="result-card-top">
                        <span className="result-card-name">{r.studentName}</span>
                        <span className="result-card-score">
                          {r.successes ?? 0}/{r.totalExperiments ?? 3}
                        </span>
                      </div>
                      <div className="result-card-bottom">
                        <span className="result-card-status">
                          {passed ? '✅ Aprobado' : '📋 Terminado'}
                        </span>
                        <time className="result-card-date">
                          {new Date(r.timestamp).toLocaleDateString()}{' '}
                          {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </time>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
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
          <div className="confirm-modal-card share-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="share-modal-title">📱 Compartir con Alumnos</h3>
            <p className="share-modal-desc">
              Escanea este código QR con la cámara de una tablet o teléfono para abrir el laboratorio:
            </p>

            <div className="share-qr-wrap">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=78350f&bgcolor=fdfbf7&data=${encodeURIComponent(window.location.origin)}`}
                alt="Código QR del Juego"
                className="share-qr-image"
              />
            </div>

            <div className="share-url-box">
              {window.location.origin}
            </div>

            <div className="confirm-modal-actions share-modal-actions">
              <button
                onClick={() => setShowShareModal(false)}
                className="dash-btn secondary confirm-btn"
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
