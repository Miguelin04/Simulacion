from cliente import Cliente
from cajero import Cajero
from articulo import Articulo, crear_articulos  
import random
#Asignacion de clientes a cajas segun la menor cantidad de cola
def crear_cliente(id, cantidad_articulos=3):
    articulos = crear_articulos(cantidad_articulos) 
    return Cliente(id, articulos)

def crear_cajeros(numero_cajas, tiene_caja_express):
    cajeros = []
    
    # cajero normale
    for i in range(1, numero_cajas + 1):
        experiencia = random.choice(["baja", "media", "alta"])
        cajero = Cajero(i, experiencia, "normal")
        cajeros.append(cajero)
        print(f"> {cajero}")
    
    # caja express
    if tiene_caja_express > 0:
        cajero_express = Cajero(numero_cajas + 1, "alta", "express")   #asignacion de experiencia Alta por defecto
        cajeros.append(cajero_express)
        print(f"> Cajero Express >> {cajero_express}")
    
    return cajeros

def crear_clientes(numero_clientes, rango_articulos):
    """Crea múltiples clientes con cantidad variable de artículos"""
    clientes = []
    for i in range(1, numero_clientes + 1):
        # Cantidad aleatoria de artículos dentro del rango
        cantidad_articulos = random.randint(1, rango_articulos)
        cliente = crear_cliente(i, cantidad_articulos)
        clientes.append(cliente)
        #print(f"Cliente creado: {cliente}")
        #print(f"  - Detalles de artículos:")
        #for j, articulo in enumerate(cliente.articulos, 1):
            #print(f"    Artículo {j}: {articulo}")
    return clientes

def asignar_clientes_a_cajeros(cajeros, clientes):
    print(f"\n//////{len(clientes)} clientes  con{len(cajeros)} cajeros //////")
    
    for cliente in clientes:
        # Filtrar cajeros disponibles para este cliente
        cajeros_disponibles = []
        
        for cajero in cajeros:

            if cajero.tipo == "express":
                if len(cliente.articulos) <= 10:  # limite 10
                    cajeros_disponibles.append(cajero)
            else:
                # Cajero normal - sin restricciones
                cajeros_disponibles.append(cajero)
        
        if cajeros_disponibles:
            # Elegir el cajero con menos clientes
            cajero_elegido = min(cajeros_disponibles, key=lambda c: len(c.cola_clientes))
            cajero_elegido.agregar_cliente(cliente)
            print(f"Cliente {cliente.id} ({len(cliente.articulos)} articulos >> Caja {cajero_elegido.id} ({cajero_elegido.tipo})")
        else:
            print(f"⚠️  Cliente {cliente.id} no puede ser asignado - demasiados artículos para cajas express")

def simular_escenario_inicial(R_Articulos, NGente, NCajas, CajaExpress):

    print("=== ----------------------------------------------- ===")
    print(f"Configuración: {NGente} clientes, {NCajas} cajas normales, {CajaExpress} cajas express, hasta {R_Articulos} artículos por cliente")
    
    # 1- crear cajeros
    cajeros = crear_cajeros(NCajas, CajaExpress)
    
    # 2- crear clientes
    clientes = crear_clientes(NGente, R_Articulos)
    
    # 3- ponner clientes a cajeros x menor cola
    asignar_clientes_a_cajeros(cajeros, clientes)
    
    # Mostrar estado final
    print(f"\n=== ESTADO FINAL ===")
    for cajero in cajeros:
        print(f"\n{cajero}")
        if cajero.cola_clientes:
            for cliente in cajero.cola_clientes:
                print(f"  - {cliente}")
        else:
            print("  - Sin clientes en cola")
    

    #mostrar_estadisticas(cajeros)

def mostrar_estadisticas(cajeros):
    """Muestra estadísticas de la simulación"""
    print(f"\n=== ESTADÍSTICAS ===")
    total_clientes = sum(len(cajero.cola_clientes) for cajero in cajeros)
    print(f"Total clientes en sistema: {total_clientes}")
    
    for cajero in cajeros:
        clientes_en_cola = len(cajero.cola_clientes)
        articulos_en_cola = sum(len(cliente.articulos) for cliente in cajero.cola_clientes)
        print(f"Caja {cajero.id} ({cajero.tipo}): {clientes_en_cola} clientes // {articulos_en_cola} artículos")


# Función adicional para mostrar información detallada
def mostrar_estado_detallado(cajeros):
    """Muestra información detallada de todos los cajeros y sus clientes"""
    for cajero in cajeros:
        print(f"\n--- ESTADO DETALLADO CAJERO {cajero.id} ---")
        print(f"Tipo: {cajero.tipo}")
        print(f"Experiencia: {cajero.experiencia}")
        print(f"Total clientes en cola: {len(cajero.cola_clientes)}")
        
        for i, cliente in enumerate(cajero.cola_clientes, 1):
            print(f"\nCliente {i} en cola:")
            print(f"  ID: {cliente.id}")
            print(f"  Cantidad de artículos: {len(cliente.articulos)}")
            
            tiempo_total_articulos = 0
            for j, articulo in enumerate(cliente.articulos, 1):
                tiempo_articulo = articulo.tiempoScanner + articulo.tiempoEmpaquetado
                tiempo_total_articulos += tiempo_articulo
                print(f"  Artículo {j}: scanner={articulo.tiempoScanner}s, empaquetado={articulo.tiempoEmpaquetado}s, total={tiempo_articulo}s")
            
            print(f"  Tiempo total en artículos: {tiempo_total_articulos}s")

if __name__ == "__main__":
    # Configuración flexible desde el main
    R_Articulos = random.randint(1, 50)  # Rango máximo de artículos por cliente
    NGente = 23  # Número de clientes
    NCajas = 3  # Número de cajas normales
    CajaExpress = 1 # Número de cajas express
    
    simular_escenario_inicial(R_Articulos, NGente, NCajas, CajaExpress)
    
