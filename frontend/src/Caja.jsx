import React from 'react';
import './Caja.css';


function Caja({ nombre, clientes, esExpress, esMejor, cajero, animando, atendidos = [], tiempoRestante }) {
  // Si está animando, solo mostrar los clientes que aún no han sido atendidos
  const clientesEnFila = animando ? clientes : clientes;
  const atendidosCount = animando ? atendidos.length : 0;
  // Mostrar el cliente que está siendo atendido con el tiempo restante
  return (
    <div className={`caja ${esExpress ? 'express' : ''} ${esMejor ? 'mejor' : ''}`}>
      <h2>
        {nombre} {esExpress && <span className="express-label">Express</span>}
        {esMejor && <span className="mejor-label">Mejor opción</span>}
      </h2>
      <div className="cajero-info">
        <span className="icono-cajero" role="img" aria-label="cajero">🧑‍💼</span>
        <span className="cajero-txt">Cajero: <b>{cajero?.experiencia}</b> <span style={{fontSize:'0.9em', color:'#888'}}>({cajero?.multiplicador}x)</span></span>
      </div>
      <div className="clientes-lista">
        {clientesEnFila.map((cliente, idx) => {
          // Si está animando, solo mostrar los que no han sido atendidos
          if (animando && idx < atendidosCount) return null;
          // Si está animando y es el primero, mostrar el tiempoRestante
          const mostrarTiempo = animando && idx === atendidosCount && typeof tiempoRestante === 'number';
          return (
            <div
              key={idx}
              className={`cliente ${cliente.es_rojo ? 'rojo' : ''}`}
            >
              <span className="icono-persona" role="img" aria-label="persona">🧑</span>
              <span className="nombre-cliente">{cliente.nombre}</span>
              <span className="articulos">({cliente.articulos} art)</span>
              <span className="tiempo-rojo">⏱ {mostrarTiempo ? tiempoRestante : cliente.tiempo_estimado}s</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Caja;
