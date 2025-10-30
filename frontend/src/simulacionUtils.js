


// Utilidad para clonar profundamente un objeto/array
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function calcularTiempoAtencion(cliente, multiplicador = 1) {
  // Simula el tiempo de atención: cada artículo toma entre 2 y 5 segundos
  const tiempoArticulos = Array.from({ length: cliente.articulos }, () => 2 + Math.random() * 3)
    .reduce((a, b) => a + b, 0);
  // El cobro toma entre 5 y 10 segundos
  const tiempoCobro = 5 + Math.random() * 5;
  return Math.round((tiempoArticulos * multiplicador + tiempoCobro));
}
