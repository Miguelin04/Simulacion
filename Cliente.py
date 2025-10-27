from dataclasses import dataclass
from typing import List
from Articulo import Articulo
import random


@dataclass
class Cliente:
    id: int
    articulos: List[Articulo]
    dificultad: int  # 1-3
    tipo_pago: str  # 'efectivo' | 'tarjeta'

    @property
    def cantidad_articulos(self) -> int:
        return len(self.articulos)

    @staticmethod
    def crear_aleatorio(id: int, num_articulos: int = None):
        if num_articulos is None:
            num_articulos = random.randint(1, 50)
        articulos = [Articulo.crear_aleatorio() for _ in range(num_articulos)]
        dificultad = random.randint(1, 3)
        tipo_pago = random.choice(["efectivo", "tarjeta"])
        return Cliente(id=id, articulos=articulos, dificultad=dificultad, tipo_pago=tipo_pago)
