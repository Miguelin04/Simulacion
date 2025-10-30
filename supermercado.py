from Caja import Caja
from cliente import Cliente
import random

class Supermercado:
    def asignar_clientes_random(self, num_clientes):
        # Asignar clientes de forma aleatoria respetando la lógica de la caja express
        from cajero import Cajero
        for i in range(num_clientes):
            cliente = Cliente(f"Cliente_{i+1}")
            cliente.crear_lista_articulos()
            cliente.seleccionar_tipo_pago()
            self.todos_los_clientes.append(cliente)
            # Solo puede ir a la express si tiene <=10 artículos y el cajero es Experto o Normal
            puede_express = cliente.num_articulos <= 10 and self.caja_express.cajero.experiencia in [2,3]
            if puede_express:
                self.caja_express.clientes_en_fila.append(cliente)
                # También puede ir a una caja normal (simulación: asignar aleatoriamente)
                random.choice(self.cajas).clientes_en_fila.append(cliente)
            else:
                # Solo puede ir a una caja normal
                random.choice(self.cajas).clientes_en_fila.append(cliente)
    def __init__(self, num_clientes, num_cajas=3):
        self.cajas = [Caja(0) for _ in range(num_cajas)]  # Cajas normales
        # Crear caja express solo con cajero Normal o Experto
        from cajero import Cajero
        cajero_express = Cajero()
        while cajero_express.experiencia == 1:  
            cajero_express = Cajero()
        self.caja_express = Caja(0)
        self.caja_express.cajero = cajero_express
        self.todos_los_clientes = []
        # No asignar clientes al crear la simulación, solo cajas vacías

    def asignar_clientes(self, num_clientes):
        for i in range(num_clientes):
            cliente = Cliente(f"Cliente_{i+1}")
            cliente.crear_lista_articulos()
            cliente.seleccionar_tipo_pago()
            self.todos_los_clientes.append(cliente)
        # No asignar a ninguna caja aquí

    def actualizar_simulacion_un_segundo(self):
        for caja in self.cajas:
            caja.actualizar_simulacion_un_segundo()
        self.caja_express.actualizar_simulacion_un_segundo()

    def simulacion_terminada(self):
        return all(caja.simulacion_terminada() for caja in self.cajas) and self.caja_express.simulacion_terminada()

    def obtener_estado(self):
        # Simular un cliente rojo (especial) con artículos aleatorios
        cliente_rojo_articulos = random.randint(1, 15)
        tiempos_rojo = []
        cajas_estado = []
        for idx, caja in enumerate(self.cajas):
            estado, tiempo_rojo = self._estado_caja(caja, idx+1, cliente_rojo_articulos)
            cajas_estado.append(estado)
            tiempos_rojo.append((f"Caja {idx+1}", tiempo_rojo))
        estado_express, tiempo_rojo_express = self._estado_caja(self.caja_express, 'Express', min(cliente_rojo_articulos, 10))
        tiempos_rojo.append(("Caja Express", tiempo_rojo_express))
        resumen = self._comparar_tiempos_rojo(tiempos_rojo)
        return {
            'cajas': cajas_estado,
            'caja_express': estado_express,
            'cliente_rojo_articulos': cliente_rojo_articulos,
            'resumen_comparacion': resumen
        }

    def _estado_caja(self, caja, nombre, articulos_rojo):
        # Calcular tiempo de atención estimado para cada cliente en la fila
        fila = caja.clientes_en_fila + ([caja.cliente_actual] if caja.cliente_actual else [])
        tiempo_acumulado = 0
        clientes_fila = []
        for cliente in fila:
            if cliente:
                tiempo_cliente = cliente.calcular_tiempo_atencion(
                    caja.cajero.multiplicador_velocidad,
                    experiencia_cajero=caja.cajero.experiencia,
                    metodo_pago=cliente.metodo_pago
                )
                tiempo_acumulado += tiempo_cliente
                clientes_fila.append({
                    'nombre': cliente.nombre,
                    'articulos': cliente.num_articulos,
                    'tiempo_estimado': tiempo_cliente
                })
        # Cliente rojo
        cliente_rojo = Cliente("Cliente Rojo")
        cliente_rojo.num_articulos = articulos_rojo
        cliente_rojo.crear_lista_articulos()
        cliente_rojo.metodo_pago = "Efectivo"
        tiempo_rojo = cliente_rojo.calcular_tiempo_atencion(
            caja.cajero.multiplicador_velocidad,
            experiencia_cajero=caja.cajero.experiencia,
            metodo_pago=cliente_rojo.metodo_pago
        )
        tiempo_total = tiempo_acumulado + tiempo_rojo
        clientes_fila.append({
            'nombre': cliente_rojo.nombre,
            'articulos': cliente_rojo.num_articulos,
            'tiempo_estimado': tiempo_rojo,
            'es_rojo': True
        })
        return {
            'nombre': f"Caja {nombre}",
            'cajero': {
                'experiencia': self._exp_to_str(caja.cajero.experiencia),
                'multiplicador': caja.cajero.multiplicador_velocidad
            },
            'en_fila': clientes_fila,
            'atendiendo': {'nombre': caja.cliente_actual.nombre, 'articulos': caja.cliente_actual.num_articulos} if caja.cliente_actual else None,
            'atendidos': [
                {'nombre': c.nombre, 'articulos': c.num_articulos} for c in caja.clientes_atendidos
            ],
            'cliente_rojo': {
                'articulos': articulos_rojo,
                'tiempo_estimado': tiempo_total
            }
        }, tiempo_total

    def _exp_to_str(self, exp):
        if exp == 1:
            return 'Principiante'
        elif exp == 2:
            return 'Normal'
        else:
            return 'Experto'

    def _comparar_tiempos_rojo(self, tiempos):
        # tiempos: lista de (nombre_caja, tiempo)
        tiempos_ordenados = sorted(tiempos, key=lambda x: x[1])
        mejor = tiempos_ordenados[0]
        resumen = f"La mejor caja para el cliente rojo es {mejor[0]} con {mejor[1]}s.\n"
        resumen += "Comparación de tiempos: "
        resumen += ", ".join([f"{nombre}: {tiempo}s" for nombre, tiempo in tiempos])
        return resumen
