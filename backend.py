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
    cajas = supermercado.cajas + [supermercado.caja_express]
    caja_destino = None
    if not nombre_caja or nombre_caja.strip() == '':
        # Si no se especifica caja, asignar a la más vacía (menos clientes en fila)
        caja_destino = min(cajas, key=lambda c: len(c.clientes_en_fila))
    else:
        nombre_caja_lower = nombre_caja.strip().lower()
        for caja in cajas:
            nombre_caja_backend = str(getattr(caja, 'nombre', '')).strip().lower()
            if nombre_caja_lower == nombre_caja_backend:
                caja_destino = caja
                break
            if nombre_caja_lower in [f"caja {cajas.index(caja)+1}".lower(), "caja express", "express"]:
                caja_destino = caja
                break
        if caja_destino is None:
            # fallback: si es express
            if nombre_caja_lower in ["caja express", "express"]:
                caja_destino = supermercado.caja_express
            else:
                # buscar por nombre exacto
                for caja in cajas:
                    if nombre_caja == getattr(caja, 'nombre', None):
                        caja_destino = caja
                        break
    if caja_destino is None:
        return jsonify({'error': 'Caja no encontrada'}), 404
    # Agregar clientes
    for _ in range(cantidad):
        cliente = Cliente(f"Cliente{random.randint(1000,9999)}")
        if caja_destino == supermercado.caja_express:
            cliente.num_articulos = random.randint(1, 10)
            cliente.crear_lista_articulos()
            cliente.seleccionar_tipo_pago()
            # Solo agregar a express si tiene <=10 artículos
            if cliente.num_articulos <= 10:
                caja_destino.clientes_en_fila.append(cliente)
            else:
                # Si por alguna razón tiene más, asignar a la caja normal más vacía
                caja_mas_vacia = min(supermercado.cajas, key=lambda c: len(c.clientes_en_fila))
                caja_mas_vacia.clientes_en_fila.append(cliente)
        else:
            cliente.crear_lista_articulos()
            cliente.seleccionar_tipo_pago()
            caja_destino.clientes_en_fila.append(cliente)
    return jsonify({'ok': True})


if __name__ == '__main__':
    app.run(debug=True, port=5000)
