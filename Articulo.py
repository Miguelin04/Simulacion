import random
class Articulo:
    def __init__(self):
        self.tiempo_escaneo = random.randint(1, 5)
        self.tiempo_empaquetado = random.randint(1, 5)

    def __repr__(self):
        return f"Articulo(escaneo={self.tiempo_escaneo}, empaq={self.tiempo_empaquetado})"
