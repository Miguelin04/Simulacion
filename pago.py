class Pago:
    def __init__(self, tipo):
        
        self.tipo = tipo
        self.tiempo = self._definir_tiempo(tipo)

    def _definir_tiempo(self, tipo):

        tiempos = {
            "efectivo": 5,      
            "tarjeta": 8,       
            "transferencia": 12, 
            "qr": 6              
        }
        return tiempos.get(tipo.lower(), 5)

    def __str__(self):
        return f"Pago: {self.tipo} (+{self.tiempo}s)"
