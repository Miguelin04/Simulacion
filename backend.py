from flask import Flask, jsonify, request
from flask_cors import CORS
from supermercado import Supermercado
from cliente import Cliente
import random

app = Flask(__name__)
CORS(app)
supermercado = None


def _get_param(name, default=None, cast=None):
    """
    Obtener un parámetro de la request sin asumir JSON.
    Prioriza: form/args (`request.values`), luego JSON (si llega), y finalmente el valor por defecto.
    Si `cast` es una función la aplica al valor antes de devolver.
    """
    # request.values contiene args y form (querystring + form-encoded)
    val = None
    try:
        if name in request.values:
            val = request.values.get(name)
        else:
            # intentar JSON solo como fallback
            j = request.get_json(silent=True)
            if j and name in j:
                val = j.get(name)
    except Exception:
        val = None
    if val is None:
        return default
    if cast:
        try:
            return cast(val)
        except Exception:
            return default
    return val


@app.route('/api/simular_random', methods=['POST'])
def simular_random():
    global supermercado
    # No asumimos JSON: leer desde form/querystring o JSON como fallback
    num_clientes = _get_param('num_clientes', 15, cast=int)
    num_cajas = _get_param('num_cajas', 3, cast=int)
    supermercado = Supermercado(0, num_cajas=num_cajas)
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
    # Permitir especificar número de cajas al iniciar manualmente (form/querystring)
    num_cajas = _get_param('num_cajas', 3, cast=int)
    if supermercado is None or cajas_vacias():
        supermercado = Supermercado(0, num_cajas=num_cajas)
    return jsonify({"ok": True})


@app.route('/api/simular', methods=['POST'])
def simular():
    global supermercado
    # Leer parámetros preferentemente desde form/querystring
    num_clientes = _get_param('num_clientes', 15, cast=int)
    num_cajas = _get_param('num_cajas', 3, cast=int)
    supermercado = Supermercado(0, num_cajas=num_cajas)
    # Si se proporciona una tasa de llegadas, almacenarla en la instancia
    tasa_val = _get_param('tasa', None)
    if tasa_val is not None:
        try:
            supermercado.tasa_base_llegadas_por_segundo = float(tasa_val)
        except Exception:
            supermercado.tasa_base_llegadas_por_segundo = 0.0
    if num_clientes > 0:
        supermercado.asignar_clientes_random(num_clientes)
    return jsonify({"ok": True})


# NOTE: Endpoints to configure backend (config, sueldo_base) removed to keep API minimal

@app.route('/api/estado', methods=['GET'])
def estado():
    if supermercado is None:
        return jsonify({"error": "No hay simulación activa"}), 400
    try:
        return jsonify(supermercado.obtener_estado())
    except Exception as e:
        return jsonify({"error": f"Error al obtener estado: {str(e)}"}), 500


@app.route('/api/abrir_caja_manual', methods=['POST'])
def abrir_caja_manual():
    global supermercado
    # Si no hay simulación activa, crear una con valores por defecto
    if supermercado is None:
        # Crear supermercado vacío con 3 cajas normales por defecto
        supermercado = Supermercado(0, num_cajas=3)
    # número de cajas a abrir (por defecto 1)
    num = _get_param('num', 1, cast=int)
    abiertas = 0
    for _ in range(max(0, num)):
        try:
            ok = supermercado.abrir_caja_manual()
            if ok:
                abiertas += 1
        except Exception:
            pass
    return jsonify({'ok': True, 'abiertas': abiertas})


