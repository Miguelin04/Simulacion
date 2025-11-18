
import time
import os
from Caja import Caja
from supermercado import Supermercado
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
        # Preguntar opcionalmente cuántas cajas normales usar
        try:
            num_cajas = int(input("Ingrese numero de cajas normales (por defecto 3): \n") or 3)
        except ValueError:
            num_cajas = 3

        # Crear el supermercado y asignar clientes
        supermercado = Supermercado(num_clientes, num_cajas=num_cajas)
        # Asignar clientes de forma aleatoria respetando reglas internas (incluye ajuste por demanda)
        supermercado.asignar_clientes_random(num_clientes)

        # Bucle principal: actualizar supermercado y dibujar cada caja
        try:
            while not supermercado.simulacion_terminada():
                self.limpiar_pantalla()
                # Dibujar cajas normales
                for caja in supermercado.cajas:
                    self.dibujar_interfaz(caja)
                    print("\n")
                # Dibujar caja express
                print("--- CAJA EXPRESS ---")
                self.dibujar_interfaz(supermercado.caja_express)

                # Mostrar métricas nuevas: costo total y número de cajas actuales
                estado = supermercado.obtener_estado()
                print(f"\nCosto total estimado: {estado.get('costo_total', 0):.2f}")
                # Mostrar sólo cajas normales (la caja express se muestra por separado)
                print(f"Cajas en servicio: {estado.get('num_cajas_actuales', len(supermercado.cajas))}")

                # Avanzar un segundo en toda la simulación
                supermercado.actualizar_simulacion_un_segundo()
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nSimulación interrumpida.")

        # Al terminar, mostrar resultados consolidados
        self.limpiar_pantalla()
        for caja in supermercado.cajas:
            self.dibujar_interfaz(caja)
            print("\n")
        print("--- CAJA EXPRESS ---")
        self.dibujar_interfaz(supermercado.caja_express)
        estado_final = supermercado.obtener_estado()
        print("\n\n--- SIMULACIÓN TERMINADA ---")
        total_atendidos = sum(len(c.clientes_atendidos) for c in supermercado.cajas + [supermercado.caja_express])
        print(f"Todos los {total_atendidos} clientes fueron atendidos.")
        print(f"Costo total final: {estado_final.get('costo_total', 0):.2f}")