class Pago:
    def __init__(self, tipo):
        
        self.tipo = tipo
        self.tiempo = self._definir_tiempo(tipo)

    def _definir_tiempo(self, tipo):

        tiempos = {
            "efectivo": 5,       # contar billetes, cambio
            "tarjeta": 8,        # pasar tarjeta, validación
            "transferencia": 12, # más lento
            "qr": 6              # rápido pero no instantáneo
        }
        return tiempos.get(tipo.lower(), 5)

    def __str__(self):
        return f"Pago: {self.tipo} (+{self.tiempo}s)"
