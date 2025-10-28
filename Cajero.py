import random
class Cajero:
    def __init__(self, experiencia: int):
        self.experiencia = experiencia  # 1 principiante, 2 normal, 3 experto
        if experiencia == 1:
            self.tiempo_escaneo_por_articulo = 9
        elif experiencia == 2:
            self.tiempo_escaneo_por_articulo = 5
        else:
            self.tiempo_escaneo_por_articulo = 3

    @staticmethod
    def generar_experiencia_aleatoria() -> int:
        return random.randint(1, 3)

    @classmethod
    def crear_aleatorio(cls):
        exp = cls.generar_experiencia_aleatoria()
        return cls(exp)