@app.route('/api/set_cajero', methods=['POST'])
def set_cajero():
    global supermercado
    if supermercado is None:
        return jsonify({'error': 'No hay simulación activa'}), 400
    nombre = _get_param('nombre', None)
    tipo = _get_param('tipo', None)
    sueldo = _get_param('sueldo', None)
    if not nombre or not tipo:
        return jsonify({'error': 'Parámetros incompletos (nombre, tipo)'}), 400
    # localizar caja similar a /api/agregar_clientes
    cajas = supermercado.cajas + [supermercado.caja_express]
    nombre_lower = nombre.strip().lower()
    caja_destino = None
    for idx, caja in enumerate(cajas):
        nombre_caja_backend = str(getattr(caja, 'nombre', '')).strip().lower()
        if nombre_lower == nombre_caja_backend:
            caja_destino = caja
            break
        if idx < len(supermercado.cajas):
            if nombre_lower == f"caja {idx+1}":
                caja_destino = caja
                break
        if idx == len(cajas)-1 and nombre_lower in ["caja express", "express"]:
            caja_destino = caja
            break
    if caja_destino is None:
        return jsonify({'error': 'Caja no encontrada'}), 404
    # Mapear tipo a experiencia
    if tipo == 'Principiante':
        experiencia = 1
    elif tipo == 'Normal':
        experiencia = 2
    else:
        experiencia = 3
    from cajero import Cajero
    nuevo = Cajero()
    nuevo.experiencia = experiencia
    nuevo.multiplicador_velocidad = nuevo.definir_multiplicador()
    try:
        if sueldo is not None:
            nuevo.sueldo_base = float(sueldo)
    except Exception:
        pass
    caja_destino.cajero = nuevo
    return jsonify({'ok': True, 'caja': getattr(caja_destino, 'nombre', None)})

@app.route('/api/avanzar', methods=['POST'])
def avanzar():
    if supermercado is None:
        return jsonify({"error": "No hay simulación activa"}), 400
    try:
        # Si la simulación ya terminó, no procesar nada y devolver terminado
        if supermercado.simulacion_terminada():
            return jsonify({"terminado": True})
        pasos = _get_param('pasos', 1, cast=int)
        for _ in range(pasos):
            if supermercado.simulacion_terminada():
                # Si termina en medio de los pasos, salir y devolver terminado
                return jsonify({"terminado": True})
            supermercado.actualizar_simulacion_un_segundo()
        terminado = supermercado.simulacion_terminada()
        return jsonify({"terminado": terminado})
    except Exception as e:
        return jsonify({"error": f"Error al avanzar simulación: {str(e)}"}), 500

@app.route('/api/agregar_clientes', methods=['POST'])
def agregar_clientes():
    global supermercado
    if supermercado is None:
        return jsonify({'error': 'No hay simulación activa'}), 400
    # No usamos JSON por convención: leer desde form/querystring
    cantidad = _get_param('cantidad', 1, cast=int)
    nombre_caja = _get_param('caja', None)
    tipo_cajero = _get_param('tipo_cajero', None)
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
    if tipo_cajero:
        from cajero import Cajero
        if tipo_cajero == "Principiante":
            experiencia = 1
        elif tipo_cajero == "Normal":
            experiencia = 2
        else:
            experiencia = 3
        nuevo_cajero = Cajero()
        nuevo_cajero.experiencia = experiencia
        nuevo_cajero.multiplicador_velocidad = nuevo_cajero.definir_multiplicador()
        caja_destino.cajero = nuevo_cajero
    if caja_destino == supermercado.caja_express:
        print("[DEBUG] Asignando clientes a la caja express...")
        asignados = supermercado.asignar_clientes_a_express(cantidad)
        return jsonify({'ok': True, 'asignados_express': asignados})
    else:
        print(f"[DEBUG] Asignando clientes a la caja normal: '{caja_destino.nombre}'")
        for _ in range(cantidad):
            cliente = Cliente(f"Cliente{random.randint(1000,9999)}")
            cliente.num_articulos = random.randint(10, 15)
            cliente.crear_lista_articulos()
            cliente.seleccionar_tipo_pago()
            caja_destino.clientes_en_fila.append(cliente)
        return jsonify({'ok': True})


if __name__ == '__main__':
    app.run(debug=True, port=5000)
