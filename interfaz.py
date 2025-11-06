
import time
import os
from Caja import Caja
#-------------------------------------------

class Interfaz:


    def limpiar_pantalla(self):
        os.system('cls')


    def dibujar_interfaz(self, caja):
        atendidos = caja.clientes_atendidos
        lineas_atendidos = ["| Tiempos de Atención"]
        lineas_atendidos.append("|----------------------")
        
        for cliente in atendidos:
            tiempo_total = int(round(cliente.tiempo_total_atencion, 0))
            lineas_atendidos.append(f"|  {cliente.nombre}: {tiempo_total}s")
        
        cajero_exp = f"Cajero (Exp: {caja.cajero.experiencia} | Mod: {caja.cajero.multiplicador_velocidad}x)"
        if caja.cliente_actual:
            c_actual_str = f"{caja.cliente_actual.nombre} ({caja.cliente_actual.num_articulos} art)"
            c_tiempo_str = f"({caja.tiempo_restante_cliente_actual}s restantes)"
        else:
            c_actual_str = "(Caja Libre)"
            c_tiempo_str = ""

        lineas_fila = []
        for i in range(min(5, len(caja.clientes_en_fila))):
            c_fila = caja.clientes_en_fila[i]
            lineas_fila.append(f"  {i+1}. {c_fila.nombre} ({c_fila.num_articulos} art)")
        
        for i in range(15):
            linea_izquierda = ""
            
            if i == 0:
                linea_izquierda = "-----------"
            elif i == 1:
                linea_izquierda = f"| {cajero_exp:<25}   | -----------------------------"
            elif i == 2:
                linea_izquierda = f"| ATENDIENDO: {c_actual_str:<15} | {c_tiempo_str:<30}"
            elif i == 3:
                linea_izquierda = f"| {'':<25}     | -----------------------------"
            elif i == 4:
                linea_izquierda = f"| FILA DE ESPERA ({len(caja.clientes_en_fila)}):"
            elif (i-5) < len(lineas_fila):
                linea_izquierda = f"| {lineas_fila[i-5]:<50}"
            elif i == 14:
                linea_izquierda = "-----------"
            else:
                linea_izquierda = "|"
            relleno = " " * (65 - len(linea_izquierda))
            linea_derecha = ""
            
            if i < len(lineas_atendidos):
                linea_derecha = lineas_atendidos[i]
            print(linea_izquierda + relleno + linea_derecha)


    def ejecutar_simulacion(self):
        try:
            num_clientes = int(input("Ingrese el numero de clientes a simular: \n"))
        except ValueError:
            print("Entrada inválida. Usando 5 clientes por defecto.")
            num_clientes = 5
        
        mi_caja = Caja(num_clientes)
        
        while not mi_caja.simulacion_terminada():
            self.limpiar_pantalla()
            self.dibujar_interfaz(mi_caja)
            mi_caja.actualizar_simulacion_un_segundo()
            try:
                time.sleep(1)
            except KeyboardInterrupt:
                print("\nSimulación interrumpida.")
                break
        self.limpiar_pantalla()
        self.dibujar_interfaz(mi_caja)
        print("\n\n--- SIMULACIÓN TERMINADA ---")
        print(f"Todos los {len(mi_caja.clientes_atendidos)} clientes fueron atendidos.")