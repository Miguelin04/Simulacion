# importaciones necesarias
#-----------------------------------------
from articulo import Articulo
import random
#----------------------------------------


class Cliente:

    #Constructor de la clase
    def __init__(self, nombre = "Cliente" ):
        self.nombre        = nombre
        self.num_articulos = random.randint(10, 15) 
        self.metodo_pago   = ""
        self.articulos     = []
        self.tiempo_total_atencion = 0 # Nuevo: para guardar el resultado final
        # paciencia (segundos): tiempo que el cliente está dispuesto a esperar en la fila
        # por defecto aleatorio entre 2 y 6 minutos (120..360s). La regla global
        # adicional establece que si el tiempo esperado > 4 minutos (240s) el
        # cliente también abandonará la fila.
        self.paciencia = random.randint(120, 360)
        # bandera si el cliente abandonó la fila
        self.abandono = False

        #abandono de fila si supera el tiempo de espera 


    #Creo la lista de los artículos que quiere llevarse
    def crear_lista_articulos(self):
        self.articulos = [Articulo() for _ in range(self.num_articulos)]


    #Función para elegir el tipo de pago cuando llegue a la caja
    def seleccionar_tipo_pago(self):
        opciones_pago = ["Efectivo", "Tarjeta", "Transferencia"]
        self.metodo_pago = random.choice(opciones_pago)


    def calcular_tiempo_atencion(self, multiplicador_cajero, experiencia_cajero=None, metodo_pago=None):
        # Evitar comparaciones directas con floats
        if experiencia_cajero is None:
            if abs(multiplicador_cajero - 1.5) < 1e-6:
                experiencia_cajero = 1
            elif abs(multiplicador_cajero - 1.0) < 1e-6:
                experiencia_cajero = 2
            else:
                experiencia_cajero = 3
        if experiencia_cajero == 1:
            tiempo_escaneo = 9
        elif experiencia_cajero == 2:
            tiempo_escaneo = 5
        else:
            tiempo_escaneo = 3

        # Determinar método de pago
        metodo = metodo_pago or self.metodo_pago
        if metodo == "Efectivo":
            tiempo_cobro = random.randint(20, 30)
        elif metodo == "Tarjeta":
            tiempo_cobro = random.randint(15, 25)
        else:
            tiempo_cobro = random.randint(10, 20)

        tiempo_real_escaneo = self.num_articulos * tiempo_escaneo
        self.tiempo_total_atencion = tiempo_real_escaneo + tiempo_cobro
        return int(round(self.tiempo_total_atencion, 0))

    def calcular_maximo_espera(self, numero_clientes_fila: int, multiplicador_cajero: float = 1.0) -> int:
        """
        Estima el tiempo de espera (segundos) para este cliente dado el número
        de clientes por delante en la fila (`numero_clientes_fila`). Devuelve
        un entero (segundos) con la espera estimada total.
        """
        # Si no tiene lista de artículos creada, aproximar por num_articulos
        if not self.articulos:
            # estimación básica: tiempo escaneo medio 4s por artículo, pago ~20s
            avg_escaneo = 4
        else:
            avg_escaneo = sum(a.tiempo_escaneo for a in self.articulos) / len(self.articulos)
        tiempo_por_cliente = (self.num_articulos * avg_escaneo) + 20
        # aplicar multiplicador del cajero (reduce o aumenta el tiempo)
        tiempo_por_cliente = tiempo_por_cliente * multiplicador_cajero
        espera_estimada = int(round(numero_clientes_fila * tiempo_por_cliente))
        return espera_estimada

    def debe_abandonar(self, numero_clientes_fila: int, multiplicador_cajero: float = 1.0) -> bool:
        espera = self.calcular_maximo_espera(numero_clientes_fila, multiplicador_cajero)
        if espera > 240:
            return True
        if espera > self.paciencia:
            return True
        return False

    def calcular_perdida(self) -> float:
        if not self.articulos:
            return 0.0
        return round(sum((a.precio for a in self.articulos)), 2)
    

    #calcular?perdida
    #calcular para que aummente el numero de clientes cuando es hora pico 12:00 - 14:00


# Funciones de demanda (reutilizables desde el backend/frontend)
def demanda_multiplier(day: int, hour: int) -> float:
    # Rango de operación
    if hour < 8 or hour > 20:
        return 1.0

    incremento = 0.0
    # Ajuste por día
    if day == 4:
        incremento += 0.05
    elif day == 5:
        incremento += 0.10
    elif day == 6:
        incremento += 0.15

    # Hora punta 12:00 - 13:59 -> aplicamos si hour es 12 o 13
    # Incluir horas 12, 13 y 14 según nueva especificación
    if 12 <= hour <= 14:
        # Aumento de demanda en horas pico: 30% según nueva especificación
        incremento += 0.30

    return 1.0 + incremento


def ajustar_clientes_por_demanda(cantidad_base: int, day: int, hour: int) -> int:
    mult = demanda_multiplier(day, hour)
    cantidad = max(0, int(round(cantidad_base * mult)))
    return cantidad