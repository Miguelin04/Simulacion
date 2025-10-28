from Articulo import Articulo
import random
class Cliente:
    def __init__(self, nombre="Cliente"):
        self.nombre = nombre
        self.num_articulos = random.randint(1, 50)
        self.metodo_pago = random.choice(["Efectivo", "Tarjeta", "Transferencia"])
        self.articulos = [Articulo() for _ in range(self.num_articulos)]

    def calcular_tiempo_total(self, tiempo_escaneo_por_articulo):
        tiempo_articulos = self.num_articulos * tiempo_escaneo_por_articulo
        tiempo_cobro = random.randint(15, 30)
        return tiempo_articulos + tiempo_cobro
