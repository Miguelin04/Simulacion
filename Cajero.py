import random

# ---------------------
# Clase Articulo
# ---------------------
class Articulo:
    def __init__(self):
        self.tiempo_escaneo = random.randint(1, 5)
        self.tiempo_empaquetado = random.randint(1, 5)

# ---------------------
# Clase Cliente
# ---------------------
class Cliente:
    def __init__(self, nombre="Cliente"):
        self.nombre = nombre
        self.num_articulos = random.randint(1, 50)
        self.metodo_pago = random.choice(["Efectivo", "Tarjeta", "Transferencia"])
        self.dificultad = random.randint(1, 3)
        self.articulos = [Articulo() for _ in range(self.num_articulos)]

    def calcular_tiempo_total(self, experiencia_cajero):
        # Tiempo de escanear y empacar los artículos
        tiempo_articulos = sum(a.tiempo_escaneo + a.tiempo_empaquetado for a in self.articulos)
        # Tiempo de pago aleatorio
        tiempo_pago = random.randint(15, 30)
        # Efecto de dificultad del cliente y experiencia del cajero
        modificador = (self.dificultad * 0.2) - (experiencia_cajero * 0.1)
        tiempo_total = tiempo_articulos * (1 + modificador) + tiempo_pago
        return max(tiempo_total, 0)

# ---------------------
# Clase Cajero
# ---------------------
class Cajero:
    def __init__(self):
        self.experiencia = random.randint(1, 3)  # 1 principiante, 3 experto

# ---------------------
# Clase Caja
# ---------------------
class Caja:
    def __init__(self, num_clientes):
        self.cajero = Cajero()
        self.clientes = [Cliente(f"Cliente_{i+1}") for i in range(num_clientes)]

    def mostrar_detalle(self):
        print(f"\n=== 🧾 Caja 1 ===")
        print(f"Experiencia del cajero: {self.cajero.experiencia} (1: principiante, 3: experto)")
        print(f"Número de clientes en fila: {len(self.clientes)}")
        for i, c in enumerate(self.clientes, start=1):
            print(f"Cliente {i}: {c.num_articulos} productos / {c.metodo_pago}")

    def tiempo_espera_total(self):
        return sum(c.calcular_tiempo_total(self.cajero.experiencia) for c in self.clientes)

# ---------------------
# Simulación principal
# ---------------------
if __name__ == "__main__":
    # Cantidad de clientes actuales en la caja
    num_clientes = random.randint(3, 7)
    caja = Caja(num_clientes)
    caja.mostrar_detalle()

    # Agregamos el nuevo cliente (rojo)
    cliente_rojo = Cliente("Cliente_Rojo")

    print("\n=== 🔴 Nuevo Cliente (Rojo) ===")
    print(f"Productos: {cliente_rojo.num_articulos}")
    print(f"Método de pago: {cliente_rojo.metodo_pago}")
    print(f"Dificultad: {cliente_rojo.dificultad}")

    # Calcular tiempos
    tiempo_espera = caja.tiempo_espera_total()
    tiempo_cliente_rojo = cliente_rojo.calcular_tiempo_total(caja.cajero.experiencia)
    tiempo_total = tiempo_espera + tiempo_cliente_rojo

    print("\n=== 🕒 Resultados ===")
    print(f"Tiempo de espera antes de ser atendido: {tiempo_espera:.2f} s")
    print(f"Tiempo propio del cliente rojo: {tiempo_cliente_rojo:.2f} s")
    print(f"⏱ Tiempo total estimado hasta salir: {tiempo_total:.2f} s")
