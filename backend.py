from flask import Flask, jsonify, request
from flask_cors import CORS
from supermercado import Supermercado
from cliente import Cliente
import random

app = Flask(__name__)
CORS(app)
supermercado = None

@app.route('/api/simular_random', methods=['POST'])
def simular_random():
    global supermercado
    data = request.get_json()
    num_clientes = data.get('num_clientes', 15)
    supermercado = Supermercado(0)
    supermercado.asignar_clientes_random(num_clientes)
    return jsonify({"ok": True})

# Endpoint para simulación manual (solo estructura vacía)
@app.route('/api/simular_manual', methods=['POST'])
def simular_manual():
    global supermercado
    # Solo reiniciar si no hay simulación activa o si todas las cajas están vacías
    def cajas_vacias():
        if supermercado is None:
            return True
        for caja in supermercado.cajas:
            if caja.clientes_en_fila or caja.cliente_actual:
                return False
        if supermercado.caja_express.clientes_en_fila or supermercado.caja_express.cliente_actual:
            return False
        return True
    global supermercado
    if supermercado is None or cajas_vacias():
        supermercado = Supermercado(0)
    return jsonify({"ok": True})
from flask import Flask, jsonify, request
from flask_cors import CORS
from supermercado import Supermercado
from cliente import Cliente
import random

@app.route('/api/simular', methods=['POST'])
def simular():
    global supermercado
    data = request.get_json()
    num_clientes = data.get('num_clientes', 15)
    supermercado = Supermercado(0)
    if num_clientes > 0:
        supermercado.asignar_clientes_random(num_clientes)
    return jsonify({"ok": True})

@app.route('/api/estado', methods=['GET'])
def estado():
    if supermercado is None:
        return jsonify({"error": "No hay simulación activa"}), 400
    return jsonify(supermercado.obtener_estado())

@app.route('/api/avanzar', methods=['POST'])
def avanzar():
    if supermercado is None:
        return jsonify({"error": "No hay simulación activa"}), 400
    supermercado.actualizar_simulacion_un_segundo()
    terminado = supermercado.simulacion_terminada()
    return jsonify({"terminado": terminado})

@app.route('/api/agregar_clientes', methods=['POST'])
def agregar_clientes():
    global supermercado
    if supermercado is None:
        return jsonify({'error': 'No hay simulación activa'}), 400
    data = request.get_json()
    cantidad = int(data.get('cantidad', 1))
    nombre_caja = data.get('caja')
    print(f"[DEBUG] Nombre de caja recibido: '{nombre_caja}'")
    # Buscar la caja por nombre
    cajas = supermercado.cajas + [supermercado.caja_express]
    caja_destino = None
    nombre_caja_lower = nombre_caja.strip().lower()
    for idx, caja in enumerate(cajas):
        nombre_caja_backend = str(getattr(caja, 'nombre', '')).strip().lower()
        print(f"[DEBUG] Comparando con caja backend: '{nombre_caja_backend}'")
        if nombre_caja_lower == nombre_caja_backend:
            caja_destino = caja
            print(f"[DEBUG] Caja destino encontrada por nombre exacto: '{caja_destino.nombre}'")
            break
        # Solo cajas normales aceptan alias 'caja 1', 'caja 2', etc.
        if idx < len(supermercado.cajas):
            if nombre_caja_lower == f"caja {idx+1}":
                caja_destino = caja
                print(f"[DEBUG] Caja destino encontrada por alias normal: '{caja_destino.nombre}'")
                break
        # Solo la express acepta 'caja express' o 'express'
        if idx == len(cajas)-1:
            if nombre_caja_lower in ["caja express", "express"]:
                caja_destino = caja
                print(f"[DEBUG] Caja destino encontrada por alias express: '{caja_destino.nombre}'")
                break
    if caja_destino is None:
        # fallback: si es express
        if nombre_caja_lower in ["caja express", "express"]:
            caja_destino = supermercado.caja_express
            print(f"[DEBUG] Caja destino fallback: 'Caja Express'")
        else:
            # buscar por nombre exacto
            for caja in cajas:
                if nombre_caja == getattr(caja, 'nombre', None):
                    caja_destino = caja
                    print(f"[DEBUG] Caja destino encontrada por nombre exacto (fallback): '{caja_destino.nombre}'")
                    break
    if caja_destino is None:
        print("[DEBUG] Caja no encontrada, abortando.")
        return jsonify({'error': 'Caja no encontrada'}), 404
    print(f"[DEBUG] Caja destino final: '{caja_destino.nombre}'")
    # Si el destino es express, usar el método dedicado para asegurar la lógica correcta
    if caja_destino == supermercado.caja_express:
        print("[DEBUG] Asignando clientes a la caja express...")
        asignados = supermercado.asignar_clientes_a_express(cantidad)
        return jsonify({'ok': True, 'asignados_express': asignados})
    else:
        print(f"[DEBUG] Asignando clientes a la caja normal: '{caja_destino.nombre}'")
        for _ in range(cantidad):
            cliente = Cliente(f"Cliente{random.randint(1000,9999)}")
            cliente.crear_lista_articulos()
            cliente.seleccionar_tipo_pago()
            caja_destino.clientes_en_fila.append(cliente)
        return jsonify({'ok': True})


if __name__ == '__main__':
    app.run(debug=True, port=5000)
