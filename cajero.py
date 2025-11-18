# importaciones necesarias 
#--------------------------------------
import random
#--------------------------------------


class Cajero:

    #Constructor de la clase
    def __init__(self):
        self.experiencia = random.randint(1, 3) # 1: Principiante, 2: Normal, 3: Experto
        self.multiplicador_velocidad = self.definir_multiplicador()
        # Nuevo atributo: horas_trabajadas (en segundos)
        # Se acumulará cada segundo que el cajero esté atendiendo clientes.
        self.horas_trabajadas = 0  # segundos
        # Nuevo atributo: sueldo_base (moneda local por periodo de trabajo)
        # Valor por defecto; puede ser sobrescrito por quien cree el Cajero.
        # Se establece por defecto a 400 (sueldo mensual según análisis del usuario).
        self.sueldo_base = 400.0  # valor por defecto

    def costo_por_hora(self):
        """
        Calcular costo por hora real del cajero.
        Se calcula como sueldo_base dividido por las horas de trabajo estándar
        del periodo (p.ej. 160 horas/mes). De esta forma el costo por hora
        no depende de que el cajero ya haya acumulado horas en la simulación
        (evita que al iniciar la simulación el coste aparezca inflado).
        """
        # Usar horas mensuales estándar (p.ej. 40h/sem * 4 sem = 160h/mes)
        horas_estandar_mes = 160.0
        try:
            return float(self.sueldo_base) / float(horas_estandar_mes)
        except Exception:
            return float(self.sueldo_base) / 160.0

    def definir_multiplicador(self):
        if self.experiencia == 1:
            return 1.5  # 50% más lento
        elif self.experiencia == 2:
            return 1.0  # Velocidad normal
        else: # Experiencia 3
            return 0.7  # 30% más rápido el más pro xd