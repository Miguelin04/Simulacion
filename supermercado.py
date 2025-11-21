from Caja import Caja
from cliente import Cliente, demanda_multiplier
import random
import datetime

# Nota: Este archivo extiende la simulación original para incluir:
# - Variación de demanda por día/hora
# - Registro de utilización del sistema para reglas de apertura de cajas
# - Cálculo de costos (costo por hora de cajeros, costo de espera y penalizaciones SLA)

class Supermercado:
   
    def asignar_clientes_a_express(self, num_clientes):
        print(f"Agregando {num_clientes} clientes a la caja express...")
        for i in range(num_clientes):
            cliente = Cliente(f"ClienteExpress_{i+1}")
            # Aseguramos que el cliente tenga al menos 10 artículos
            cliente.num_articulos = random.randint(10, 15)
            cliente.crear_lista_articulos()
            cliente.seleccionar_tipo_pago()
            self.todos_los_clientes.append(cliente)
            self.caja_express.clientes_en_fila.append(cliente)
            print(f"  - {cliente.nombre} con {cliente.num_articulos} artículos agregado a express")
        print(f"Total en express: {len(self.caja_express.clientes_en_fila)}")
        return len(self.caja_express.clientes_en_fila)
    
    def asignar_clientes_random(self, num_clientes):
        # Ajustar demanda según día/hora antes de asignar
        num_clientes = self.ajustar_num_clientes_por_demanda(num_clientes)
        # Asignar clientes de forma aleatoria respetando la lógica de la caja express
        from cajero import Cajero
        for i in range(num_clientes):
            cliente = Cliente(f"Cliente_{i+1}")
            # Ya el mínimo es 10 por la clase Cliente
            cliente.crear_lista_articulos()
            cliente.seleccionar_tipo_pago()
            self.todos_los_clientes.append(cliente)
            # Solo puede ir a la express si tiene <=10 artículos y el cajero es Experto o Normal
            puede_express = cliente.num_articulos <= 10 and self.caja_express.cajero.experiencia in [2,3]
            # Si puede ir a express, lo añadimos a la express; en caso contrario, lo añadimos
            # a una caja normal aleatoria. Evitar duplicados (no añadir a ambas).
            if puede_express:
                self.caja_express.clientes_en_fila.append(cliente)
            else:
                # Todos los clientes que no vayan a express se asignan a una caja normal
                if self.cajas:
                    random.choice(self.cajas).clientes_en_fila.append(cliente)
                else:
                    # Si por alguna razón no hay cajas normales, agregar a express como fallback
                    self.caja_express.clientes_en_fila.append(cliente)
   
    def __init__(self, num_clientes, num_cajas=3):
        self.cajas = [Caja(0, nombre=f"Caja {i+1}") for i in range(num_cajas)]  # Cajas normales
        # Crear caja express solo con cajero Normal o Experto
        from cajero import Cajero
        cajero_express = Cajero()
        while cajero_express.experiencia == 1:  
            cajero_express = Cajero()
        self.caja_express = Caja(0, nombre="Caja Express")
        self.caja_express.cajero = cajero_express
        self.todos_los_clientes = []
        # Cliente rojo fijo para toda la simulación
        self.cliente_rojo = Cliente("Cliente Rojo")
        self.cliente_rojo.crear_lista_articulos()
        self.cliente_rojo.metodo_pago = "Efectivo"
        # --- Parámetros y estado adicionales para la nueva lógica de negocio ---
        # Día (0=lunes ... 6=domingo) y hora (0-23). Si no se especifica, usar fecha/hora actuales.
        ahora = datetime.datetime.now()
        self.dia = ahora.weekday()  # 0..6
        self.hora = ahora.hour
        # NOTA: No se generan llegadas automáticas por defecto por segundo.
        # La entrada de clientes se controla mediante los métodos existentes
        # (`asignar_clientes_random` o `asignar_clientes_a_express`) y se ajusta
        # mediante `ajustar_num_clientes_por_demanda` según día/hora.
        # Registro temporal de utilización (lista de 0..1 valores por segundo)
        self.utilizacion_registro = []
        # Parámetros adicionales configurables
        # Tasa base de llegadas por segundo (si se desea usar llegada automática)
        self.tasa_base_llegadas_por_segundo = 0.0
        # Sueldo base por defecto que se aplicará a nuevos cajeros (y puede aplicarse a existentes)
        # Se ajusta al valor solicitado por el usuario (400 moneda/mes en el análisis entregado).
        self.default_sueldo_base = 400.0
        # Asegurar que los cajeros iniciales respeten el sueldo por defecto
        for caja in self.cajas:
            try:
                caja.cajero.sueldo_base = self.default_sueldo_base
            except Exception:
                pass
        try:
            self.caja_express.cajero.sueldo_base = self.default_sueldo_base
        except Exception:
            pass
        # Umbrales y costos configurables
        self.max_cajas = 10
        self.costo_espera_por_cliente = 0.05  # costo por segundo de espera por cliente (valor por defecto)
        self.sla_umbral = 120.0  # si el tiempo promedio en fila (s) supera este umbral, penalizar
        self.penalizacion_sla = 50.0  # penalización fija (puede adaptarse a la duración de exceso)
        # Umbrales para abrir caja automática
        self.lq_umbral = 5.0  # Lq* : umbral de longitud promedio de colas
        self.rho_umbral = 0.75  # ρ* : umbral de utilización
        self.rho_periodo = 30  # periodo (s) sobre el que promediar la utilización
        # Por defecto, la apertura automática de cajas está deshabilitada.
        # El usuario puede abrir cajas manualmente mediante la interfaz o un endpoint.
        self.auto_open_enabled = False
        # Registro de pérdidas por segundo (última hora -> 3600s).
        # Cada entrada es la pérdida detectada en ese segundo (float >= 0).
        self.perdidas_por_segundo = []
        # Total de pérdidas observado en la última iteración (para calcular diffs)
        self._perdidas_total_prev = 0.0

    def asignar_clientes(self, num_clientes):
        for i in range(num_clientes):
            cliente = Cliente(f"Cliente_{i+1}")
            cliente.crear_lista_articulos()
            cliente.seleccionar_tipo_pago()
            self.todos_los_clientes.append(cliente)
        # No asignar a ninguna caja aquí

    def actualizar_simulacion_un_segundo(self):
        """
        Actualizar la simulación un segundo.
        - Actualiza cada caja (esto internamente acumula horas trabajadas por cajero).
        - Registra la utilización del sistema para la regla de apertura automática.
        - Evalúa Lq y utilización promedio y abre nuevas cajas si aplica.
        """
        # Actualizar todas las cajas
        for caja in self.cajas:
            caja.actualizar_simulacion_un_segundo()
        self.caja_express.actualizar_simulacion_un_segundo()

        # NOTA: el reloj interno de simulación no avanza la hora/día automáticamente.
        # Si se desea simular avance temporal, el controlador que use esta clase
        # puede actualizar `self.dia` y `self.hora` manualmente antes de llamar
        # a `actualizar_simulacion_un_segundo()` para que `ajustar_num_clientes_por_demanda`
        # use valores correctos cuando se asignen clientes.

        # Registrar utilización actual: fracción de cajeros ocupados
        servidores = len(self.cajas) + 1  # normales + express
        ocupados = 0
        for caja in self.cajas:
            if caja.cliente_actual is not None or len(caja.clientes_en_fila) > 0:
                ocupados += 1
        if self.caja_express.cliente_actual is not None or len(self.caja_express.clientes_en_fila) > 0:
            ocupados += 1
        rho_actual = float(ocupados) / float(max(1, servidores))
        self.utilizacion_registro.append(rho_actual)
        # Mantener solo los últimos rho_periodo segundos
        if len(self.utilizacion_registro) > self.rho_periodo:
            self.utilizacion_registro.pop(0)

        # Calcular Lq (longitud promedio de colas)
        longitudes = [len(caja.clientes_en_fila) for caja in self.cajas] + [len(self.caja_express.clientes_en_fila)]
        lq_promedio = sum(longitudes) / float(len(longitudes)) if longitudes else 0.0

        # Registrar nuevas pérdidas detectadas en este segundo: sumar diferencia con el total previo
        try:
            actuales_perdidas = 0.0
            for caja in self.cajas + [self.caja_express]:
                actuales_perdidas += float(getattr(caja, 'perdida_total', 0.0))
            diff = max(0.0, actuales_perdidas - float(self._perdidas_total_prev))
            # Añadir la pérdida detectada en este segundo (puede ser 0)
            self.perdidas_por_segundo.append(diff)
            # Mantener sólo la última hora (3600 segundos)
            if len(self.perdidas_por_segundo) > 3600:
                self.perdidas_por_segundo.pop(0)
            self._perdidas_total_prev = actuales_perdidas
        except Exception:
            # Si falla el registro de pérdidas, seguir sin interrumpir la simulación
            pass

        # Revisar regla de apertura automática
        try:
            # Promedio de utilización en el periodo registrado
            rho_promedio = sum(self.utilizacion_registro) / float(len(self.utilizacion_registro))
        except ZeroDivisionError:
            rho_promedio = 0.0

        # Si se supera alguno de los umbrales y la apertura automática está habilitada,
        # intentar abrir nueva caja. Por defecto está deshabilitado para respetar el
        # control manual de cajas solicitado por el usuario.
        if self.auto_open_enabled and (lq_promedio > self.lq_umbral or rho_promedio > self.rho_umbral):
            self.abrir_nueva_caja_si_necesario()

    def abrir_caja_manual(self):
        """
        Abrir una nueva caja manualmente (sin verificar umbrales).
        Se crea la caja y se rebalancean clientes desde la cola más larga hacia la nueva caja.
        Devuelve True si se creó correctamente.
        """
        try:
            nueva = Caja(0, nombre=f"Caja {len(self.cajas)+1}")
            try:
                nueva.cajero.sueldo_base = self.default_sueldo_base
            except Exception:
                pass
            self.cajas.append(nueva)
            # Rebalancear similar a la apertura automática
            if self.cajas:
                # buscar la caja normal con la cola más larga
                colas = [(len(c.clientes_en_fila), idx) for idx, c in enumerate(self.cajas[:-1])] if len(self.cajas) > 1 else [(len(self.cajas[0].clientes_en_fila), 0)]
                if not colas:
                    origen_idx = 0
                else:
                    origen_idx = max(colas, key=lambda x: x[0])[1]
                origen = self.cajas[origen_idx]
                num_origen = len(origen.clientes_en_fila)
                if num_origen > 0:
                    mover = (num_origen + 1) // 2
                    for _ in range(mover):
                        if origen.clientes_en_fila:
                            cliente_mov = origen.clientes_en_fila.pop(0)
                            nueva.clientes_en_fila.append(cliente_mov)
            print(f"[SISTEMA] Apertura manual de nueva caja: {nueva.nombre}")
            return True
        except Exception:
            return False

    def simulacion_terminada(self):
        return all(caja.simulacion_terminada() for caja in self.cajas) and self.caja_express.simulacion_terminada()

    def obtener_estado(self):
        # Usar el cliente rojo fijo
        cliente_rojo_articulos = self.cliente_rojo.num_articulos
        tiempos_rojo = []
        cajas_estado = []
        for idx, caja in enumerate(self.cajas):
            estado, tiempo_rojo = self._estado_caja(caja, idx+1)
            cajas_estado.append(estado)
            tiempos_rojo.append((f"Caja {idx+1}", tiempo_rojo))
        estado_express, tiempo_rojo_express = self._estado_caja(self.caja_express, 'Express')
        tiempos_rojo.append(("Caja Express", tiempo_rojo_express))
        resumen = self._comparar_tiempos_rojo(tiempos_rojo)
        return {
            'cajas': cajas_estado,
            'caja_express': estado_express,
            'cliente_rojo_articulos': cliente_rojo_articulos,
            'resumen_comparacion': resumen,
            'costo_total': self.calcular_costo_total(),
            'perdidas_por_caja': { c.nombre: getattr(c, 'perdida_total', 0.0) for c in self.cajas + [self.caja_express] },
            # Devolver solo la cantidad de cajas normales. La caja express
            # se gestiona por separado para evitar mostrar siempre +1.
            'num_cajas_actuales': len(self.cajas)
        }

    def _estado_caja(self, caja, nombre):
        # Calcular tiempo de atención estimado para cada cliente en la fila
        fila = caja.clientes_en_fila + ([caja.cliente_actual] if caja.cliente_actual else [])
        tiempo_acumulado = 0
        clientes_fila = []
        for cliente in fila:
            if cliente:
                tiempo_cliente = cliente.calcular_tiempo_atencion(
                    caja.cajero.multiplicador_velocidad,
                    experiencia_cajero=caja.cajero.experiencia,
                    metodo_pago=cliente.metodo_pago
                )
                tiempo_acumulado += tiempo_cliente
                clientes_fila.append({
                    'nombre': cliente.nombre,
                    'articulos': cliente.num_articulos,
                    'tiempo_estimado': tiempo_cliente
                })
        # Usar el cliente rojo fijo
        cliente_rojo = self.cliente_rojo
        # Si es la caja express, limitar a 10 artículos
        if str(nombre).lower() == 'express' and cliente_rojo.num_articulos > 10:
            num_articulos_original = cliente_rojo.num_articulos
            cliente_rojo.num_articulos = 10
            cliente_rojo.crear_lista_articulos()
        tiempo_rojo = cliente_rojo.calcular_tiempo_atencion(
            caja.cajero.multiplicador_velocidad,
            experiencia_cajero=caja.cajero.experiencia,
            metodo_pago=cliente_rojo.metodo_pago
        )
        tiempo_total = tiempo_acumulado + tiempo_rojo
        clientes_fila.append({
            'nombre': cliente_rojo.nombre,
            'articulos': cliente_rojo.num_articulos,
            'tiempo_estimado': tiempo_rojo,
            'es_rojo': True
        })
        # Restaurar el número de artículos si fue modificado
        if str(nombre).lower() == 'express' and hasattr(self.cliente_rojo, 'num_articulos') and 'num_articulos_original' in locals():
            self.cliente_rojo.num_articulos = num_articulos_original
            self.cliente_rojo.crear_lista_articulos()
        return {
            'nombre': f"Caja {nombre}",
            'cajero': {
                'experiencia': self._exp_to_str(caja.cajero.experiencia),
                'multiplicador': caja.cajero.multiplicador_velocidad
            },
            'en_fila': clientes_fila,
            'atendiendo': {'nombre': caja.cliente_actual.nombre, 'articulos': caja.cliente_actual.num_articulos} if caja.cliente_actual else None,
            'atendidos': [
                {'nombre': c.nombre, 'articulos': c.num_articulos} for c in caja.clientes_atendidos
            ],
            'perdidas': getattr(caja, 'perdida_total', 0.0),
            'clientes_perdidos': len(getattr(caja, 'clientes_perdidos', [])),
            'cliente_rojo': {
                'articulos': clientes_fila[-1]['articulos'],
                'tiempo_estimado': tiempo_total
            }
        }, tiempo_total

    def _exp_to_str(self, exp):
        if exp == 1:
            return 'Principiante'
        elif exp == 2:
            return 'Normal'
        else:
            return 'Experto'

    def _comparar_tiempos_rojo(self, tiempos):
        # tiempos: lista de (nombre_caja, tiempo)
        tiempos_ordenados = sorted(tiempos, key=lambda x: x[1])
        mejor = tiempos_ordenados[0]
        resumen = f"La mejor caja para el cliente rojo es {mejor[0]} con {mejor[1]}s.\n"
        resumen += "Comparación de tiempos: "
        resumen += ", ".join([f"{nombre}: {tiempo}s" for nombre, tiempo in tiempos])
        return resumen

    # -------------------- Nuevos métodos de negocio añadidos --------------------
    def ajustar_num_clientes_por_demanda(self, num_clientes, dia=None, hora=None):
        """
        Ajusta la cantidad de clientes de entrada según el día y la franja horaria.
        Reglas implementadas:
        - viernes (4): +5%
        - sábado (5): +10%
        - domingo (6): +15%
        - entre 12:00 y 14:00 (12 <= hora < 14): +2% adicional
        Devuelve un entero con el número ajustado de clientes.
        """
        dia = self.dia if dia is None else dia
        hora = self.hora if hora is None else hora
        # Usar la función centralizada definida en cliente.py
        mult = demanda_multiplier(dia, hora)
        num_ajustado = int(round(num_clientes * mult))
        return max(0, num_ajustado)

    def calcular_tiempo_total_en_filas(self):
        """
        Calcula el tiempo total (en segundos) que todos los clientes en fila
        aún deben ser atendidos, usando las estimaciones actuales.
        """
        total = 0
        # Sumar tiempos estimados en cajas normales
        for caja in self.cajas + [self.caja_express]:
            # incluir cliente actual si existe
            fila = caja.clientes_en_fila + ([caja.cliente_actual] if caja.cliente_actual else [])
            for cliente in fila:
                if cliente:
                    tiempo = cliente.calcular_tiempo_atencion(
                        caja.cajero.multiplicador_velocidad,
                        experiencia_cajero=caja.cajero.experiencia,
                        metodo_pago=cliente.metodo_pago
                    )
                    total += tiempo
        return total

    def calcular_costo_total(self):
        """
        Calcula el costo total del supermercado según la fórmula:
        costo_total = sum(costo_por_hora de cada cajero) + (costo_espera_por_cliente * tiempo_en_filas)
                     + penalización_SLA si el tiempo promedio supera el umbral
        """
        # 1) Sumatoria de costo_por_hora de cada cajero
        suma_costos_hora = 0.0
        for caja in self.cajas + [self.caja_express]:
            try:
                suma_costos_hora += caja.cajero.costo_por_hora()
            except Exception:
                # Si el cajero no tiene el método, ignorar y continuar
                pass

        # 2) Costo de espera: costo_espera_por_cliente * tiempo total en filas
        tiempo_en_filas = self.calcular_tiempo_total_en_filas()
        costo_espera = float(self.costo_espera_por_cliente) * float(tiempo_en_filas)

        # 3) Penalización SLA: si el tiempo promedio por cliente en fila supera sla_umbral
        # Calculamos tiempo promedio como tiempo_en_filas / numero_clientes_en_fila
        num_clientes_en_fila = sum(len(caja.clientes_en_fila) for caja in self.cajas + [self.caja_express])
        penalizacion = 0.0
        if num_clientes_en_fila > 0:
            tiempo_promedio = float(tiempo_en_filas) / float(num_clientes_en_fila)
            if tiempo_promedio > float(self.sla_umbral):
                penalizacion = float(self.penalizacion_sla)

        costo_total = suma_costos_hora + costo_espera + penalizacion
        # Añadir pérdidas por abandonos de clientes como parte del costo total
        try:
            perdidas_total = 0.0
            for caja in self.cajas + [self.caja_express]:
                perdidas_total += float(getattr(caja, 'perdida_total', 0.0))
            costo_total += perdidas_total
        except Exception:
            pass
        return costo_total

    def evaluar_abrir_por_perdida(self, costo_apertura: float, penalizacion_apertura: float = 0.0) -> bool:
        """
        Evaluar si conviene abrir una nueva caja basándose en las pérdidas actuales
        por abandonos. Devuelve True si las pérdidas acumuladas superan el costo
        de apertura + penalización.
        """
        perdidas_total = 0.0
        for caja in self.cajas + [self.caja_express]:
            perdidas_total += float(getattr(caja, 'perdida_total', 0.0))
        # Si las pérdidas totales superan el umbral económico simple
        if perdidas_total > (float(costo_apertura) + float(penalizacion_apertura)):
            return True
        # Evaluar pérdidas en la última hora frente al 50% del sueldo horario
        try:
            perdidas_ultima_hora = sum(self.perdidas_por_segundo)
            from cajero import Cajero
            cajero_tmp = Cajero()
            try:
                cajero_tmp.sueldo_base = float(self.default_sueldo_base)
            except Exception:
                pass
            costo_hora_cajero = cajero_tmp.costo_por_hora()
            if perdidas_ultima_hora > 0.5 * float(costo_hora_cajero):
                return True
        except Exception:
            pass
        return False

    def abrir_nueva_caja_si_necesario(self):
        """
        Aplica la regla de negocio para abrir una nueva caja si:
        - la longitud promedio de colas Lq supera `self.lq_umbral`,
          o
        - la utilización promedio ρ en el periodo supere `self.rho_umbral`.
        Solo abre una caja si no se excede `self.max_cajas`.
        """
        # Contar sólo las cajas normales al comprobar el límite de `max_cajas`.
        # La caja express no se cuenta aquí para evitar incrementar siempre en +1.
        total_cajas_actuales = len(self.cajas)
        if total_cajas_actuales >= self.max_cajas:
            return False

        # Calcular Lq promedio actual
        longitudes = [len(caja.clientes_en_fila) for caja in self.cajas] + [len(self.caja_express.clientes_en_fila)]
        lq_promedio = sum(longitudes) / float(len(longitudes)) if longitudes else 0.0

        # Calcular rho promedio en el registro
        rho_promedio = 0.0
        if self.utilizacion_registro:
            rho_promedio = sum(self.utilizacion_registro) / float(len(self.utilizacion_registro))

        # Si alguno de los umbrales se supera, abrir una caja
        if lq_promedio > self.lq_umbral or rho_promedio > self.rho_umbral:
            # Antes de crear una nueva caja, verificar que las pérdidas en la última hora
            # justifican el costo: pérdidas_última_hora > 50% del sueldo horario del cajero.
            try:
                perdidas_ultima_hora = sum(self.perdidas_por_segundo)
                from cajero import Cajero
                cajero_tmp = Cajero()
                try:
                    cajero_tmp.sueldo_base = float(self.default_sueldo_base)
                except Exception:
                    pass
                costo_hora_cajero = cajero_tmp.costo_por_hora()
                if not (perdidas_ultima_hora > 0.5 * float(costo_hora_cajero)):
                    # No conviene abrir: pérdidas por hora no justifican el costo
                    return False
            except Exception:
                # Si falla la comprobación, continuar y abrir por seguridad
                pass

            # Crear nueva caja (con 0 clientes inicialmente)
            nueva = Caja(0, nombre=f"Caja {len(self.cajas)+1}")
            # Su cajero tendrá sueldo_base por defecto; si se desea, el llamador puede modificarlo
            try:
                nueva.cajero.sueldo_base = self.default_sueldo_base
            except Exception:
                pass
            self.cajas.append(nueva)
            # Registrar un mensaje por consola (integración con interfaz simplificada)
            print(f"[SISTEMA] Apertura automática de nueva caja: {nueva.nombre} (Lq={lq_promedio:.2f}, rho={rho_promedio:.2f})")
            # Rebalancear clientes: mover la mitad (ceil) de la cola más larga hacia la nueva caja
            try:
                # Excluir express al buscar la cola más larga
                if self.cajas:
                    colas = [(len(c.clientes_en_fila), idx) for idx, c in enumerate(self.cajas[:-1])] if len(self.cajas) > 1 else [(len(self.cajas[0].clientes_en_fila), 0)]
                    # Si no hay cajas normales registradas correctamente, tomar la primera
                    if not colas:
                        origen_idx = 0
                    else:
                        origen_idx = max(colas, key=lambda x: x[0])[1]
                    origen = self.cajas[origen_idx]
                    num_origen = len(origen.clientes_en_fila)
                    if num_origen > 0:
                        mover = (num_origen + 1) // 2  # mitad redondeando arriba
                        # Mover los primeros `mover` clientes de la cola origen a la nueva caja
                        for _ in range(mover):
                            if origen.clientes_en_fila:
                                cliente_mov = origen.clientes_en_fila.pop(0)
                                nueva.clientes_en_fila.append(cliente_mov)
                        print(f"[SISTEMA] Rebalanceo: movidos {mover} clientes de {origen.nombre} a {nueva.nombre}")
            except Exception:
                pass
            return True
        return False
