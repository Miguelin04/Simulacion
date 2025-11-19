# importaciones necesarias
#-------------------------------------
from cajero import Cajero
from cliente import Cliente
#-------------------------------------


class Caja:
    #Constructor de la clase
    def __init__(self, num_clientes, nombre=None):
        self.cajero = Cajero()
        self.clientes_en_fila = []
        for i in range(num_clientes):
            cliente = Cliente(f"Cliente_{i+1}")
            cliente.crear_lista_articulos()
            cliente.seleccionar_tipo_pago()
            self.clientes_en_fila.append(cliente)
        self.cliente_actual = None 
        self.tiempo_restante_cliente_actual = 0
        self.clientes_atendidos = []
        self.nombre = nombre if nombre else ""
        # Pérdidas por abandonos en esta caja (moneda local)
        self.perdida_total = 0.0
        # Lista de clientes que abandonaron
        self.clientes_perdidos = []


    #Con este método juego con el contenido del arreglo
    def actualizar_simulacion_un_segundo(self):
        # Antes de avanzar, evaluar abandonos en la fila (clientes que esperan demasiado)
        try:
            nueva_fila = []
            tiempo_ahead = self.tiempo_restante_cliente_actual if self.cliente_actual else 0
            for cliente in list(self.clientes_en_fila):
                # estimar tiempo de atención de ese cliente
                tiempo_cliente = cliente.calcular_tiempo_atencion(
                    self.cajero.multiplicador_velocidad,
                    experiencia_cajero=self.cajero.experiencia,
                    metodo_pago=cliente.metodo_pago
                )
                # si la espera estimada excede 240s (4min) o la paciencia del cliente, abandona
                if tiempo_ahead > 240 or tiempo_ahead > getattr(cliente, 'paciencia', 99999):
                    perdida = cliente.calcular_perdida()
                    self.perdida_total += perdida
                    cliente.abandono = True
                    self.clientes_perdidos.append(cliente)
                    # no lo añadimos a nueva_fila (se marcha)
                    continue
                # si no abandona, queda en la nueva fila y acumulamos su tiempo
                nueva_fila.append(cliente)
                tiempo_ahead += tiempo_cliente
            # reemplazar la fila por la nueva sin los que abandonaron
            self.clientes_en_fila = nueva_fila
        except Exception:
            # si algo falla en la evaluación de abandonos, continuar con la lógica normal
            pass

        if self.cliente_actual is None:
            if self.clientes_en_fila:
                # Tomar el siguiente cliente de la fila y calcular su tiempo
                self.cliente_actual = self.clientes_en_fila.pop(0)
                multiplicador = self.cajero.multiplicador_velocidad
                # Pasar información adicional (experiencia del cajero y método de pago)
                self.tiempo_restante_cliente_actual = self.cliente_actual.calcular_tiempo_atencion(
                    multiplicador,
                    experiencia_cajero=self.cajero.experiencia,
                    metodo_pago=self.cliente_actual.metodo_pago
                )
        else:
            # Avanza 1 segundo de atención
            self.tiempo_restante_cliente_actual -= 1
            # Acumular 1 segundo en las horas trabajadas del cajero
            try:
                # horas_trabajadas se almacena en segundos
                self.cajero.horas_trabajadas += 1
            except Exception:
                # En caso de que el cajero no tenga el atributo (compatibilidad), lo ignoramos
                pass
            # Si el cliente terminó, mover a atendidos y liberar la caja
            if self.tiempo_restante_cliente_actual <= 0:
                # Al terminar, guardamos el tiempo total estimado en el cliente (compatibilidad)
                # si aún no fue asignado. Esto permite reportes posteriores.
                if getattr(self.cliente_actual, 'tiempo_total_atencion', None) is None:
                    self.cliente_actual.tiempo_total_atencion = 0
                self.clientes_atendidos.append(self.cliente_actual)
                self.cliente_actual = None
    

    
    def simulacion_terminada(self):
        return not self.clientes_en_fila and not self.cliente_actual