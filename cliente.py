
import random


class Cliente:
    def __init__(self, id,  articulos):

        self.id = id
        #falta la lista de los artículos que están en su otra clase.
        #self.dificultad_atencion = dificultad_atencion #nose a que se refiere
        self.articulos = articulos
        

    def __str__(self):
        return f"Cliente ID: {self.id}, Artículos: {len(self.articulos)}"
        

    def puede_usar_caja_express(self):
        """Verifica si el cliente puede usar caja express"""
        return len(self.articulos) <= 10
    
    def observar_cajas(self, cajas):
        caja_menos_clientes = min(cajas, key=lambda caja: len(caja.cola_clientes))
        return caja_menos_clientes


