
// ...existing code...
import React, { useState, useRef, useEffect } from 'react';
import { deepClone } from './simulacionUtils';
import './App.css';
import Caja from './Caja';


function App() {
  // Cargar las cajas al inicio (cuando se monta el componente)
  useEffect(() => {
    const cargarCajas = async () => {
      try {
        await fetch('http://localhost:5000/api/simular', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ num_clientes: 0 })
        });
        const estado = await fetch('http://localhost:5000/api/estado');
        const data = await estado.json();
        setCajas(data.cajas || []);
        setCajaExpress(data.caja_express || null);
      } catch {
        setCajas([]);
        setCajaExpress(null);
      }
    };
    cargarCajas();
  }, []);
  // Estado para la velocidad de la simulación
  const [modoRapido, setModoRapido] = useState(false);
  // Nueva función: asignar clientes manualmente y simular
  const handleIniciarManual = async () => {
    setSimulando(true);
    setTiempo(0);
    clearInterval(timerRef.current);
    setComparacionRojo([]);
    setMejorCajaRojo(null);
    setEstadoAnimado([]);
    // Si la simulación no está activa ni en animación, limpiar cajas para permitir nuevos datos
    if (!simulacionActiva && !enAnimacion) {
      setCajas([]);
      setCajaExpress(null);
    }
    setSimulacionActiva(false);
    // Limpiar cajas y crear estructura vacía
    await fetch('http://localhost:5000/api/simular_manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    // Asignar clientes y tipo de cajero a cada caja según input
    for (const nombreCaja in clientesPorCaja) {
      const cantidad = Number.parseInt(clientesPorCaja[nombreCaja] || '0', 10);
      const tipoCajero = cajeroPorCaja[nombreCaja] || 'Normal';
      if (cantidad > 0) {
        await fetch('http://localhost:5000/api/agregar_clientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cantidad, caja: nombreCaja, tipo_cajero: tipoCajero })
        });
      }
    }
    // Obtener estado actualizado antes de animar
    const estadoActual = await fetch('http://localhost:5000/api/estado');
    const data = await estadoActual.json();
    setCajas(data.cajas);
    setCajaExpress(data.caja_express);
    setSimulacionActiva(true);
    if (data.resumen_comparacion) {
      const match = data.resumen_comparacion.match(/Comparación de tiempos: (.+)/);
      if (match) {
        const tabla = match[1].split(',').map(x => {
          const [nombre, tiempo] = x.trim().split(':');
          return { nombre: nombre.trim(), tiempo: tiempo.trim() };
        });
        setComparacionRojo(tabla);
      } else {
        setComparacionRojo([]);
      }
      const mejor = data.resumen_comparacion.match(/La mejor caja para el cliente rojo es (.+) con (\d+)s/);
      if (mejor) {
        setMejorCajaRojo(mejor[1]);
      } else {
        setMejorCajaRojo(null);
      }
    } else {
      setComparacionRojo([]);
      setMejorCajaRojo(null);
    }
    const todasCajas = [...data.cajas, { ...data.caja_express, esExpress: true }];
    setEstadoAnimado(todasCajas.map((caja) => ({
      clientes: deepClone(caja.en_fila),
      cajero: caja.cajero,
      esExpress: caja.nombre.toLowerCase().includes('express'),
      nombre: caja.nombre,
      tiempoRestante: null,
      atendidos: deepClone(caja.atendidos),
      rojoEnFila: true,
      rojoAtendido: false,
      rojoTiempo: 0,
      rojoArticulos: caja.cliente_rojo.articulos,
      rojoTiempoTotal: caja.cliente_rojo.tiempo_estimado,
      tiemposClientes: caja.en_fila.map(c => c.tiempo_estimado),
      tiempoRojo: caja.cliente_rojo.tiempo_estimado,
    })));
    setEnAnimacion(true);
    setSimulando(false);
    // Limpiar los inputs para permitir nueva entrada
    setClientesPorCaja({});
  };
  // Estado para inputs de clientes por caja
  const [clientesPorCaja, setClientesPorCaja] = useState({});
  // Estado para tipo de cajero por caja
  const [cajeroPorCaja, setCajeroPorCaja] = useState({});

  // Detener simulación manualmente
  const handleDetener = async () => {
    clearInterval(timerRef.current);
    setEnAnimacion(false);
    setSimulacionActiva(false);
    setComparacionRojo([]);
    setMejorCajaRojo(null);
    setEstadoAnimado([]);
    setTiempo(0);
    // Recargar estructura vacía para mostrar todas las cajas
    try {
      await fetch('http://localhost:5000/api/simular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ num_clientes: 0 })
      });
      const estado = await fetch('http://localhost:5000/api/estado');
      const data = await estado.json();
      setCajas(data.cajas || []);
      setCajaExpress(data.caja_express || null);
    } catch {
      setCajas([]);
      setCajaExpress(null);
    }
  };

  // Cambiar número de clientes por caja
  const handleInputClientes = (nombreCaja, valor) => {
    setClientesPorCaja(prev => ({ ...prev, [nombreCaja]: valor }));
  } 
  // Cambiar tipo de cajero por caja
  const handleSelectCajero = (nombreCaja, tipo) => {
    setCajeroPorCaja(prev => ({ ...prev, [nombreCaja]: tipo }));
  }

  const [cajas, setCajas] = useState([]);
  const [cajaExpress, setCajaExpress] = useState(null);
  const [comparacionRojo, setComparacionRojo] = useState([]);
  const [mejorCajaRojo, setMejorCajaRojo] = useState(null);
  const [simulacionActiva, setSimulacionActiva] = useState(false);
  // const [mejorCaja, setMejorCaja] = useState(null);
  const [simulando, setSimulando] = useState(false);
  const [tiempo, setTiempo] = useState(0);
  const [enAnimacion, setEnAnimacion] = useState(false);
  const timerRef = useRef(null);

  // Estado para la animación: posición actual del cliente rojo en cada caja
  const [estadoAnimado, setEstadoAnimado] = useState([]);
  // const [finalizado, setFinalizado] = useState(false);

  // Iniciar simulación y animación
  const handleSimular = async () => {
  setSimulando(true);
  setTiempo(0);
  clearInterval(timerRef.current);
  setSimulacionActiva(false);
    try {
      await fetch('http://localhost:5000/api/simular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ num_clientes: 15 })
      });
      const res = await fetch('http://localhost:5000/api/estado');
      const data = await res.json();
      setSimulacionActiva(true);
      // Guardar cajas normales y express por separado
      setCajas(data.cajas);
      setCajaExpress(data.caja_express);
      // Extraer tabla de comparación del resumen_comparacion
      if (data.resumen_comparacion) {
        const match = data.resumen_comparacion.match(/Comparación de tiempos: (.+)/);
        if (match) {
          const tabla = match[1].split(',').map(x => {
            const [nombre, tiempo] = x.trim().split(':');
            return { nombre: nombre.trim(), tiempo: tiempo.trim() };
          });
          setComparacionRojo(tabla);
        } else {
          setComparacionRojo([]);
        }
        const mejor = data.resumen_comparacion.match(/La mejor caja para el cliente rojo es (.+) con (\d+)s/);
        if (mejor) {
          setMejorCajaRojo(mejor[1]);
        } else {
          setMejorCajaRojo(null);
        }
      } else {
        setComparacionRojo([]);
        setMejorCajaRojo(null);
      }
      // Preparar estado animado inicial (usando en_fila y cliente_rojo, y los tiempos del backend)
      const todasCajas = [...data.cajas, { ...data.caja_express, esExpress: true }];
      setEstadoAnimado(todasCajas.map((caja) => ({
        clientes: deepClone(caja.en_fila),
        cajero: caja.cajero,
        esExpress: caja.nombre.toLowerCase().includes('express'),
        nombre: caja.nombre,
        tiempoRestante: null,
        atendidos: deepClone(caja.atendidos),
        rojoEnFila: true,
        rojoAtendido: false,
        rojoTiempo: 0,
        rojoArticulos: caja.cliente_rojo.articulos,
        rojoTiempoTotal: caja.cliente_rojo.tiempo_estimado,
        tiemposClientes: caja.en_fila.map(c => c.tiempo_estimado),
        tiempoRojo: caja.cliente_rojo.tiempo_estimado,
      })));
      setEnAnimacion(true);
    } catch {
      alert('Error al conectar con el backend');
      setEnAnimacion(false);
    }
    setSimulando(false);
  };

  // Animación automática: avanzar segundo a segundo
  useEffect(() => {
    if (!enAnimacion) return;
    timerRef.current = setInterval(async () => {
      // Avanzar la simulación en el backend
      const pasos = modoRapido ? 10 : 1;
      let avanzarRes, avanzarData;
      try {
        avanzarRes = await fetch('http://localhost:5000/api/avanzar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pasos })
        });
        avanzarData = await avanzarRes.json();
      } catch {
        clearInterval(timerRef.current);
        setEnAnimacion(false);
        return;
      }
      // Si el backend responde con error, detener animación
      if (avanzarRes.status !== 200 || avanzarData.error) {
        clearInterval(timerRef.current);
        setEnAnimacion(false);
        return;
      }
      // Obtener el estado actualizado del backend
      let estado, data;
      try {
        estado = await fetch('http://localhost:5000/api/estado');
        data = await estado.json();
      } catch {
        clearInterval(timerRef.current);
        setEnAnimacion(false);
        return;
      }
      if (estado.status !== 200 || data.error) {
        clearInterval(timerRef.current);
        setEnAnimacion(false);
        return;
      }
      const todasCajas = [...data.cajas, { ...data.caja_express, esExpress: true }];
      setEstadoAnimado(todasCajas.map((caja) => ({
        clientes: deepClone(caja.en_fila),
        cajero: caja.cajero,
        esExpress: caja.nombre.toLowerCase().includes('express'),
        nombre: caja.nombre,
        tiempoRestante: null,
        atendidos: deepClone(caja.atendidos),
        rojoEnFila: true,
        rojoAtendido: false,
        rojoTiempo: 0,
        rojoArticulos: caja.cliente_rojo.articulos,
        rojoTiempoTotal: caja.cliente_rojo.tiempo_estimado,
        tiemposClientes: caja.en_fila.map(c => c.tiempo_estimado),
        tiempoRojo: caja.cliente_rojo.tiempo_estimado,
      })));
      // Si la simulación terminó, detener el intervalo y mostrar la mejor caja solo una vez
      if (avanzarData.terminado) {
        clearInterval(timerRef.current);
        setEnAnimacion(false);
        // Mostrar mensaje de la mejor caja solo al finalizar
        if (data.resumen_comparacion) {
          const match = data.resumen_comparacion.match(/La mejor caja para el cliente rojo es (.+) con (\d+)s/);
          if (match) {
            setMejorCajaRojo(match[1]);
          }
        }
        return;
      }
    }, modoRapido ? 200 : 1000);
    return () => clearInterval(timerRef.current);
  }, [enAnimacion, modoRapido]);

  // Render animación si está activa
  const mostrarAnimacion = enAnimacion && estadoAnimado.length > 0;

  return (
  <div style={{ padding: '30px 30px 30px 30px', minHeight: '100vh', width: '100%', background: '#23272f', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start' }}>
      <h1 style={{textAlign: 'center', color: '#fff', fontWeight: 'bold', fontSize: '2.8em', letterSpacing: '1px', marginBottom: '18px', textShadow: '2px 2px 8px #111'}}>Simulación de Cajas Registradoras</h1>
  <div style={{textAlign: 'center', margin: '24px 0', display: 'flex', gap: 16, justifyContent: 'center', width: '100%'}}>
        <button onClick={handleSimular} disabled={simulando || enAnimacion} style={{fontSize: '1.2em', padding: '12px 32px', borderRadius: '8px', background: '#1e90ff', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '1px 1px 8px #111', fontWeight: 'bold', letterSpacing: '1px'}}>
          {simulando ? 'Simulando...' : enAnimacion ? 'Simulación en curso...' : 'Crear nueva simulación (random)'}
        </button>
        <button onClick={handleIniciarManual} disabled={simulando || enAnimacion} style={{fontSize: '1.2em', padding: '12px 32px', borderRadius: '8px', background: '#28a745', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '1px 1px 8px #111', fontWeight: 'bold', letterSpacing: '1px'}}>
          Iniciar simulación (manual)
        </button>
        <button onClick={handleDetener} disabled={!enAnimacion} style={{fontSize: '1.2em', padding: '12px 32px', borderRadius: '8px', background: '#ff5555', color: '#fff', border: 'none', cursor: enAnimacion ? 'pointer' : 'not-allowed', fontWeight: 'bold', letterSpacing: '1px'}}>
          Detener simulación
        </button>
        <button
          onClick={() => setModoRapido(m => !m)}
          style={{fontSize: '1.1em', padding: '8px 32px', borderRadius: '8px', border: '2px solid #1e90ff', background: modoRapido ? '#1e90ff' : '#23272f', color: '#fff', fontWeight: 'bold', boxShadow: modoRapido ? '0 0 8px #1e90ff88' : '0 1px 4px #111a', cursor: 'pointer', transition: 'background 0.2s', marginLeft: 24}}
        >
          Simulación rápida
        </button>
      </div>
      <div style={{ display: 'flex', gap: '32px', flexWrap: 'nowrap', justifyContent: 'center', alignItems: 'flex-start', width: '100%' }}>
  {enAnimacion ? mostrarAnimacion ? (
          estadoAnimado.map((caja, i) => (
            <div key={i} style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
              <Caja
                nombre={caja.nombre}
                clientes={caja.clientes}
                esExpress={caja.esExpress}
                cajero={caja.cajero}
                animando={true}
                atendidos={caja.atendidos}
                tiempoRestante={caja.tiempoRestante}
              />
            </div>
          ))
        ) : ([
          ...cajas.map((caja, i) => (
            <div key={i} style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
              <Caja
                nombre={caja.nombre}
                clientes={caja.en_fila}
                esExpress={caja.nombre.toLowerCase().includes('express')}
                cajero={caja.cajero}
                articulosRojo={caja.cliente_rojo.articulos}
              />
            </div>
          )),
          cajaExpress && (
            <div key={cajas.length} style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
              <Caja
                nombre={cajaExpress.nombre}
                clientes={cajaExpress.en_fila}
                esExpress={true}
                cajero={cajaExpress.cajero}
                articulosRojo={cajaExpress.cliente_rojo.articulos}
              />
            </div>
          )
        ]) : (
          <>
            {cajas.map((caja, i) => (
              <div key={i} style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                <Caja
                  nombre={caja.nombre}
                  clientes={[]}
                  esExpress={caja.nombre.toLowerCase().includes('express')}
                  cajero={caja.cajero}
                />
                <div style={{marginTop: 8, display: 'flex', gap: 8, alignItems: 'center'}}>
                  <input
                    type="number"
                    min={1}
                    placeholder="N° clientes"
                    value={clientesPorCaja[caja.nombre] || ''}
                    onChange={e => handleInputClientes(caja.nombre, e.target.value)}
                    style={{width: 90, padding: 6, borderRadius: 6, border: '1px solid #888', marginRight: 2, fontSize: '1.08em'}}
                  />
                  <select
                    value={cajeroPorCaja[caja.nombre] || 'Normal'}
                    onChange={e => handleSelectCajero(caja.nombre, e.target.value)}
                    style={{padding: '6px 12px', borderRadius: '6px', border: '1px solid #1e90ff', background: '#223a5e', color: '#fff', fontWeight: 'bold', fontSize: '1.08em', boxShadow: '0 1px 4px #111a'}}
                  >
                    <option value="Normal">Normal</option>
                    <option value="Principiante">Principiante</option>
                    <option value="Experto">Experto</option>
                  </select>
                </div>
              </div>
            ))}
            {cajaExpress && (
              <div key={cajas.length} style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                <Caja
                  nombre={cajaExpress.nombre}
                  clientes={cajaExpress.en_fila}
                  esExpress={true}
                  cajero={cajaExpress.cajero}
                />
                <div style={{marginTop: 8, display: 'flex', gap: 8, alignItems: 'center'}}>
                  <input
                    type="number"
                    min={1}
                    placeholder="N° clientes"
                    value={clientesPorCaja[cajaExpress.nombre] || ''}
                    onChange={e => handleInputClientes(cajaExpress.nombre, e.target.value)}
                    style={{width: 90, padding: 6, borderRadius: 6, border: '1px solid #888', marginRight: 2, fontSize: '1.08em'}}
                  />
                  <select
                    value={cajeroPorCaja[cajaExpress.nombre] || 'Normal'}
                    onChange={e => handleSelectCajero(cajaExpress.nombre, e.target.value)}
                    style={{padding: '6px 12px', borderRadius: '6px', border: '1px solid #1e90ff', background: '#223a5e', color: '#fff', fontWeight: 'bold', fontSize: '1.08em', boxShadow: '0 1px 4px #111a'}}
                  >
                    <option value="Normal">Normal</option>
                    <option value="Principiante">Principiante</option>
                    <option value="Experto">Experto</option>
                  </select>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {/* Texto explicativo eliminado por solicitud del usuario */}
      {/* Tabla de comparación del cliente rojo */}
  {simulacionActiva && comparacionRojo.length > 0 && (
        <div style={{margin: '32px auto 0', maxWidth: 480, background: '#181b22', borderRadius: 12, boxShadow: '0 2px 12px #0008', padding: 18, color: '#fff'}}>
          <h3 style={{marginBottom: 12, color: '#ff5555', fontWeight: 'bold'}}>Comparación de tiempos para el Cliente Rojo</h3>
          <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '1.1em'}}>
            <thead>
              <tr style={{background: '#23272f'}}>
                <th style={{padding: 6, borderTopLeftRadius: 6, borderBottomLeftRadius: 6}}>Caja</th>
                <th style={{padding: 6, borderTopRightRadius: 6, borderBottomRightRadius: 6}}>Tiempo total (s)</th>
              </tr>
            </thead>
            <tbody>
              {comparacionRojo.map((row, i) => (
                <tr key={i} style={{background: mejorCajaRojo === row.nombre ? '#1e90ff44' : 'none', fontWeight: mejorCajaRojo === row.nombre ? 'bold' : 'normal'}}>
                  <td style={{padding: 6}}>{row.nombre}</td>
                  <td style={{padding: 6}}>{row.tiempo}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {mejorCajaRojo && (
            <div style={{marginTop: 10, color: '#1e90ff', fontWeight: 'bold'}}>Mejor opción: {mejorCajaRojo}</div>
          )}
        </div>
      )}
      {mostrarAnimacion && (
        <div style={{marginTop: '24px', textAlign: 'center', color: '#fff', fontSize: '1.2em'}}>
          <b>Tiempo transcurrido:</b> {tiempo} segundos
        </div>
      )}
      {mejorCajaRojo && (
        <div style={{marginTop: '32px', textAlign: 'center', color: '#1e90ff', fontSize: '1.4em', fontWeight: 'bold', background: '#181b22', borderRadius: 10, padding: '12px 24px', boxShadow: '0 2px 12px #0008'}}>
          🏆 La caja más rápida fue: {mejorCajaRojo}
        </div>
      )}
    </div>
  );
}
export default App;
