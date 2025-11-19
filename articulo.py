#importaciones necesarias 
#-------------------------------------
import random
#-------------------------------------


class Articulo:

    # Constructor de la clase
    def __init__(self):
        #random se usa para simular la variabilidad en los tiempos
        self.tiempo_escaneo     = random.randint(1, 5)
        self.tiempo_empaquetado = random.randint(1, 5)
        # precio del artículo (moneda local), variabilidad entre 5 y 150
        self.precio = round(random.uniform(5.0, 150.0), 2)


    #to_str para la presentación del objeto en la consola (posiblemente lo cambie)
    def __repr__(self):
        return f"Articulo(escaneo={self.tiempo_escaneo}, empaq={self.tiempo_empaquetado})"
