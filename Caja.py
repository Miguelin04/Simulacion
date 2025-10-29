# importaciones necesarias
#-------------------------------------
from cajero import Cajero
from cliente import Cliente
#-------------------------------------

class Caja:

    #Constructor de la clase
    def __init__(self, num_clientes):
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


    #Con este método juego con el contenido del arreglo
    def actualizar_simulacion_un_segundo(self):
        if self.cliente_actual is None:
            if self.clientes_en_fila:
                self.cliente_actual = self.clientes_en_fila.pop(0)
                multiplicador = self.cajero.multiplicador_velocidad
                self.tiempo_restante_cliente_actual = self.cliente_actual.calcular_tiempo_atencion(multiplicador)
        else:
            self.tiempo_restante_cliente_actual -= 1
            if self.tiempo_restante_cliente_actual <= 0:
                self.clientes_atendidos.append(self.cliente_actual)
                self.cliente_actual = None
    

    
    def simulacion_terminada(self):
        return not self.clientes_en_fila and not self.cliente_actual