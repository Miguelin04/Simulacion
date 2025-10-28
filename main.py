from Caja import Caja
from Cliente import Cliente
import random
# Simulación principal
if __name__ == "__main__":
    print("=== Simulación de una caja ===")
    num_clientes = int(input("Ingrese número de clientes en la fila:"))
    caja = Caja(num_clientes)
    caja.mostrar_detalle()

    # Cliente rojo (nuevo)
    print("\nNuevo Cliente")
    cliente_rojo = Cliente("Cliente_Rojo")
    print(f"Productos: {cliente_rojo.num_articulos} / Método de pago: {cliente_rojo.metodo_pago}")

    # Calcular tiempos
    tiempo_espera = caja.calcular_tiempo_total()
    tiempo_cliente_rojo = cliente_rojo.calcular_tiempo_total(caja.cajero.tiempo_escaneo_por_articulo)
    tiempo_total = tiempo_espera + tiempo_cliente_rojo

    print("\nResultados")
    print(f"Tiempo de espera (antes de ser atendido): {tiempo_espera}s")
    print(f"Tiempo propio del nuevo cliente: {tiempo_cliente_rojo}s")
    print(f"Tiempo total estimado hasta salir: {tiempo_total}s")