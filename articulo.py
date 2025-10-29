import random

class Articulo:
    def __init__(self, tiempoScanner, tiempoEmpaquetado):
        self.tiempoScanner = tiempoScanner
        self.tiempoEmpaquetado = tiempoEmpaquetado
    
    def __str__(self):
        return f"Artículo (scanner: {self.tiempoScanner}s, empaquetado: {self.tiempoEmpaquetado}s)"

# Función para crear artículos (agregada al archivo articulo.py)
def crear_articulos(cantidad=3):
    """Crea una lista de artículos con tiempos aleatorios"""
    articulos = []
    for i in range(cantidad):
        tiempo_scanner = random.randint(2, 8)  # 2-8 segundos por artículo
        tiempo_empaquetado = random.randint(3, 6)  # 3-6 segundos por artículo
        articulo = Articulo(tiempo_scanner, tiempo_empaquetado)
        articulos.append(articulo)
    return articulos