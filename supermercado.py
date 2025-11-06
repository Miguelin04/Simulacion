from Caja import Caja
from cliente import Cliente
import random

class Supermercado:
   
    def asignar_clientes_a_express(self, num_clientes):
        print(f"Agregando {num_clientes} clientes a la caja express...")
        for i in range(num_clientes):
            cliente = Cliente(f"ClienteExpress_{i+1}")
            # Aseguramos que el cliente tenga al menos 10 artículos
            cliente.num_articulos = random.randint(10, 15)
            cliente.crear_lista_articulos()
            cliente.seleccionar_tipo_pago()
            self.todos_los_clientes.append(cliente)
            self.caja_express.clientes_en_fila.append(cliente)
            print(f"  - {cliente.nombre} con {cliente.num_articulos} artículos agregado a express")
        print(f"Total en express: {len(self.caja_express.clientes_en_fila)}")
        return len(self.caja_express.clientes_en_fila)
    
    def asignar_clientes_random(self, num_clientes):
        # Asignar clientes de forma aleatoria respetando la lógica de la caja express
        from cajero import Cajero
        for i in range(num_clientes):
            cliente = Cliente(f"Cliente_{i+1}")
            # Ya el mínimo es 10 por la clase Cliente
            cliente.crear_lista_articulos()
            cliente.seleccionar_tipo_pago()
            self.todos_los_clientes.append(cliente)
            # Solo puede ir a la express si tiene <=10 artículos y el cajero es Experto o Normal
            puede_express = cliente.num_articulos <= 10 and self.caja_express.cajero.experiencia in [2,3]
            # Pero como el mínimo es 10, solo clientes con 10 artículos pueden ir a express
            if puede_express:
                self.caja_express.clientes_en_fila.append(cliente)
            # Todos los clientes pueden ir a una caja normal
            random.choice(self.cajas).clientes_en_fila.append(cliente)
   
    def __init__(self, num_clientes, num_cajas=3):
        self.cajas = [Caja(0, nombre=f"Caja {i+1}") for i in range(num_cajas)]  # Cajas normales
        # Crear caja express solo con cajero Normal o Experto
        from cajero import Cajero
        cajero_express = Cajero()
        while cajero_express.experiencia == 1:  
            cajero_express = Cajero()
        self.caja_express = Caja(0, nombre="Caja Express")
        self.caja_express.cajero = cajero_express
        self.todos_los_clientes = []
        # Cliente rojo fijo para toda la simulación
        self.cliente_rojo = Cliente("Cliente Rojo")
        self.cliente_rojo.crear_lista_articulos()
        self.cliente_rojo.metodo_pago = "Efectivo"

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
        # Usar el cliente rojo fijo
        cliente_rojo_articulos = self.cliente_rojo.num_articulos
        tiempos_rojo = []
        cajas_estado = []
        for idx, caja in enumerate(self.cajas):
            estado, tiempo_rojo = self._estado_caja(caja, idx+1)
            cajas_estado.append(estado)
            tiempos_rojo.append((f"Caja {idx+1}", tiempo_rojo))
        estado_express, tiempo_rojo_express = self._estado_caja(self.caja_express, 'Express')
        tiempos_rojo.append(("Caja Express", tiempo_rojo_express))
        resumen = self._comparar_tiempos_rojo(tiempos_rojo)
        return {
            'cajas': cajas_estado,
            'caja_express': estado_express,
            'cliente_rojo_articulos': cliente_rojo_articulos,
            'resumen_comparacion': resumen
        }

    def _estado_caja(self, caja, nombre):
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
        # Usar el cliente rojo fijo
        cliente_rojo = self.cliente_rojo
        # Si es la caja express, limitar a 10 artículos
        if str(nombre).lower() == 'express' and cliente_rojo.num_articulos > 10:
            num_articulos_original = cliente_rojo.num_articulos
            cliente_rojo.num_articulos = 10
            cliente_rojo.crear_lista_articulos()
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
        # Restaurar el número de artículos si fue modificado
        if str(nombre).lower() == 'express' and hasattr(self.cliente_rojo, 'num_articulos') and 'num_articulos_original' in locals():
            self.cliente_rojo.num_articulos = num_articulos_original
            self.cliente_rojo.crear_lista_articulos()
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
                'articulos': clientes_fila[-1]['articulos'],
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
