
// ...existing code...
import React, { useState, useRef, useEffect } from 'react';
import { deepClone, calcularTiempoAtencion } from './simulacionUtils';
import './App.css';
import Caja from './Caja';
// Nota: panel de configuración temporal removido para mantener compatibilidad


function App() {
  // Inicializar estado local para la simulación (frontend-only)
  useEffect(() => {
    // Crear una configuración base con 3 cajas y 1 express
    const crearCajero = () => {
      const experienciaRaw = Math.floor(Math.random() * 3) + 1; // 1..3
      let multiplicador = 1.0;
      let experienciaStr = 'Normal';
      if (experienciaRaw === 1) { multiplicador = 1.5; experienciaStr = 'Principiante'; }
      else if (experienciaRaw === 2) { multiplicador = 1.0; experienciaStr = 'Normal'; }
      else { multiplicador = 0.7; experienciaStr = 'Experto'; }
      return {
        experiencia: experienciaStr,
        experiencia_raw: experienciaRaw,
        multiplicador,
        horas_trabajadas: 0, // segundos
        sueldo_base: 400,
      };
    };

    const crearCajaLocal = (nombre) => ({
      nombre,
      cajero: crearCajero(),
      clientes_en_fila: [],
      cliente_actual: null,
      tiempo_restante_cliente_actual: 0,
      clientes_atendidos: []
    });

    const cajasInit = [crearCajaLocal('Caja 1'), crearCajaLocal('Caja 2'), crearCajaLocal('Caja 3')];
    const cajaExpress = crearCajaLocal('Caja Express');
    setCajas(cajasInit);
    setCajaExpress(cajaExpress);
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
    // Si la simulación no está activa ni en animación, permitir sobreescribir inputs
    if (!simulacionActiva && !enAnimacion) {
      // dejar cajas tal como están (inicializadas en useEffect)
    }
    setSimulacionActiva(false);

    // Asignar manualmente clientes a cajas según inputs (sin usar APIs)
    // Construir clientes y añadir a la caja correspondiente
    const crearClienteLocal = (nombre, agregado = false) => ({
      nombre,
      articulos: Math.floor(10 + Math.random() * 6),
      metodo_pago: ['Efectivo','Tarjeta','Transferencia'][Math.floor(Math.random()*3)],
      tiempo_estimado: null,
      es_rojo: nombre === 'Cliente Rojo',
      agregado_por_demanda: agregado,
    });

    // Aplicar entradas manuales (ajustando por día/hora seleccionados)
    const cajasCopy = [...cajas];
    const cajaExpressCopy = cajaExpress ? { ...cajaExpress } : null;
    const extras = [];
    for (const nombreCaja in clientesPorCaja) {
      const cantidad = Number.parseInt(clientesPorCaja[nombreCaja] || '0', 10);
      const cantidadAjustada = Math.max(0, Math.round(cantidad * demandaMultiplier(selectedDay, selectedHour)));
      if (cantidadAjustada > 0) {
        // buscar caja por nombre
        let destino = cajasCopy.find(c => c.nombre === nombreCaja);
        if (!destino && cajaExpressCopy && cajaExpressCopy.nombre === nombreCaja) destino = cajaExpressCopy;
        if (destino) {
          for (let i=0;i<cantidadAjustada;i++) {
            const isExtra = i >= cantidad; // los clientes por encima del valor ingresado fueron añadidos por el multiplicador
            const clienteLocal = crearClienteLocal(`${nombreCaja}_Cliente_${i+1}`, isExtra);
            destino.clientes_en_fila.push(clienteLocal);
            if (isExtra) extras.push(clienteLocal);
          }
        }
      }
      // Si hay selección de tipo de cajero, actualizar multiplicador
      const tipoCajero = cajeroPorCaja[nombreCaja];
      if (tipoCajero) {
        let destino = cajasCopy.find(c => c.nombre === nombreCaja);
        if (!destino && cajaExpressCopy && cajaExpressCopy.nombre === nombreCaja) destino = cajaExpressCopy;
        if (destino) {
          let expRaw = 2;
          if (tipoCajero === 'Principiante') expRaw = 1;
          else if (tipoCajero === 'Normal') expRaw = 2;
          else expRaw = 3;
          destino.cajero.experiencia = tipoCajero;
          destino.cajero.experiencia_raw = expRaw;
          if (expRaw === 1) destino.cajero.multiplicador = 1.5;
          else if (expRaw === 2) destino.cajero.multiplicador = 1.0;
          else destino.cajero.multiplicador = 0.7;
        }
      }
    }
    setCajas(cajasCopy);
    if (cajaExpressCopy) setCajaExpress(cajaExpressCopy);
    setSimulacionActiva(true);
      // En la versión frontend-only no hay resumen_comparacion del backend
      setComparacionRojo([]);
      setMejorCajaRojo(null);
    // Preparar estado animado inicial a partir de cajas locales
    // Replicar extras a todas las cajas normales y a express si aplica
    if (extras.length > 0) {
      for (const extra of extras) {
        for (const c of cajasCopy) {
          c.clientes_en_fila.push(deepClone(extra));
        }
        if (cajaExpressCopy) {
          if (extra.articulos <= 10) {
            cajaExpressCopy.clientes_en_fila.push(deepClone(extra));
          }
        }
      }
    }
    // Añadir Cliente Rojo al final de cada cola
    for (const c of cajasCopy) {
      c.clientes_en_fila.push(crearClienteLocal('Cliente Rojo', false));
    }
    if (cajaExpressCopy) {
      // cliente rojo para express con menos artículos
      cajaExpressCopy.clientes_en_fila.push({ ...crearClienteLocal('Cliente Rojo', false), articulos: 8, es_rojo: true });
    }

    const todasLocal = [...(cajasCopy || []), ...(cajaExpressCopy ? [{ ...cajaExpressCopy, esExpress: true }] : [])];
    setEstadoAnimado(todasLocal.map((caja) => ({
      clientes: deepClone(caja.clientes_en_fila),
      cajero: caja.cajero,
      esExpress: caja.nombre.toLowerCase().includes('express'),
      nombre: caja.nombre,
      tiempoRestante: caja.tiempo_restante_cliente_actual || null,
      atendidos: deepClone(caja.clientes_atendidos || []),
      rojoEnFila: true,
      rojoAtendido: false,
      rojoTiempo: 0,
      rojoArticulos: 0,
      rojoTiempoTotal: 0,
      tiemposClientes: (caja.clientes_en_fila || []).map(c => c.tiempo_estimado || 0),
      tiempoRojo: 0,
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
    // Reiniciar a cajas iniciales: volver a inicializar según useEffect original
    // (simplemente limpiar filas)
    setCajas(prev => prev.map(c => ({ ...c, clientes_en_fila: [], cliente_actual: null, clientes_atendidos: [], tiempo_restante_cliente_actual: 0 })));
    if (cajaExpress) setCajaExpress({ ...cajaExpress, clientes_en_fila: [], cliente_actual: null, clientes_atendidos: [], tiempo_restante_cliente_actual: 0 });
  };

  // Cambiar número de clientes por caja
  const handleInputClientes = (nombreCaja, valor) => {
    setClientesPorCaja(prev => ({ ...prev, [nombreCaja]: valor }));
  } 
  // Cambiar tipo de cajero por caja
  const handleSelectCajero = async (nombreCaja, tipo) => {
    setCajeroPorCaja(prev => ({ ...prev, [nombreCaja]: tipo }));
    // Aplicar cambio también al estado local de cajas para que se vea inmediatamente
    setCajas(prev => {
      const copia = prev.map(c => ({ ...c, cajero: { ...c.cajero } }));
      for (let i = 0; i < copia.length; i++) {
        if (copia[i].nombre === nombreCaja) {
          let expRaw = 2;
          if (tipo === 'Principiante') expRaw = 1;
          else if (tipo === 'Normal') expRaw = 2;
          else expRaw = 3;
          copia[i].cajero = {
            ...copia[i].cajero,
            experiencia: tipo,
            experiencia_raw: expRaw,
            multiplicador: expRaw === 1 ? 1.5 : expRaw === 2 ? 1.0 : 0.7
          };
          return copia;
        }
      }
      return copia;
    });
    setCajaExpress(prev => {
      if (!prev) return prev;
      if (prev.nombre === nombreCaja) {
        let expRaw = 2;
        if (tipo === 'Principiante') expRaw = 1;
        else if (tipo === 'Normal') expRaw = 2;
        else expRaw = 3;
        return { ...prev, cajero: { ...prev.cajero, experiencia: tipo, experiencia_raw: expRaw, multiplicador: expRaw === 1 ? 1.5 : expRaw === 2 ? 1.0 : 0.7 } };
      }
      return prev;
    });
    // Intentar actualizar el backend si existe
    try {
      await fetch('/api/set_cajero', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `nombre=${encodeURIComponent(nombreCaja)}&tipo=${encodeURIComponent(tipo)}`
      });
    } catch {
      // Silencioso: si no hay backend, la selección sigue afectando solo al frontend
    }
  }

  const [cajas, setCajas] = useState([]);
  const [cajaExpress, setCajaExpress] = useState(null);
  const utilizacionRegistroRef = useRef([]);
  const cajasRef = useRef(cajas);
  const cajaExpressRef = useRef(cajaExpress);
  useEffect(()=>{ cajasRef.current = cajas; }, [cajas]);
  useEffect(()=>{ cajaExpressRef.current = cajaExpress; }, [cajaExpress]);
  // Mantener `cajeroPorCaja` en sincronía con el estado `cajas` / `cajaExpress`.
  useEffect(() => {
    const map = {};
    for (const c of cajas) {
      const nombre = c && c.nombre ? c.nombre : '';
      if (nombre) map[nombre] = (c && c.cajero && c.cajero.experiencia) ? c.cajero.experiencia : 'Normal';
    }
    if (cajaExpress) {
      const nombre = cajaExpress.nombre || '';
      if (nombre) map[nombre] = (cajaExpress.cajero && cajaExpress.cajero.experiencia) ? cajaExpress.cajero.experiencia : 'Normal';
    }
    setCajeroPorCaja(map);
  }, [cajas, cajaExpress]);
  const [comparacionRojo, setComparacionRojo] = useState([]);
  const [mejorCajaRojo, setMejorCajaRojo] = useState(null);
  const [simulacionActiva, setSimulacionActiva] = useState(false);
  // const [mejorCaja, setMejorCaja] = useState(null);
  const [simulando, setSimulando] = useState(false);
  const [tiempo, setTiempo] = useState(0);
  const [enAnimacion, setEnAnimacion] = useState(false);
  const timerRef = useRef(null);
  // Parámetros de configuración locales (mantener constantes en frontend)

  // Estado para la animación: posición actual del cliente rojo en cada caja
  const [estadoAnimado, setEstadoAnimado] = useState([]);
  // Selector de día/hora para simular demanda (frontend)
  const now = new Date();
  // Mapear JS getDay() (0=domingo,1=lunes...) a 0=Lunes .. 6=Domingo
  const defaultDay = (now.getDay() + 6) % 7;
  const [selectedDay, setSelectedDay] = useState(defaultDay);
  const [selectedHour, setSelectedHour] = useState(now.getHours());
  // Helper: devuelve el multiplicador de demanda según día/hora seleccionados
  const demandaMultiplier = (day, hour) => {
    // day: 0=Lunes ... 6=Domingo
    let incremento = 0.0;
    if (day === 4) incremento += 0.05; // viernes
    else if (day === 5) incremento += 0.10; // sábado
    else if (day === 6) incremento += 0.15; // domingo
    if (hour >= 12 && hour < 14) incremento += 0.02; // hora punta 12:00-13:59
    return 1 + incremento;
  };
  // Parámetros de negocio en frontend (coinciden con backend)
  const rhoPeriodo = 30; // s
  const costoEsperaPorCliente = 0.05; // por segundo
  const slaUmbral = 120; // s
  const penalizacionSla = 50;

  // Calcular costo total localmente (sumatoria costo_por_hora + costo espera + penalización)
  const calcularCostoTotalLocal = () => {
    const all = [...(cajasRef.current || []), cajaExpressRef.current].filter(Boolean);
    let sumaCostosHora = 0;
    let tiempoEnFilas = 0;
    let numClientes = 0;
    for (const c of all) {
      const horas = Math.max((c.cajero.horas_trabajadas || 0) / 3600, 8);
      sumaCostosHora += (c.cajero.sueldo_base || 400) / horas;
      const fila = [...(c.clientes_en_fila || []), c.cliente_actual ? c.cliente_actual : null].filter(Boolean);
      for (const cl of fila) {
        const t = cl.tiempo_estimado != null ? cl.tiempo_estimado : calcularTiempoAtencion(cl, c.cajero.multiplicador);
        tiempoEnFilas += t;
        numClientes += 1;
      }
    }
    const costoEspera = costoEsperaPorCliente * tiempoEnFilas;
    let penal = 0;
    if (numClientes > 0) {
      const tiempoProm = tiempoEnFilas / numClientes;
      if (tiempoProm > slaUmbral) penal = penalizacionSla;
    }
    return sumaCostosHora + costoEspera + penal;
  };
  // const [finalizado, setFinalizado] = useState(false);

  // Iniciar simulación y animación
  const handleSimular = async () => {
  setSimulando(true);
  setTiempo(0);
  clearInterval(timerRef.current);
  setSimulacionActiva(false);
    try {
      // Inicializar una simulación local con 15 clientes (ajustable)
      const num_clientes = 15;
      // Ajustar demanda según día/hora seleccionados y repartir clientes
      const totalAjustado = Math.max(0, Math.round(num_clientes * demandaMultiplier(selectedDay, selectedHour)));

      // Crear lista de clientes y repartirlos aleatoriamente
      const crearClienteLocal = (i, agregado = false) => ({
        nombre: `Cliente_${i+1}`,
        articulos: Math.floor(10 + Math.random() * 6),
        metodo_pago: ['Efectivo','Tarjeta','Transferencia'][Math.floor(Math.random()*3)],
        tiempo_estimado: null,
        es_rojo: false,
        agregado_por_demanda: agregado,
      });

      const cajasCopy = [...cajas];
      const cajaExpressCopy = cajaExpress ? { ...cajaExpress } : null;
      const extras = [];
      for (let i=0;i<totalAjustado;i++) {
        const isExtra = i >= num_clientes; // los extras vienen del multiplicador
        const cliente = crearClienteLocal(i, isExtra);
        const puedeExpress = cliente.articulos <= 10 && cajaExpressCopy;
        if (puedeExpress) {
          // enviarlo sólo a express
          cajaExpressCopy.clientes_en_fila.push(cliente);
        } else {
          const destino = cajasCopy[Math.floor(Math.random()*cajasCopy.length)];
          destino.clientes_en_fila.push(cliente);
        }
        if (isExtra) extras.push(cliente);
      }
      // Replicar los clientes "extra" a todas las cajas normales y a la express si aplica
      if (extras.length > 0) {
        for (const extra of extras) {
          for (const c of cajasCopy) {
            c.clientes_en_fila.push(deepClone(extra));
          }
          if (cajaExpressCopy) {
            // si el extra tiene <=10 artículos, también añadirlo a express
            if (extra.articulos <= 10) {
              cajaExpressCopy.clientes_en_fila.push(deepClone(extra));
            }
          }
        }
      }
      // Añadir Cliente Rojo al final de cada cola (artículos <=10 para express)
      for (const c of cajasCopy) {
        const clienteRojo = {
          nombre: 'Cliente Rojo',
          articulos: 12,
          metodo_pago: 'Tarjeta',
          tiempo_estimado: null,
          es_rojo: true,
          agregado_por_demanda: false,
        };
        c.clientes_en_fila.push(clienteRojo);
      }
      if (cajaExpressCopy) {
        const clienteRojoExpress = {
          nombre: 'Cliente Rojo',
          articulos: 8,
          metodo_pago: 'Tarjeta',
          tiempo_estimado: null,
          es_rojo: true,
          agregado_por_demanda: false,
        };
        cajaExpressCopy.clientes_en_fila.push(clienteRojoExpress);
      }
      setCajas(cajasCopy);
      if (cajaExpressCopy) setCajaExpress(cajaExpressCopy);
      setSimulacionActiva(true);
      // Preparar estado animado inicial a partir de cajas locales
      const todasLocal = [...(cajasCopy || []), ...(cajaExpressCopy ? [{ ...cajaExpressCopy, esExpress: true }] : [])];
      setEstadoAnimado(todasLocal.map((caja) => ({
        clientes: deepClone(caja.clientes_en_fila),
        cajero: caja.cajero,
        esExpress: caja.nombre.toLowerCase().includes('express'),
        nombre: caja.nombre,
        tiempoRestante: caja.tiempo_restante_cliente_actual || null,
        atendidos: deepClone(caja.clientes_atendidos || []),
        rojoEnFila: true,
        rojoAtendido: false,
        rojoTiempo: 0,
        rojoArticulos: 0,
        rojoTiempoTotal: 0,
        tiemposClientes: (caja.clientes_en_fila || []).map(c => c.tiempo_estimado || 0),
        tiempoRojo: 0,
      })));
      setEnAnimacion(true);
    } catch {
      alert('Error al conectar con el backend');
      setEnAnimacion(false);
    }
    setSimulando(false);
  };

  // Nota: la interfaz ya no expone panel para enviar/obtener configuración al backend.

  useEffect(() => {
    if (!enAnimacion) return;
    timerRef.current = setInterval(() => {
      // Avanzar 1 segundo (o más si modoRapido)
      const pasos = modoRapido ? 10 : 1;
      for (let p=0;p<pasos;p++) {
        // Actualizar cada caja localmente
        setCajas(prev => {
          const copia = prev.map(c => ({ ...c, clientes_en_fila: [...c.clientes_en_fila], clientes_atendidos: [...c.clientes_atendidos] }));
          for (const caja of copia) {
            if (!caja.cliente_actual) {
              if (caja.clientes_en_fila.length > 0) {
                const siguiente = caja.clientes_en_fila.shift();
                siguiente.tiempo_estimado = calcularTiempoAtencion(siguiente, caja.cajero.multiplicador);
                caja.cliente_actual = siguiente;
                caja.tiempo_restante_cliente_actual = siguiente.tiempo_estimado;
              }
            } else {
              caja.tiempo_restante_cliente_actual -= 1;
              caja.cajero.horas_trabajadas += 1; // acumular segundo
              if (caja.tiempo_restante_cliente_actual <= 0) {
                caja.clientes_atendidos.push(caja.cliente_actual);
                caja.cliente_actual = null;
                caja.tiempo_restante_cliente_actual = 0;
              }
            }
          }
          return copia;
        });

        // Express
        setCajaExpress(prev => {
          if (!prev) return prev;
          const copia = { ...prev, clientes_en_fila: [...prev.clientes_en_fila], clientes_atendidos: [...prev.clientes_atendidos] };
          if (!copia.cliente_actual) {
            if (copia.clientes_en_fila.length > 0) {
              const siguiente = copia.clientes_en_fila.shift();
              siguiente.tiempo_estimado = calcularTiempoAtencion(siguiente, copia.cajero.multiplicador);
              copia.cliente_actual = siguiente;
              copia.tiempo_restante_cliente_actual = siguiente.tiempo_estimado;
            }
          } else {
            copia.tiempo_restante_cliente_actual -= 1;
            copia.cajero.horas_trabajadas += 1;
            if (copia.tiempo_restante_cliente_actual <= 0) {
              copia.clientes_atendidos.push(copia.cliente_actual);
              copia.cliente_actual = null;
              copia.tiempo_restante_cliente_actual = 0;
            }
          }
          return copia;
        });

        // Registro de utilización y apertura automática
        // calcular ocupados
        const currentCajas = cajasRef.current || [];
        // actualizar utilizacionRegistroRef
        let servidores = (currentCajas ? currentCajas.length : 0) + (cajaExpressRef.current ? 1 : 0);
        servidores = Math.max(1, servidores);
        let ocupados = 0;
        const allCajas = [...(cajasRef.current || []), cajaExpressRef.current].filter(Boolean);
        for (const c of allCajas) {
          if (c.cliente_actual || (c.clientes_en_fila && c.clientes_en_fila.length>0)) ocupados += 1;
        }
        const rhoActual = ocupados / servidores;
        utilizacionRegistroRef.current.push(rhoActual);
        if (utilizacionRegistroRef.current.length > rhoPeriodo) utilizacionRegistroRef.current.shift();

        // (no se calcula Lq promedio en UI actual)
        // Apertura automática desactivada en frontend (la lógica de apertura)
        // se gestiona manualmente en el backend. No crear cajas aquí.
      }

      // Actualizar estadoAnimado y tiempo
      setEstadoAnimado(() => {
        const all = [...(cajasRef.current || []), cajaExpressRef.current].filter(Boolean);
        return all.map(caja => ({
          clientes: deepClone(caja.clientes_en_fila || []),
          cajero: caja.cajero,
          esExpress: caja.nombre.toLowerCase().includes('express'),
          nombre: caja.nombre,
          tiempoRestante: caja.tiempo_restante_cliente_actual || null,
          atendidos: deepClone(caja.clientes_atendidos || []),
          rojoEnFila: true,
          rojoAtendido: false,
          rojoTiempo: 0,
          rojoArticulos: 0,
          rojoTiempoTotal: 0,
          tiemposClientes: (caja.clientes_en_fila || []).map(c => c.tiempo_estimado || 0),
          tiempoRojo: 0,
        }));
      });
      setTiempo(t => t+1);
    }, modoRapido ? 200 : 1000);
    return () => clearInterval(timerRef.current);
  }, [enAnimacion, modoRapido, cajas.length, cajaExpress]);

  

  // Render animación si está activa
  const mostrarAnimacion = enAnimacion && estadoAnimado.length > 0;

  // Calcular métricas para mostrar
  const costoTotal = calcularCostoTotalLocal();
  const numCajasEnServicio = cajas.length + (cajaExpress ? 1 : 0);
  // Mostrar costo sólo si la simulación está activa/animando (usamos directamente `enAnimacion || simulacionActiva` en renderizado)

  // Aplicar estado recibido del backend a los estados locales `cajas` y `cajaExpress`.
  // Sincronización con backend eliminada (Opción A). El frontend mantiene estado local.

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
        <button onClick={() => {
          // Agregar caja manualmente en frontend y rebalancear la mitad de la cola más larga
          const nueva = {
            nombre: `Caja ${cajas.length + 1}`,
            cajero: { experiencia: 'Normal', experiencia_raw: 2, multiplicador: 1.0, horas_trabajadas: 0, sueldo_base: 400 },
            clientes_en_fila: [],
            cliente_actual: null,
            tiempo_restante_cliente_actual: 0,
            clientes_atendidos: []
          };
          setCajas(prev => {
            const copia = [...prev];
            // buscar cola mas larga entre cajas normales
            let maxIdx = -1; let maxLen = 0;
            for (let i = 0; i < copia.length; i++) {
              const l = copia[i].clientes_en_fila ? copia[i].clientes_en_fila.length : 0;
              if (l > maxLen) { maxLen = l; maxIdx = i; }
            }
            // mover la mitad (ceil) si existe
            const nuevaCaja = { ...nueva };
            if (maxIdx >= 0 && maxLen > 0) {
              const origen = copia[maxIdx];
              const mover = Math.ceil(maxLen / 2);
              for (let k = 0; k < mover; k++) {
                if (origen.clientes_en_fila && origen.clientes_en_fila.length > 0) {
                  nuevaCaja.clientes_en_fila.push(origen.clientes_en_fila.shift());
                }
              }
            }
            copia.push(nuevaCaja);
            return copia;
          });
        }} style={{fontSize: '1.1em', padding: '12px 24px', borderRadius: '8px', background: '#ff8c00', color: '#fff', border: 'none', cursor: 'pointer'}}>
          Agregar caja
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
        {/* Apertura automática/desde UI eliminada por opción A */}
        {/* Selección de día y hora para simular demanda (0=Lunes .. 6=Domingo) */}
      </div>
      <div style={{display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12}}>
        <label style={{color:'#fff'}}>Día:</label>
        <select value={selectedDay} onChange={e => setSelectedDay(Number(e.target.value))} style={{padding:6, borderRadius:6}}>
          {[0,1,2,3,4,5,6].map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <label style={{color:'#fff'}}>Hora:</label>
        <select value={selectedHour} onChange={e => setSelectedHour(Number(e.target.value))} style={{padding:6, borderRadius:6}}>
          {Array.from({length:24}, (_,i)=>i).map(h => <option key={h} value={h}>{h}</option>)}
        </select>
      </div>
      {/* Panel de configuración eliminado por petición del usuario */}
      <div style={{marginBottom: 12, color: '#fff', display: 'flex', gap: 16, alignItems: 'center'}}>
        <div style={{background: '#181b22', padding: '8px 12px', borderRadius: 8}}>
          Costo total estimado: <b>{(enAnimacion || simulacionActiva) ? (costoTotal.toFixed ? costoTotal.toFixed(2) : costoTotal) : '0.00'}</b>
        </div>
        <div style={{background: '#181b22', padding: '8px 12px', borderRadius: 8}}>Cajas en servicio: <b>{numCajasEnServicio}</b></div>
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
                clientes={caja.clientes_en_fila}
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
                clientes={cajaExpress.clientes_en_fila}
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
                    clientes={caja.clientes_en_fila || []}
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
                  clientes={cajaExpress.clientes_en_fila || []}
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
