
// ...existing code...
import React, { useState, useRef, useEffect } from 'react';
import { deepClone, calcularTiempoAtencion } from './simulacionUtils';
import './App.css';
import Caja from './Caja';
// Nota: panel de configuración temporal removido para mantener compatibilidad

// Tarifa por hora usada en la tabla de costos (declarada una sola vez)
const TARIFA_POR_HORA = 0.50;


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
      const previewHoras = (1 + Math.floor(Math.random() * 12));
      return {
        experiencia: experienciaStr,
        experiencia_raw: experienciaRaw,
        multiplicador,
        horas_trabajadas: 0, // segundos reales acumulados durante la simulación
        preview_horas_trabajadas_seconds: previewHoras * 3600,
        sueldo_base: 400,
      };
    };

    const crearCajaLocal = (nombre, descansoHora = null) => ({
      nombre,
      cajero: crearCajero(),
      clientes_en_fila: [],
      cliente_actual: null,
      tiempo_restante_cliente_actual: 0,
      clientes_atendidos: [],
      descansando: false,
      descansoHora,
      // pérdidas acumuladas por abandonos en esta caja (frontend)
      perdida_total: 0,
      clientes_perdidos: []
    });

    // Asignar descansos por defecto: Caja 1 descansa 12-13, Caja 2 descansa 13-14
    const cajasInit = [crearCajaLocal('Caja 1', 12), crearCajaLocal('Caja 2', 13), crearCajaLocal('Caja 3', null)];
    const cajaExpress = crearCajaLocal('Caja Express', null);
    setCajas(cajasInit);
    setCajaExpress(cajaExpress);
  }, []);
  // Estado para la velocidad de la simulación
  const [modoRapido, setModoRapido] = useState(false);
  // Nueva función: asignar clientes manualmente y simular
  const handleIniciarManual = async () => {
    setSimulando(true);
    // Si estamos en hora pico, reactivar cajas para que todas atiendan
    wakeBoxesIfPeak(selectedHour);
    setLastCostoTotal(0);
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

    const crearClienteLocal = (nombre, agregado = false) => {
      const articulos = Math.floor(10 + Math.random() * 6);
      // paciencia en segundos (2..6 minutos)
      const paciencia = Math.floor(120 + Math.random() * (360 - 120 + 1));
      // precio total estimado sumando precios aleatorios por artículo (5..150)
      let precio_total = 0;
      for (let i = 0; i < articulos; i++) {
        precio_total += Math.random() * (150 - 5) + 5;
      }
      precio_total = Math.round(precio_total * 100) / 100;
      return {
        nombre,
        articulos,
        metodo_pago: ['Efectivo','Tarjeta','Transferencia'][Math.floor(Math.random()*3)],
        tiempo_estimado: null,
        es_rojo: nombre === 'Cliente Rojo',
        agregado_por_demanda: agregado,
        paciencia,
        precio_total,
        abandono: false,
        tiempo_en_fila: 0
      };
    };

    // Aplicar entradas manuales (ajustando por día/hora seleccionados)
    // Copiar cajas y reiniciar contadores de atención para el inicio manual
    const cajasCopy = [...cajas].map(c => ({
      ...c,
      clientes_en_fila: [...(c.clientes_en_fila || [])],
      cliente_actual: null,
      tiempo_restante_cliente_actual: 0,
      clientes_atendidos: [],
      perdida_total: 0,
      clientes_perdidos: [],
      cajero: { ...(c.cajero || {}), horas_trabajadas: 0 }
    }));
    const cajaExpressCopy = cajaExpress ? ({
      ...cajaExpress,
      clientes_en_fila: [...(cajaExpress.clientes_en_fila || [])],
      cliente_actual: null,
      tiempo_restante_cliente_actual: 0,
      clientes_atendidos: [],
      perdida_total: 0,
      clientes_perdidos: [],
      cajero: { ...(cajaExpress.cajero || {}), horas_trabajadas: 0 }
    }) : null;
    // Generar nuevos previews aleatorios (1..12h) y persistir en localStorage cada vez que iniciamos
    try {
      for (const c of cajasCopy) {
        if (!c || !c.cajero) continue;
        const ph = (1 + Math.floor(Math.random() * 12)) * 3600;
        c.cajero.preview_horas_trabajadas_seconds = ph;
        try { window.localStorage.setItem(`preview_horas_${(c.nombre||'').replace(/\s+/g,'_')}`, String(ph)); } catch (e) { void e; }
      }
      if (cajaExpressCopy && cajaExpressCopy.cajero) {
        const phE = (1 + Math.floor(Math.random() * 12)) * 3600;
        cajaExpressCopy.cajero.preview_horas_trabajadas_seconds = phE;
        try { window.localStorage.setItem(`preview_horas_${(cajaExpressCopy.nombre||'').replace(/\s+/g,'_')}`, String(phE)); } catch (e) { void e; }
      }
    } catch (e) { void e; }
    // Si hay una caja seleccionada en la tabla, calcular referencia para usar como destino
    const destinoSeleccionado = cajaSeleccionada ? (cajasCopy.find(c => c.nombre === cajaSeleccionada) || (cajaExpressCopy && cajaExpressCopy.nombre === cajaSeleccionada ? cajaExpressCopy : null)) : null;
    // Calcular multiplicador y cantidades ajustadas por cada input, pero NO asignar extras todavía
    const multManual = computeEffectiveMultiplier(selectedDay, selectedHour);
    const baseAssignments = []; // { destinoName, baseCount }
    let totalBase = 0;
    let totalAjustado = 0;
    for (const nombreCaja in clientesPorCaja) {
      const cantidad = Number.parseInt(clientesPorCaja[nombreCaja] || '0', 10) || 0;
      const cantidadAjustada = Math.max(0, Math.round(cantidad * multManual));
      totalBase += cantidad;
      totalAjustado += cantidadAjustada;
      baseAssignments.push({ nombre: nombreCaja, base: cantidad, ajustada: cantidadAjustada });
    }
    // Asignar las cantidades base a sus destinos (respetando cajaSeleccionada y descansos)
    for (const asg of baseAssignments) {
      const { nombre, base } = asg;
      let destino = destinoSeleccionado || cajasCopy.find(c => c.nombre === nombre);
      if (!destino && cajaExpressCopy && cajaExpressCopy.nombre === nombre) destino = cajaExpressCopy;
      for (let i = 0; i < base; i++) {
        const clienteLocal = crearClienteLocal(`${nombre}_Cliente_${i+1}`, false);
        if (destino && destino.descansando) {
          const alternativa = cajasCopy.find(cc => !cc.descansando && cc.nombre !== destino.nombre);
          if (alternativa) alternativa.clientes_en_fila.push(clienteLocal);
          else if (cajaExpressCopy && !cajaExpressCopy.descansando) cajaExpressCopy.clientes_en_fila.push(clienteLocal);
        } else if (destino) {
          destino.clientes_en_fila.push(clienteLocal);
        }
      }
      // Si hay selección de tipo de cajero, actualizar multiplicador
      const tipoCajero = cajeroPorCaja[nombre];
      if (tipoCajero) {
        let dest = cajasCopy.find(c => c.nombre === nombre);
        if (!dest && cajaExpressCopy && cajaExpressCopy.nombre === nombre) dest = cajaExpressCopy;
        if (dest) {
          let expRaw = 2;
          if (tipoCajero === 'Principiante') expRaw = 1;
          else if (tipoCajero === 'Normal') expRaw = 2;
          else expRaw = 3;
          dest.cajero.experiencia = tipoCajero;
          dest.cajero.experiencia_raw = expRaw;
          dest.cajero.multiplicador = expRaw === 1 ? 1.5 : expRaw === 2 ? 1.0 : 0.7;
        }
      }
    }
    // Distribuir los extras (si existen) equitativamente entre las cajas disponibles
    const extrasTotal = Math.max(0, totalAjustado - totalBase);
    if (extrasTotal > 0) {
      const disponibles = [...cajasCopy.filter(c => !c.descansando)];
      if (cajaExpressCopy && !cajaExpressCopy.descansando) disponibles.push(cajaExpressCopy);
      const countDisp = disponibles.length;
      if (countDisp > 0) {
        const perCaja = Math.floor(extrasTotal / countDisp);
        let remainder = extrasTotal % countDisp;
        for (let idx = 0; idx < disponibles.length; idx++) {
          const dest = disponibles[idx];
          let toAdd = perCaja + (remainder > 0 ? 1 : 0);
          if (remainder > 0) remainder -= 1;
          for (let k = 0; k < toAdd; k++) {
            dest.clientes_en_fila.push(crearClienteLocal(`${dest.nombre}_Extra_${k+1}`, true));
          }
        }
      }
    }
    // Asegurar que Cliente Rojo quede al final de cada cola
    ensureRojoAtEndForAll(cajasCopy, cajaExpressCopy);
    setCajas(cajasCopy);
    if (cajaExpressCopy) setCajaExpress(cajaExpressCopy);
    setSimulacionActiva(true);
      // En la versión frontend-only no hay resumen_comparacion del backend
      setComparacionRojo([]);
      setMejorCajaRojo(null);
    // Preparar estado animado inicial a partir de cajas locales
    // Los extras se mantienen únicamente en la caja destino donde se crearon.
    // Agregar Cliente Rojo: si hay una caja seleccionada, añadirlo ahí; si no, añadirlo en las cajas objetivo ingresadas
    const targetNames = Object.keys(clientesPorCaja).filter(n => Number.parseInt(clientesPorCaja[n] || '0', 10) > 0);
    if (cajaSeleccionada) {
      const destinoRojo = destinoSeleccionado;
      if (destinoRojo && !destinoRojo.descansando) destinoRojo.clientes_en_fila.push(crearClienteLocal('Cliente Rojo', false));
      else {
        const alternativa = cajasCopy.find(cc => !cc.descansando);
        if (alternativa) alternativa.clientes_en_fila.push(crearClienteLocal('Cliente Rojo', false));
        else if (cajaExpressCopy && !cajaExpressCopy.descansando) cajaExpressCopy.clientes_en_fila.push(crearClienteLocal('Cliente Rojo', false));
      }
    } else if (targetNames.length > 0) {
      for (const name of targetNames) {
        let destino = cajasCopy.find(c => c.nombre === name);
        if (!destino && cajaExpressCopy && cajaExpressCopy.nombre === name) destino = cajaExpressCopy;
        if (destino && !destino.descansando) {
          destino.clientes_en_fila.push(crearClienteLocal('Cliente Rojo', false));
        } else {
          const alternativa = cajasCopy.find(cc => !cc.descansando);
          if (alternativa) alternativa.clientes_en_fila.push(crearClienteLocal('Cliente Rojo', false));
          else if (cajaExpressCopy && !cajaExpressCopy.descansando) cajaExpressCopy.clientes_en_fila.push(crearClienteLocal('Cliente Rojo', false));
        }
      }
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
  // Estado para bases aleatorias de preview cuando no hay input manual
  const [previewBases, setPreviewBases] = useState({});


  // Detener simulación manualmente
  const handleDetener = async () => {
    clearInterval(timerRef.current);
    setEnAnimacion(false);
    setSimulacionActiva(false);
    setComparacionRojo([]);
    setMejorCajaRojo(null);
    setEstadoAnimado([]);
    setTiempo(0);
    // guardar el costo final cuando se detiene
    setLastCostoTotal(calcularCostoTotalLocal());
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
    } catch (e) {
      void e;
      // Silencioso: si no hay backend, la selección sigue afectando solo al frontend
    }
  }

  const [cajas, setCajas] = useState([]);
  const [cajaExpress, setCajaExpress] = useState(null);
  const [cajaSeleccionada, setCajaSeleccionada] = useState(null);
  const [lastCostoTotal, setLastCostoTotal] = useState(0);
  const utilizacionRegistroRef = useRef([]);
  const cajasRef = useRef(cajas);
  const cajaExpressRef = useRef(cajaExpress);
  useEffect(()=>{ cajasRef.current = cajas; }, [cajas]);
  useEffect(()=>{ cajaExpressRef.current = cajaExpress; }, [cajaExpress]);
  // Asegurar que cada cajero tenga un preview de horas estable (1..12 h) guardado en el estado
  useEffect(() => {
    let needUpdate = false;
    const updated = (cajas || []).map(c => {
      if (!c || !c.cajero) return c;
      if (!c.cajero.preview_horas_trabajadas_seconds || c.cajero.preview_horas_trabajadas_seconds <= 0) {
        needUpdate = true;
        return { ...c, cajero: { ...c.cajero, preview_horas_trabajadas_seconds: (1 + Math.floor(Math.random() * 12)) * 3600 } };
      }
      return c;
    });
    if (needUpdate) setCajas(updated);
    if (cajaExpress && (!cajaExpress.cajero || !cajaExpress.cajero.preview_horas_trabajadas_seconds || cajaExpress.cajero.preview_horas_trabajadas_seconds <= 0)) {
      const ph = (1 + Math.floor(Math.random() * 12)) * 3600;
      setCajaExpress(prev => prev ? ({ ...prev, cajero: { ...(prev.cajero || {}), preview_horas_trabajadas_seconds: ph } }) : prev);
    }
  }, [cajas, cajaExpress]);
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
  // Asegurar que la hora inicial esté dentro del rango operativo 08..20
  const defaultHour = Math.min(20, Math.max(8, now.getHours()));
  const [selectedHour, setSelectedHour] = useState(defaultHour);
  // Helper: devuelve el multiplicador de demanda según día/hora seleccionados
  const demandaMultiplier = (day, hour) => {
    // day: 0=Lunes ... 6=Domingo
    // Aplicar solo dentro del horario operativo 08:00-20:00
    if (hour < 8 || hour > 20) return 1.0;
    let incremento = 0.0;
    if (day === 4) incremento += 0.05; // viernes
    else if (day === 5) incremento += 0.10; // sábado
    else if (day === 6) incremento += 0.15; // domingo
    // hora punta: incluir 12,13 y 14
    if (hour >= 12 && hour <= 14) incremento += 0.30;
    return 1 + incremento;
  };

  // Si la hora seleccionada es pico, reactivar todas las cajas (no en descanso)
  const wakeBoxesIfPeak = (hour) => {
    if (hour >= 12 && hour <= 14) {
      setCajas(prev => prev.map(c => ({ ...c, descansando: false })));
      setCajaExpress(prev => prev ? { ...prev, descansando: false } : prev);
    }
  };

  // Asegurar que si hay un Cliente Rojo en una cola, quede siempre al final
  const ensureRojoAtEndForAll = (cajasArr, cajaExpr) => {
    for (const caja of cajasArr) {
      if (!caja || !Array.isArray(caja.clientes_en_fila)) continue;
      const idx = caja.clientes_en_fila.findIndex(cl => cl && cl.es_rojo);
      if (idx >= 0 && idx < caja.clientes_en_fila.length - 1) {
        const [rojo] = caja.clientes_en_fila.splice(idx, 1);
        caja.clientes_en_fila.push(rojo);
      }
    }
    if (cajaExpr && Array.isArray(cajaExpr.clientes_en_fila)) {
      const idxE = cajaExpr.clientes_en_fila.findIndex(cl => cl && cl.es_rojo);
      if (idxE >= 0 && idxE < cajaExpr.clientes_en_fila.length - 1) {
        const [rojoE] = cajaExpr.clientes_en_fila.splice(idxE, 1);
        cajaExpr.clientes_en_fila.push(rojoE);
      }
    }
  };

  const handleSelectHour = (h) => {
    setSelectedHour(h);
    // Nueva regla de descansos automáticos:
    // - Si selecciona 12:00 => Caja 2 y todas las cajas adicionales (índice >=1) descansan (12-13).
    // - Si selecciona 13:00 => Caja 1 y Caja Express descansan (13-14).
    // - Otras horas => ninguna caja en descanso automático.
    if (h === 12) {
      setCajas(prev => prev.map((c, idx) => ({ ...c, descansando: idx >= 1 })));
      setCajaExpress(prev => prev ? { ...prev, descansando: false } : prev);
    } else if (h === 13) {
      setCajas(prev => prev.map((c, idx) => ({ ...c, descansando: idx === 0 })));
      setCajaExpress(prev => prev ? { ...prev, descansando: true } : prev);
    } else {
      // no descansos automáticos fuera de las horas 12/13
      setCajas(prev => prev.map(c => ({ ...c, descansando: false })));
      setCajaExpress(prev => prev ? { ...prev, descansando: false } : prev);
    }
  };

  // Multiplicador efectivo: aplica la regla de horario (08-20), la hora pico 12-14 (+2%)
  // y amplifica los incrementos de fin de semana para que sean mucho más notables.
  // Esta función NO depende de si el usuario seleccionó una caja: si la hora es 12/13/14
  // el aumento se aplica tanto en modo manual como en modo random.
  const computeEffectiveMultiplier = (day, hour) => {
    // Usar el multiplicador base
    const base = demandaMultiplier(day, hour); // 1.0 + incremento
    const incrementoBase = base - 1.0;
    // Amplificar incrementos de fin de semana (hacerlos "mucho más grandes")
    let incremento = incrementoBase;
    if (day === 4) incremento = incrementoBase * 3; // viernes
    else if (day === 5) incremento = incrementoBase * 3; // sábado
    else if (day === 6) incremento = incrementoBase * 3; // domingo
    return 1.0 + incremento;
  };
  // Parámetros de negocio en frontend (coinciden con backend)
  const BASE_PER_CAJA = 10; // clientes base por caja para simulación random
  const rhoPeriodo = 30; // s

  // Calcular costo total localmente (sumatoria costo_por_hora + costo espera + penalización)
  const calcularCostoTotalLocal = () => {
    const desglose = calcularCostosPorCaja();
    // Sumar pago por horas más pérdidas por abandonos para obtener costo total
    return desglose.reduce((s, r) => s + (r.total || 0) + (r.perdidaTotal || 0), 0);
  };

  // Devuelve arreglo con desglose de costos por caja
  const calcularCostosPorCaja = () => {
    const rows = [];
    const all = [...(cajasRef.current || []), cajaExpressRef.current].filter(Boolean);
    for (const c of all) {
      const nombre = c.nombre || 'Caja';
      const clientesAtendidos = (c.clientes_atendidos || []).length;
      // Añadir métricas de pérdidas y clientes perdidos (si el frontend acumuló abandonos)
      const perdidaTotal = c.perdida_total || 0;
      const clientesPerdidos = (c.clientes_perdidos || []).length || 0;
      // lista de nombres de clientes que abandonaron (para mostrar en la tabla)
      const listaAbandonos = (c.clientes_perdidos || []).map(cl => cl && cl.nombre ? cl.nombre : '').filter(Boolean).join(', ');
      // horas trabajadas como entero (horas)
      // Si la caja está descansando mostramos 0 horas y pago 0.
      // Rango válido para horas trabajadas: 1..12 (cuando no está descansando)
      // Si no hay simulación activa, mostrar 0 horas (antes de iniciar)
      if (!enAnimacion && !simulacionActiva) {
        rows.push({ nombre, clientesAtendidos, horasTrab: 0, total: 0, perdidaTotal, clientesPerdidos, listaAbandonos });
        continue;
      }

      // Durante simulación: usar un valor aleatorio estable entre 1..12 horas (preview)
      // Si falta el preview, generarlo, persistirlo y usarlo. No usamos las horas reales
      // para sobreescribir el preview visual que el usuario pidió.
      let previewSeconds = 0;
      try {
        const key = `preview_horas_${(c.nombre || '').replace(/\s+/g, '_')}`;
        const stored = window.localStorage.getItem(key);
        if (stored) {
          const parsed = parseInt(stored, 10);
          if (!Number.isNaN(parsed) && parsed > 0) previewSeconds = parsed;
        }
        // fallback al valor dentro del objeto cajero si existe
        if (!previewSeconds && c.cajero && c.cajero.preview_horas_trabajadas_seconds && c.cajero.preview_horas_trabajadas_seconds > 0) {
          previewSeconds = c.cajero.preview_horas_trabajadas_seconds;
        }
        // si aún no hay preview, generar uno aleatorio entre 1..12 h y persistir
        if (!previewSeconds) {
          const ph = (1 + Math.floor(Math.random() * 12)) * 3600;
          previewSeconds = ph;
          try { window.localStorage.setItem(key, String(previewSeconds)); } catch (e) { void e; }
          // también dejarlo en el objeto cajero para consistencia en memoria
          if (c.cajero) c.cajero.preview_horas_trabajadas_seconds = previewSeconds;
        }
      } catch (e) {
        void e;
        if (c.cajero && c.cajero.preview_horas_trabajadas_seconds && c.cajero.preview_horas_trabajadas_seconds > 0) previewSeconds = c.cajero.preview_horas_trabajadas_seconds;
      }

      const previewHours = Math.max(1, Math.min(12, Math.floor(previewSeconds / 3600) || 1));
      const horasComputed = c.descansando ? 0 : previewHours;
      const total = c.descansando ? 0 : (TARIFA_POR_HORA * horasComputed);
      rows.push({ nombre, clientesAtendidos, horasTrab: horasComputed, total, perdidaTotal, clientesPerdidos, listaAbandonos });
      continue;
      
    }
    return rows;
  };
  // wrapper para compatibilidad con el render que llamaba a `calcularTablaSalarios`
  const calcularTablaSalarios = () => calcularCostosPorCaja();
  // Obtener lista global de abandonos para mostrar en UI
  const obtenerAbandonosGlobal = () => {
    const all = [...(cajasRef.current || []), cajaExpressRef.current].filter(Boolean);
    const res = [];
    for (const c of all) {
      const perdidos = (c.clientes_perdidos || []);
      for (const cl of perdidos) {
        if (!cl) continue;
        res.push({
          caja: c.nombre || 'Caja',
          nombre: cl.nombre || '-',
          tiempo_en_fila: cl.tiempo_en_fila || 0,
          precio_total: cl.precio_total || 0,
          agregado_por_demanda: cl.agregado_por_demanda || false
        });
      }
    }
    return res;
  };
  // const [finalizado, setFinalizado] = useState(false);

  // Iniciar simulación y animación
  const handleSimular = async () => {
  setSimulando(true);
  // Si es hora pico, asegurar que todas las cajas estén activas
  wakeBoxesIfPeak(selectedHour);
  setLastCostoTotal(0);
  setTiempo(0);
  clearInterval(timerRef.current);
  setSimulacionActiva(false);
    try {
      // Simulación aleatoria: repartir una cantidad significativa por caja
      // Usar basePerCaja para determinar clientes por caja y aplicar multiplicador
      const multSim = computeEffectiveMultiplier(selectedDay, selectedHour);

      const crearClienteLocal = (idx, agregado = false, esRojo = false) => ({
        nombre: esRojo ? `Cliente Rojo` : `Cliente_${idx+1}`,
        articulos: esRojo ? Math.floor(8 + Math.random() * 8) : Math.floor(10 + Math.random() * 6),
        metodo_pago: ['Efectivo','Tarjeta','Transferencia'][Math.floor(Math.random()*3)],
        tiempo_estimado: null,
        es_rojo: !!esRojo,
        agregado_por_demanda: agregado,
        paciencia: Math.floor(120 + Math.random() * (360 - 120 + 1)),
        precio_total: Math.round(Array.from({ length: (esRojo ? Math.floor(8 + Math.random() * 8) : Math.floor(10 + Math.random() * 6)) }).reduce((s) => s + (Math.random() * (150 - 5) + 5), 0) * 100) / 100,
        abandono: false,
        tiempo_en_fila: 0
      });

      // Reiniciar estado de atención y contadores para la nueva simulación
      const cajasCopy = [...cajas].map(c => ({ 
        ...c, 
        clientes_en_fila: [...(c.clientes_en_fila||[])], 
        cliente_actual: null,
        tiempo_restante_cliente_actual: 0,
        clientes_atendidos: [],
        perdida_total: 0,
        clientes_perdidos: [],
        cajero: { ...(c.cajero || {}), horas_trabajadas: 0 }
      }));
      const cajaExpressCopy = cajaExpress ? { 
        ...cajaExpress, 
        clientes_en_fila: [...(cajaExpress.clientes_en_fila||[])], 
        cliente_actual: null,
        tiempo_restante_cliente_actual: 0,
        clientes_atendidos: [],
        perdida_total: 0,
        clientes_perdidos: [],
        cajero: { ...(cajaExpress.cajero || {}), horas_trabajadas: 0 }
      } : null;

      // Generar nuevos previews aleatorios (1..12h) y persistir en localStorage cada vez que iniciamos
      try {
        for (const c of cajasCopy) {
          if (!c || !c.cajero) continue;
          const ph = (1 + Math.floor(Math.random() * 12)) * 3600;
          c.cajero.preview_horas_trabajadas_seconds = ph;
          try { window.localStorage.setItem(`preview_horas_${(c.nombre||'').replace(/\s+/g,'_')}`, String(ph)); } catch (e) { void e; }
        }
        if (cajaExpressCopy && cajaExpressCopy.cajero) {
          const phE = (1 + Math.floor(Math.random() * 12)) * 3600;
          cajaExpressCopy.cajero.preview_horas_trabajadas_seconds = phE;
          try { window.localStorage.setItem(`preview_horas_${(cajaExpressCopy.nombre||'').replace(/\s+/g,'_')}`, String(phE)); } catch (e) { void e; }
        }
      } catch (e) { void e; }

      // Si no existen previewBases para las cajas actuales, generarlas ahora para asegurar variabilidad aleatoria
      try {
        const names = [...(cajasCopy || []).map(c => c.nombre), cajaExpressCopy ? cajaExpressCopy.nombre : null].filter(Boolean);
        const missing = names.filter(n => !previewBases || previewBases[n] === undefined);
        if (missing.length > 0) {
          const map = { ...(previewBases || {}) };
          const minBase = Math.max(1, BASE_PER_CAJA - 4);
          for (const name of missing) {
            map[name] = minBase + Math.floor(Math.random() * 11); // rango: BASE-4 .. BASE+6
          }
          setPreviewBases(map);
        }
      } catch (e) {
        void e;
        // silencioso
      }

      // Para cada caja disponible, calcular cantidad ajustada y añadir esos clientes
      const disponiblesParaDistribuir = [...cajasCopy.filter(c => !c.descansando)];
      if (cajaExpressCopy && !cajaExpressCopy.descansando) disponiblesParaDistribuir.push(cajaExpressCopy);

      for (let i = 0; i < disponiblesParaDistribuir.length; i++) {
        const dest = disponiblesParaDistribuir[i];
        // Determinar la base a usar: input manual > previewBases > BASE_PER_CAJA
        const manualBaseRaw = Number.parseInt(clientesPorCaja[dest.nombre] || '', 10);
        const manualBase = (!Number.isNaN(manualBaseRaw) && manualBaseRaw > 0) ? manualBaseRaw : null;
        const base = manualBase || (previewBases[dest.nombre] || BASE_PER_CAJA);
        const expected = Math.max(0, Math.round(base * multSim));
        const extras = Math.max(0, expected - base);
        // Añadir clientes base (no marcados como agregados por demanda)
        for (let k = 0; k < base; k++) {
          const cliente = crearClienteLocal(k, false, false);
          dest.clientes_en_fila.push(cliente);
        }
        // Añadir sólo las unidades extra marcadas como agregadas por demanda
        for (let k = 0; k < extras; k++) {
          const clienteExtra = crearClienteLocal(k, true, false);
          dest.clientes_en_fila.push(clienteExtra);
        }
      }

      // Añadir Cliente Rojo al final de cada caja disponible (según petición del usuario)
      for (const dest of disponiblesParaDistribuir) {
        dest.clientes_en_fila.push(crearClienteLocal(0, false, true));
      }
      // Asegurar que Cliente Rojo quede al final de cada cola
      ensureRojoAtEndForAll(cajasCopy, cajaExpressCopy);
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
    } catch (e) {
      void e;
      alert('Error al conectar con el backend');
      setEnAnimacion(false);
    }
    setSimulando(false);
  };

  /* Ejemplo eliminado */

  // Generar bases aleatorias por caja para preview cuando no hay input manual
  useEffect(() => {
    try {
      const names = [(cajas || []).map(c => c.nombre), cajaExpress ? [cajaExpress.nombre] : []].flat().filter(Boolean);
      const map = {};
      for (const name of names) {
        const minBase = Math.max(1, BASE_PER_CAJA - 4);
        const variability = Math.floor(Math.random() * 11); // 0..10
        map[name] = minBase + variability; // rango: BASE-4 .. BASE+6..+? (ajustable)
      }
      setPreviewBases(map);
    } catch (e) {
      void e;
      // silencioso
    }
  }, [cajas, cajaExpress, selectedDay, selectedHour]);

  // Nota: la interfaz ya no expone panel para enviar/obtener configuración al backend.

  useEffect(() => {
    if (!enAnimacion) return;
    timerRef.current = setInterval(() => {
      const pasos = modoRapido ? 10 : 1; // velocidad lógica

      // 1) Avanzar la atención (lógica) 'pasos' segundos: acelerar servicio y horas trabajadas
      for (let p = 0; p < pasos; p++) {
        setCajas(prev => {
          const copia = prev.map(c => ({ ...c, clientes_en_fila: [...c.clientes_en_fila], clientes_atendidos: [...c.clientes_atendidos], perdida_total: c.perdida_total || 0, clientes_perdidos: c.clientes_perdidos || [] }));
          for (const caja of copia) {
            if (!caja.cliente_actual) {
              if (caja.clientes_en_fila.length > 0 && !caja.descansando) {
                const siguiente = caja.clientes_en_fila.shift();
                siguiente.tiempo_estimado = calcularTiempoAtencion(siguiente, caja.cajero.multiplicador);
                caja.cliente_actual = siguiente;
                caja.tiempo_restante_cliente_actual = siguiente.tiempo_estimado;
              }
            } else {
              caja.tiempo_restante_cliente_actual -= 1; // avanzar 1s lógico por paso
              caja.cajero.horas_trabajadas += 1; // acumular segundo lógico
              if (caja.tiempo_restante_cliente_actual <= 0) {
                caja.clientes_atendidos.push(caja.cliente_actual);
                caja.cliente_actual = null;
                caja.tiempo_restante_cliente_actual = 0;
              }
            }
          }
          return copia;
        });

        setCajaExpress(prev => {
          if (!prev) return prev;
          const copia = { ...prev, clientes_en_fila: [...prev.clientes_en_fila], clientes_atendidos: [...prev.clientes_atendidos], perdida_total: prev.perdida_total || 0, clientes_perdidos: prev.clientes_perdidos || [] };
          if (!copia.cliente_actual) {
            if (copia.clientes_en_fila.length > 0 && !copia.descansando) {
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
      }

      // 2) Actualizar tiempo en fila (solo 1s por tick para que visual sea apreciable) y procesar abandonos de última posición
      setCajas(prev => {
        const copia = prev.map(c => ({ ...c, clientes_en_fila: [...c.clientes_en_fila], perdida_total: c.perdida_total || 0, clientes_perdidos: c.clientes_perdidos || [] }));
        for (const caja of copia) {
          try {
            const nuevaFila = [...caja.clientes_en_fila];
            for (let idx = nuevaFila.length - 1; idx >= 0; idx--) {
              const cl = nuevaFila[idx];
              // incrementar sólo 1s por tick para visual
              cl.tiempo_en_fila = (cl.tiempo_en_fila || 0) + 1;

              // Si ya está marcado para remover, decrementar y eliminar cuando llegue a 0
              if (cl.abandono && typeof cl._removerCountdown === 'number') {
                cl._removerCountdown = Math.max(0, cl._removerCountdown - 1);
                if (cl._removerCountdown === 0) {
                  caja.perdida_total = (caja.perdida_total || 0) + (cl.precio_total || 0);
                  caja.clientes_perdidos = caja.clientes_perdidos || [];
                  caja.clientes_perdidos.push(cl);
                  nuevaFila.splice(idx, 1);
                  continue;
                }
                continue;
              }

              // Sólo la última posición puede abandonar: lo hace tras 200s en fila.
              const esUltimo = (idx === nuevaFila.length - 1);
                if (esUltimo) {
                  // Abandono ahora basado en la paciencia individual del cliente
                  const paciencia = (cl.paciencia || 200);
                  if ((cl.tiempo_en_fila || 0) >= paciencia) {
                    cl.abandono = true;
                    cl._removerCountdown = modoRapido ? 6 : 2; // mostrar borde azul más tiempo en modo rápido
                    continue;
                  }
                }
            }
            caja.clientes_en_fila = nuevaFila;
          } catch (e) {
            void e;
            // ignorar errores
          }
        }
        return copia;
      });

      setCajaExpress(prev => {
        if (!prev) return prev;
        const copia = { ...prev, clientes_en_fila: [...prev.clientes_en_fila], perdida_total: prev.perdida_total || 0, clientes_perdidos: prev.clientes_perdidos || [] };
        try {
          const nuevaFila = [...copia.clientes_en_fila];
          for (let idx = nuevaFila.length - 1; idx >= 0; idx--) {
            const cl = nuevaFila[idx];
            cl.tiempo_en_fila = (cl.tiempo_en_fila || 0) + 1;
            if (cl.abandono && typeof cl._removerCountdown === 'number') {
              cl._removerCountdown = Math.max(0, cl._removerCountdown - 1);
              if (cl._removerCountdown === 0) {
                copia.perdida_total = (copia.perdida_total || 0) + (cl.precio_total || 0);
                copia.clientes_perdidos = copia.clientes_perdidos || [];
                copia.clientes_perdidos.push(cl);
                nuevaFila.splice(idx, 1);
                continue;
              }
              continue;
            }
            const esUltimoE = (idx === nuevaFila.length - 1);
            if (esUltimoE) {
              const pacienciaE = (cl.paciencia || 200);
              if ((cl.tiempo_en_fila || 0) >= pacienciaE) {
                cl.abandono = true;
                cl._removerCountdown = modoRapido ? 6 : 2;
                continue;
              }
            }
          }
          copia.clientes_en_fila = nuevaFila;
        } catch (e) {
          void e;
          // ignore
        }
        return copia;
      });

      // Registro de utilización
      const currentCajas = cajasRef.current || [];
      let servidores = (currentCajas ? currentCajas.length : 0) + (cajaExpressRef.current ? 1 : 0);
      servidores = Math.max(1, servidores);
      let ocupados = 0;
      const allCajas = [...(cajasRef.current || []), cajaExpressRef.current].filter(Boolean);
      for (const c of allCajas) {
        if (c.cliente_actual || (c.clientes_en_fila && c.clientes_en_fila.length > 0)) ocupados += 1;
      }
      const rhoActual = ocupados / servidores;
      utilizacionRegistroRef.current.push(rhoActual);
      if (utilizacionRegistroRef.current.length > rhoPeriodo) utilizacionRegistroRef.current.shift();

      // Actualizar estadoAnimado y tiempo
      // Usamos setTimeout(,0) para dejar que React actualice `cajasRef.current`/`cajaExpressRef` antes de clonar
      setTimeout(() => {
        const all = [...(cajasRef.current || []), cajaExpressRef.current].filter(Boolean);
        setEstadoAnimado(all.map(caja => ({
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
        })));
      }, 0);
      setTiempo(t => t + 1);
    }, modoRapido ? 200 : 1000);
    return () => clearInterval(timerRef.current);
  }, [enAnimacion, modoRapido, cajas.length, cajaExpress]);

  

  // Render animación si está activa
  const mostrarAnimacion = enAnimacion && estadoAnimado.length > 0;
  // Lista global de abandonos para mostrar en la UI
  const abandonos = obtenerAbandonosGlobal();

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
          {/* Botón de ejemplo eliminado */}
        <button onClick={handleIniciarManual} disabled={simulando || enAnimacion} style={{fontSize: '1.2em', padding: '12px 32px', borderRadius: '8px', background: '#28a745', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '1px 1px 8px #111', fontWeight: 'bold', letterSpacing: '1px'}}>
          Iniciar simulación (manual)
        </button>
        {cajas.length < 6 && (
          <button
            onClick={() => {
              // Agregar caja manualmente en frontend y rebalancear la mitad de la cola más larga
              const nueva = {
                nombre: `Caja ${cajas.length + 1}`,
                cajero: { experiencia: 'Normal', experiencia_raw: 2, multiplicador: 1.0, horas_trabajadas: 0, preview_horas_trabajadas_seconds: (1 + Math.floor(Math.random() * 12)) * 3600, sueldo_base: 400 },
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
            }}
            style={{fontSize: '1.1em', padding: '12px 24px', borderRadius: '8px', background: '#ff8c00', color: '#fff', border: 'none', cursor: 'pointer'}}
          >
            Agregar caja
          </button>
        )}
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
        <select value={selectedHour} onChange={e => handleSelectHour(Number(e.target.value))} style={{padding:6, borderRadius:6}}>
          {Array.from({length:13}, (_,i)=>i+8).map(h => <option key={h} value={h}>{h}</option>)}
        </select>
      </div>
      {/* Panel de configuración eliminado por petición del usuario */}
      <div style={{marginBottom: 12, color: '#fff', display: 'flex', gap: 16, alignItems: 'center'}}>
        <div style={{background: '#181b22', padding: '8px 12px', borderRadius: 8}}>
          Costo total estimado: <b>{(enAnimacion || simulacionActiva) ? (costoTotal.toFixed ? costoTotal.toFixed(2) : costoTotal) : (lastCostoTotal.toFixed ? lastCostoTotal.toFixed(2) : lastCostoTotal)}</b>
        </div>
        <div style={{background: '#181b22', padding: '8px 12px', borderRadius: 8}}>Cajas en servicio: <b>{numCajasEnServicio}</b></div>
      </div>
      {/* (Cost table moved below the cajas) */}
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
                articulosRojo={(caja.cliente_rojo && caja.cliente_rojo.articulos) ? caja.cliente_rojo.articulos : 0}
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
                articulosRojo={(cajaExpress.cliente_rojo && cajaExpress.cliente_rojo.articulos) ? cajaExpress.cliente_rojo.articulos : 0}
              />
            </div>
          )
        ]) : (
          <>
            {cajas.map((caja, i) => {
              // calcular extras previstos por caja comparando lo esperado vs cola actual
              const multUI = computeEffectiveMultiplier(selectedDay, selectedHour);
              // si hay un input manual, usarlo como base para esa caja
              const baseInput = Number.parseInt(clientesPorCaja[caja.nombre] || '', 10);
              const baseForThis = !Number.isNaN(baseInput) && baseInput > 0 ? baseInput : (previewBases[caja.nombre] || BASE_PER_CAJA);
              const expected = Math.max(0, Math.round(baseForThis * multUI));
              const currentLen = (caja.clientes_en_fila || []).length;
              const extrasPorCaja = Math.max(0, expected - currentLen);
              // quitar fondo verde por completo; mantener transparente
              const highlightBg = 'transparent';
              const borderStyle = caja.descansando ? '2px solid #ff5555' : '1px solid transparent';
              return (
                <div key={i} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', background: highlightBg, padding: 6, borderRadius: 8, border: borderStyle}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                    <Caja
                      nombre={caja.nombre}
                      clientes={caja.clientes_en_fila || []}
                      esExpress={caja.nombre.toLowerCase().includes('express')}
                      cajero={caja.cajero}
                    />
                    {extrasPorCaja > 0 && !caja.descansando && (
                      <div style={{background: '#2ecc71', color: '#052', fontWeight: 'bold', padding: '6px 8px', borderRadius: 10, fontSize: '0.9em'}}>
                        +{extrasPorCaja}
                      </div>
                    )}
                  </div>
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
                    <div style={{padding: '6px 10px', borderRadius: 8, fontWeight:'bold', color: caja.descansando ? '#ffbaba' : '#baffc9', background: caja.descansando ? '#33111144' : 'transparent'}}>
                      {caja.descansando ? 'Descansando' : 'Disponible'}
                    </div>
                  </div>
                </div>
              );
            })}
            {cajaExpress && (
              <div key={cajas.length} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', border: cajaExpress.descansando ? '2px solid #ff5555' : '1px solid transparent', padding: 6, borderRadius: 8}}>
                <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                  <Caja
                    nombre={cajaExpress.nombre}
                    clientes={cajaExpress.clientes_en_fila || []}
                    esExpress={true}
                    cajero={cajaExpress.cajero}
                  />
                  {(() => {
                    const multUI_E = computeEffectiveMultiplier(selectedDay, selectedHour);
                    const baseInputE = Number.parseInt(clientesPorCaja[cajaExpress.nombre] || '', 10);
                    const baseForExpress = !Number.isNaN(baseInputE) && baseInputE > 0 ? baseInputE : (previewBases[cajaExpress.nombre] || BASE_PER_CAJA);
                    const expectedE = Math.max(0, Math.round(baseForExpress * multUI_E));
                    const currentLenE = (cajaExpress.clientes_en_fila || []).length;
                    const extrasExpress = Math.max(0, expectedE - currentLenE);
                    return (extrasExpress > 0 && !cajaExpress.descansando) ? (
                      <div style={{background: '#2ecc71', color: '#052', fontWeight: 'bold', padding: '6px 8px', borderRadius: 10, fontSize: '0.9em'}}>
                        +{extrasExpress}
                      </div>
                    ) : null;
                  })()}
                </div>
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
                  <div style={{padding: '6px 10px', borderRadius: 8, fontWeight:'bold', color: cajaExpress.descansando ? '#ffbaba' : '#baffc9', background: cajaExpress.descansando ? '#33111144' : 'transparent'}}>
                    {cajaExpress.descansando ? 'Descansando' : 'Disponible'}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      

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
      {/* Tabla solicitada: número de clientes atendidos, horas trabajadas y total (fórmula del usuario) - centrada y más abajo */}
      <div style={{width: '100%', display: 'flex', justifyContent: 'center', marginTop: 56, marginBottom: 56}}>
        <div style={{width: '86%', maxWidth: 980}}>
          {cajaSeleccionada && (
            <div style={{color:'#1e90ff', marginBottom:8, fontWeight:'bold', textAlign: 'center'}}>Caja seleccionada: {cajaSeleccionada}</div>
          )}
          <table style={{width: '100%', borderCollapse: 'collapse', color: '#fff'}}>
            <thead>
              <tr style={{textAlign: 'left', borderBottom: '1px solid #333'}}>
                <th style={{padding: 6}}>Caja</th>
                <th style={{padding: 6}}>Clientes atendidos</th>
                <th style={{padding: 6}}>Horas trabajadas</th>
                <th style={{padding: 6}}>Total</th>
                <th style={{padding: 6}}>Pérdidas</th>
                <th style={{padding: 6}}>Clientes perdidos</th>
                  <th style={{padding: 6}}>Lista abandonos</th>
              </tr>
            </thead>
            <tbody>
              {calcularTablaSalarios().map((r, i) => (
                <tr
                  key={i}
                  onClick={() => setCajaSeleccionada(r.nombre)}
                  style={{
                    borderBottom: '1px solid #222',
                    cursor: 'pointer',
                    background: cajaSeleccionada === r.nombre ? '#1e90ff22' : 'transparent'
                  }}
                >
                  <td style={{padding: 6}}>{r.nombre}</td>
                  <td style={{padding: 6, textAlign: 'center'}}>{r.clientesAtendidos}</td>
                  <td style={{padding: 6, textAlign: 'center'}}>
                    {Number.isFinite(r.horasTrab) ? r.horasTrab : (r.horasTrab)}
                  </td>
                  <td style={{padding: 6, textAlign: 'right'}}>{r.total.toFixed(2)}</td>
                  <td style={{padding: 6, textAlign: 'right', color: '#ffbaba'}}>${(r.perdidaTotal || 0).toFixed(2)}</td>
                  <td style={{padding: 6, textAlign: 'center', color: '#ffbaba'}}>{r.clientesPerdidos || 0}</td>
                  <td style={{padding: 6, textAlign: 'left', color: '#bfe6ff', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}} title={r.listaAbandonos}>{r.listaAbandonos || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Panel: listado de clientes que abandonaron */}
          <div style={{marginTop: 18, background: '#0f1720', padding: 12, borderRadius: 8, color: '#fff'}}>
            <h3 style={{margin: '6px 0 10px 0', color: '#1e90ff'}}>Clientes que abandonaron</h3>
            {abandonos.length === 0 ? (
              <div style={{color: '#bbb'}}>No hay abandonos.</div>
            ) : (
              <div style={{maxHeight: 180, overflowY: 'auto'}}>
                <table style={{width: '100%', borderCollapse: 'collapse'}}>
                  <thead>
                    <tr style={{textAlign: 'left', borderBottom: '1px solid #233'}}>
                      <th style={{padding: 6}}>Caja</th>
                      <th style={{padding: 6}}>Cliente</th>
                      <th style={{padding: 6}}>Tiempo en fila (s)</th>
                      <th style={{padding: 6}}>Precio</th>
                      <th style={{padding: 6}}>Extra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {abandonos.map((a, idx) => (
                      <tr key={idx} style={{borderBottom: '1px solid #111'}}>
                        <td style={{padding: 6}}>{a.caja}</td>
                        <td style={{padding: 6}}>{a.nombre}</td>
                        <td style={{padding: 6}}>{a.tiempo_en_fila}</td>
                        <td style={{padding: 6, textAlign: 'right'}}>${a.precio_total.toFixed ? a.precio_total.toFixed(2) : a.precio_total}</td>
                        <td style={{padding: 6}}>{a.agregado_por_demanda ? 'Sí' : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{marginTop: 8, textAlign: 'right'}}>
              <button onClick={() => {
                setCajas(prev => prev.map(c => ({ ...c, clientes_perdidos: [], perdida_total: 0 })));
                if (cajaExpress) setCajaExpress(prev => prev ? ({ ...prev, clientes_perdidos: [], perdida_total: 0 }) : prev);
              }} style={{padding: '6px 10px', borderRadius: 6, background: '#ff5555', color: '#fff', border: 'none', marginRight: 8}}>Limpiar lista</button>
              <button onClick={() => {
                // Forzar un abandono de demo: mover el último cliente de la primera caja con clientes a clientes_perdidos
                let done = false;
                setCajas(prev => {
                  const copia = prev.map(c => ({ ...c, clientes_en_fila: [...(c.clientes_en_fila||[])], clientes_perdidos: c.clientes_perdidos || [], perdida_total: c.perdida_total || 0 }));
                  for (const caja of copia) {
                    if (!done && caja.clientes_en_fila && caja.clientes_en_fila.length > 0) {
                      const idx = caja.clientes_en_fila.length - 1;
                      const cl = caja.clientes_en_fila[idx];
                      // marcar como perdido y mover
                      caja.clientes_perdidos = caja.clientes_perdidos || [];
                      caja.clientes_perdidos.push(cl);
                      caja.perdida_total = (caja.perdida_total || 0) + (cl.precio_total || 0);
                      caja.clientes_en_fila.splice(idx, 1);
                      done = true;
                      break;
                    }
                  }
                  return copia;
                });
                if (!done && cajaExpress) {
                  setCajaExpress(prev => {
                    if (!prev) return prev;
                    if (prev.clientes_en_fila && prev.clientes_en_fila.length > 0) {
                      const copia = { ...prev, clientes_en_fila: [...prev.clientes_en_fila], clientes_perdidos: prev.clientes_perdidos || [], perdida_total: prev.perdida_total || 0 };
                      const idx = copia.clientes_en_fila.length - 1;
                      const cl = copia.clientes_en_fila[idx];
                      copia.clientes_perdidos.push(cl);
                      copia.perdida_total = (copia.perdida_total || 0) + (cl.precio_total || 0);
                      copia.clientes_en_fila.splice(idx, 1);
                      return copia;
                    }
                    return prev;
                  });
                }
              }} style={{padding: '6px 10px', borderRadius: 6, background: '#1e90ff', color: '#fff', border: 'none'}}>Forzar abandono (demo)</button>
            </div>
          </div>
        </div>
      </div>
      </div>
  );
}
export default App;
