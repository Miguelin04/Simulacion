
from dataclasses import dataclass
import random

@dataclass
class Articulo:
    tiempo_escaneo: int  # segundos (1-5)
    tiempo_empaque: int  # segundos (1-5)

    @staticmethod
    def crear_aleatorio():
        return Articulo(tiempo_escaneo=random.randint(1, 5), tiempo_empaque=random.randint(1, 5))

    def __str__(self):
        return f"Articulo(escaneo={self.tiempo_escaneo}s, empaque={self.tiempo_empaque}s)"