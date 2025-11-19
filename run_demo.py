from supermercado import Supermercado

# Crear supermercado con 3 cajas normales (por defecto)
s = Supermercado(num_clientes=0, num_cajas=3)
# Asignar una cantidad aleatoria de clientes para la simulación
s.asignar_clientes_random(40)

# Ejecutar la simulación durante N segundos para avanzar la atención y permitir abandonos
for t in range(600):
    s.actualizar_simulacion_un_segundo()

# Mostrar resumen por caja
print('\n=== Resumen por Caja ===')
for caja in s.cajas + [s.caja_express]:
    nombre = caja.nombre
    perdidas = getattr(caja, 'perdida_total', 0.0)
    perdidos_cnt = len(getattr(caja, 'clientes_perdidos', []))
    atendidos = len(getattr(caja, 'clientes_atendidos', []))
    en_fila = len(getattr(caja, 'clientes_en_fila', []))
    print(f"{nombre}: perdidas={perdidas:.2f}, clientes_perdidos={perdidos_cnt}, atendidos={atendidos}, en_fila={en_fila}")

print('\nCosto total (incluye perdidas):', s.calcular_costo_total())
print('Perdidas totales:', sum(getattr(c, 'perdida_total', 0.0) for c in s.cajas + [s.caja_express]))
print('Evaluar abrir caja (costo_apertura=200, penal=50):', s.evaluar_abrir_por_perdida(200, 50))
