from Cajero import Cajero
from Cliente import Cliente
class Caja:
    def __init__(self, num_clientes, experiencia_cajero=None):
        if experiencia_cajero is None:
            experiencia_cajero = Cajero.generar_experiencia_aleatoria()
        self.cajero = Cajero(experiencia_cajero)
        self.clientes = [Cliente(f"Cliente_{i+1}") for i in range(num_clientes)]

    def calcular_tiempo_total(self):
        return sum(c.calcular_tiempo_total(self.cajero.tiempo_escaneo_por_articulo) for c in self.clientes)

    def mostrar_detalle(self):
        print("====Caja 1=====")
        print(f"Experiencia del cajero: {self.cajero.experiencia} (1: principiante, 2: normal, 3: experto)")
        print(f"Tiempo de escaneo por artículo: {self.cajero.tiempo_escaneo_por_articulo}s")
        print(f"Número de clientes en fila: {len(self.clientes)}")
        for i, c in enumerate(self.clientes, start=1):
            print(f"Cliente {i}: {c.num_articulos} productos / {c.metodo_pago}")
        print(f"Tiempo total estimado de atención: {self.calcular_tiempo_total()}s")
