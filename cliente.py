# importaciones necesarias
#-----------------------------------------
from Articulo import Articulo
import random
#----------------------------------------


class Cliente:

    #Constructor de la clase
    def __init__(self, nombre = "Cliente" ):
        self.nombre        = nombre
        self.num_articulos = random.randint(1, 15) # Bajé un poco el máx. para la simulación
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


    # Calcula el tiempo total que ESTE cliente tardará en ser atendido
    def calcular_tiempo_atencion(self, multiplicador_cajero):
        tiempo_base_articulos = sum(articulo.tiempo_escaneo for articulo in self.articulos)
        tiempo_real_escaneo = tiempo_base_articulos * multiplicador_cajero
        tiempo_cobro = random.randint(5, 10) # tiempo cortito para simular
        self.tiempo_total_atencion = tiempo_real_escaneo + tiempo_cobro # puede ser flotantante
        return int(round(self.tiempo_total_atencion, 0)) # redondear para imprimir los segundos (no se como poner segundos y milisegundos)