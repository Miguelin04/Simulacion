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