
// ...existing code...
import React, { useState, useRef } from 'react';
import { deepClone } from './simulacionUtils';
import './App.css';
import Caja from './Caja';


function App() {
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
    // Asignar clientes a cada caja según input
    for (const nombreCaja in clientesPorCaja) {
      const cantidad = Number.parseInt(clientesPorCaja[nombreCaja] || '0', 10);
      if (cantidad > 0) {
        await fetch('http://localhost:5000/api/agregar_clientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cantidad, caja: nombreCaja })
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

  // Detener simulación manualmente
  const handleDetener = () => {
    clearInterval(timerRef.current);
    setEnAnimacion(false);
    setSimulacionActiva(false);
    setComparacionRojo([]);
    setMejorCajaRojo(null);
    setEstadoAnimado([]);
    setTiempo(0);
  };

  // Cambiar número de clientes por caja
  const handleInputClientes = (nombreCaja, valor) => {
    setClientesPorCaja(prev => ({ ...prev, [nombreCaja]: valor }));
  };

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
  React.useEffect(() => {
    if (!enAnimacion) return;
    timerRef.current = setInterval(() => {
      setEstadoAnimado((prev) => {
        const nuevo = prev.map((caja) => {
          if (caja.rojoAtendido) return caja;
          let clientes = [...caja.clientes];
          let atendidos = [...caja.atendidos];
          let tiempoRestante = caja.tiempoRestante;
          let rojoEnFila = caja.rojoEnFila;
          let rojoAtendido = caja.rojoAtendido;
          let rojoTiempo = caja.rojoTiempo;
          let rojoArticulos = caja.rojoArticulos;
          let tiemposClientes = [...(caja.tiemposClientes || [])];
          // Si no hay tiempoRestante, tomar el siguiente cliente
          if (tiempoRestante === null && (clientes.length > 0 || rojoEnFila)) {
            let cliente;
            let tiempoCliente;
            if (clientes.length > 0) {
              cliente = clientes[0];
              tiempoCliente = tiemposClientes[0];
              clientes = clientes.slice(1);
              tiemposClientes = tiemposClientes.slice(1);
            } else {
              // Cliente rojo
              cliente = { nombre: 'Cliente Rojo', articulos: rojoArticulos };
              tiempoCliente = caja.tiempoRojo;
              rojoEnFila = false;
            }
            tiempoRestante = tiempoCliente;
            if (cliente.nombre === 'Cliente Rojo') {
              rojoTiempo = tiempoCliente;
            }
          }
          // Avanzar un segundo
          if (tiempoRestante !== null) {
            tiempoRestante -= 1;
            if (tiempoRestante <= 0) {
              if (!rojoEnFila) {
                rojoAtendido = true;
              }
              atendidos.push({ nombre: rojoEnFila ? 'Cliente' : 'Cliente Rojo' });
              tiempoRestante = null;
            }
          }
          return {
            ...caja,
            clientes,
            atendidos,
            tiempoRestante,
            rojoEnFila,
            rojoAtendido,
            rojoTiempo,
            rojoArticulos,
            tiemposClientes,
            tiempoRojo: caja.tiempoRojo,
          };
        });
        // Detener animación si todos los clientes han sido atendidos
        if (nuevo.every(caja => caja.rojoAtendido)) {
          clearInterval(timerRef.current);
          setEnAnimacion(false);
        }
        return nuevo;
      });
      setTiempo((t) => t + 1);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [enAnimacion]);

  React.useEffect(() => {
    // Al cargar la página, obtener solo la estructura de cajas vacías
    setSimulacionActiva(false);
    setComparacionRojo([]);
    setMejorCajaRojo(null);
    setEstadoAnimado([]);
    setTiempo(0);
    setEnAnimacion(false);
    // Llamar a un endpoint que devuelva solo la estructura de cajas vacías
    (async () => {
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
    })();
  }, []);

  // Render animación si está activa
  const mostrarAnimacion = enAnimacion && estadoAnimado.length > 0;

  return (
  <div style={{ padding: '24px', minHeight: '100vh', background: '#23272f' }}>
      <h1 style={{textAlign: 'center', color: '#fff', fontWeight: 'bold', fontSize: '2.8em', letterSpacing: '1px', marginBottom: '18px', textShadow: '2px 2px 8px #111'}}>Simulación de Cajas Registradoras</h1>
      <div style={{textAlign: 'center', margin: '24px 0', display: 'flex', gap: 16, justifyContent: 'center'}}>
        <button onClick={handleSimular} disabled={simulando || enAnimacion} style={{fontSize: '1.2em', padding: '12px 32px', borderRadius: '8px', background: '#1e90ff', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '1px 1px 8px #111', fontWeight: 'bold', letterSpacing: '1px'}}>
          {simulando ? 'Simulando...' : enAnimacion ? 'Simulación en curso...' : 'Crear nueva simulación (random)'}
        </button>
        <button onClick={handleIniciarManual} disabled={simulando || enAnimacion} style={{fontSize: '1.2em', padding: '12px 32px', borderRadius: '8px', background: '#28a745', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '1px 1px 8px #111', fontWeight: 'bold', letterSpacing: '1px'}}>
          Iniciar simulación (manual)
        </button>
        <button onClick={handleDetener} disabled={!enAnimacion} style={{fontSize: '1.2em', padding: '12px 32px', borderRadius: '8px', background: '#ff5555', color: '#fff', border: 'none', cursor: enAnimacion ? 'pointer' : 'not-allowed', fontWeight: 'bold', letterSpacing: '1px'}}>
          Detener simulación
        </button>
      </div>
      <div style={{ display: 'flex', gap: '32px', flexWrap: 'nowrap', justifyContent: 'center', alignItems: 'flex-start' }}>
        {((!simulacionActiva && !enAnimacion) || (cajas.length === 0 && !enAnimacion)) ? (
          <>
            {cajas.map((caja, i) => (
              <div key={i} style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                <Caja
                  nombre={caja.nombre}
                  clientes={[]}
                  esExpress={caja.nombre.toLowerCase().includes('express')}
                  cajero={caja.cajero}
                />
                <div style={{marginTop: 8}}>
                  <input
                    type="number"
                    min={1}
                    placeholder="N° clientes"
                    value={clientesPorCaja[caja.nombre] || ''}
                    onChange={e => handleInputClientes(caja.nombre, e.target.value)}
                    style={{width: 90, padding: 4, borderRadius: 4, border: '1px solid #888', marginRight: 6}}
                  />
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
                <div style={{marginTop: 8}}>
                  <input
                    type="number"
                    min={1}
                    placeholder="N° clientes"
                    value={clientesPorCaja[cajaExpress.nombre] || ''}
                    onChange={e => handleInputClientes(cajaExpress.nombre, e.target.value)}
                    style={{width: 90, padding: 4, borderRadius: 4, border: '1px solid #888', marginRight: 6}}
                  />
                </div>
              </div>
            )}
          </>
        ) : mostrarAnimacion ? (
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
        ])}
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
    </div>
  );
}

export default App;
