# importaciones necesarias 
#--------------------------------------
import random
#--------------------------------------


class Cajero:

    #Constructor de la clase
    def __init__(self):
        self.experiencia = random.randint(1, 3) # 1: Principiante, 2: Normal, 3: Experto
        self.multiplicador_velocidad = self.definir_multiplicador()

    def definir_multiplicador(self):
        if self.experiencia == 1:
            return 1.5  # 50% más lento
        elif self.experiencia == 2:
            return 1.0  # Velocidad normal
        else: # Experiencia 3
            return 0.7  # 30% más rápido el más pro xd