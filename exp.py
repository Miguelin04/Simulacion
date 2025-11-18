import os
import random
import math
import csv
from datetime import datetime
from collections import defaultdict
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt


VALORES_S = [1, 2, 3, 4]        # número de cajas a evaluar
R = 10                          # réplicas por configuración (>=10)
TIEMPO_SIM = 240.0              # minutos por réplica (ej: 4 horas = 240)
SEED_BASE = 1000

# Parámetros de costos (ajusta si es necesario)
c_caja = 0.18       # USD / min por caja activa
c_espera = 0.09     # USD / min por cliente (tiempo en sistema)
c_SLA = 2.0         # USD por punto porcentual de incumplimiento
SLA_objetivo = 0.80 # 80% clientes con tiempo en sistema <= umbral_SLA
umbral_SLA = 8.0    # minutos

# Parámetros de sensibilidad (factor multiplicativo)
SENS_LAMBDAS = [0.8, 0.9, 1.0, 1.1, 1.2]  # ±20%, ±10% y base
SENS_SERVICE = [0.8, 0.9, 1.0, 1.1, 1.2]

# Resultados output
OUTPUT_DIR = "resultados"

def crear_simulacion(s, seed, params):
    random.seed(seed)
    np.random.seed(seed + 1)

    # --- DUMMY SIM: si no editas, el experimento correrá pero con datos sintéticos ---
    class DummySim:
        def __init__(self, s, params):
            self.s = s
            self.params = params
            self.custom_storage = {}

        def run(self, tmin):
            # simula métricas con alguna lógica plausible
            lam = params['lambda']
            mu = params['mu']
            rho = lam / (s * mu) if s * mu > 0 else 1.0
            # generar promedios dependiendo de rho
            ET = max(0.5, 1.0 / mu + max(0, (rho - 0.7) * 10.0))
            Lq = max(0.0, (rho**3) * 10.0)
            pct_sla = max(0.0, 1.0 - max(0.0, (rho - 0.7) * 1.2))
            # almacenar
            self.custom_storage['ET'] = ET + np.random.normal(0, ET * 0.05)
            self.custom_storage['Lq'] = Lq + np.random.normal(0, max(0.2, Lq * 0.1))
            self.custom_storage['pct_sla'] = min(1.0, max(0.0, pct_sla + np.random.normal(0, 0.03)))
            self.custom_storage['rho'] = min(0.999, max(0.0, rho + np.random.normal(0, 0.02)))
            # also store sum_time_in_system and total_customers for cost calc
            avg_time = self.custom_storage['ET']
            total_customers = int(lam * tmin * np.random.uniform(0.9,1.1))
            self.custom_storage['sum_time_in_system'] = avg_time * total_customers
            self.custom_storage['total_customers'] = total_customers

    params = params.copy()
    return DummySim(s, params)

def ejecutar_simulacion(sim, tiempo_minutos):
    # si tu objeto tiene método run(tmin) úsalo
    if hasattr(sim, "run"):
        sim.run(tiempo_minutos)
    else:
        raise RuntimeError("Por favor adapta ejecutar_simulacion() para llamar a tu API de simulación")

def extraer_metricas(sim):
    if hasattr(sim, "custom_storage"):
        cs = sim.custom_storage
        return {
            "E_T": cs.get("ET", None),
            "Lq": cs.get("Lq", None),
            "pct_sla": cs.get("pct_sla", None),
            "rho": cs.get("rho", None),
            "sum_time_in_system": cs.get("sum_time_in_system", None),
            "total_customers": cs.get("total_customers", None)
        }
    else:
        raise RuntimeError("Por favor adapta extraer_metricas() para devolver las métricas desde tu simulador")

def calcular_CT(s, sum_time_in_system, tiempo_sim, pct_sla):
    incumplimiento_pct = max(0.0, SLA_objetivo - pct_sla) * 100.0  # en puntos porcentuales
    cost = c_caja * (s * tiempo_sim) + c_espera * (sum_time_in_system) + c_SLA * incumplimiento_pct
    return cost

def correr_experimento(lambda_base, mu_base, valores_s=VALORES_S, R_replicas=R, tiempo_sim=TIEMPO_SIM, outdir=OUTPUT_DIR):
    os.makedirs(outdir, exist_ok=True)
    registros = []

    params_base = {'lambda': lambda_base, 'mu': mu_base}

    for s in valores_s:
        for r in range(R_replicas):
            seed = SEED_BASE + r + s * 100
            sim = crear_simulacion(s, seed, params_base)
            ejecutar_simulacion(sim, tiempo_sim)
            m = extraer_metricas(sim)

            # seguridad: llenar campos faltantes
            ET = float(m.get("E_T", float("nan")))
            Lq = float(m.get("Lq", float("nan")))
            pct_sla = float(m.get("pct_sla", 0.0))
            rho = float(m.get("rho", float("nan")))
            sum_time = float(m.get("sum_time_in_system", 0.0))
            total_customers = int(m.get("total_customers", max(1, int(lambda_base * tiempo_sim))))

            CT = calcular_CT(s, sum_time, tiempo_sim, pct_sla)

            registros.append({
                "s": s,
                "replica": r,
                "seed": seed,
                "E_T": ET,
                "Lq": Lq,
                "pct_sla": pct_sla,
                "rho": rho,
                "sum_time_in_system": sum_time,
                "total_customers": total_customers,
                "CT": CT
            })

            print(f"[s={s} r={r}] ET={ET:.3f} Lq={Lq:.3f} pct_sla={pct_sla:.3f} rho={rho:.3f} CT={CT:.2f}")

    df = pd.DataFrame(registros)
    csv_path = os.path.join(outdir, "matriz_corridas.csv")
    df.to_csv(csv_path, index=False)
    print("Matriz de corridas guardada en:", csv_path)

    # agrupar y graficar
    resumen = df.groupby("s").agg({
        "E_T": ["mean", "std"],
        "Lq": ["mean", "std"],
        "pct_sla": ["mean", "std"],
        "rho": ["mean", "std"],
        "CT": ["mean", "std"]
    })
    resumen.columns = ["_".join(col).strip() for col in resumen.columns.values]
    resumen = resumen.reset_index()
    resumen_path = os.path.join(outdir, "resumen_por_s.csv")
    resumen.to_csv(resumen_path, index=False)
    print("Resumen por s guardado en:", resumen_path)

    graficar_resumen(resumen, outdir)
    return df, resumen

def graficar_resumen(resumen_df, outdir):
    s = resumen_df['s']
    ct_mean = resumen_df['CT_mean']
    sla_mean = resumen_df['pct_sla_mean']
    rho_mean = resumen_df['rho_mean']

    plt.figure()
    plt.plot(s, ct_mean, marker='o')
    plt.xlabel("Número de cajas (s)")
    plt.ylabel("Costo total medio (CT)")
    plt.title("CT vs s")
    plt.grid(True)
    plt.savefig(os.path.join(outdir, "ct_vs_s.png"))
    plt.close()

    plt.figure()
    plt.plot(s, sla_mean, marker='o')
    plt.xlabel("Número de cajas (s)")
    plt.ylabel("% SLA (fracción)")
    plt.title("%SLA vs s")
    plt.grid(True)
    plt.savefig(os.path.join(outdir, "sla_vs_s.png"))
    plt.close()

    plt.figure()
    plt.plot(s, rho_mean, marker='o')
    plt.xlabel("Número de cajas (s)")
    plt.ylabel("Utilización ρ (media)")
    plt.title("ρ vs s")
    plt.grid(True)
    plt.savefig(os.path.join(outdir, "rho_vs_s.png"))
    plt.close()

    print("Gráficos guardados en:", outdir)

def analisis_sensibilidad(lambda_base, mu_base, valores_s=VALORES_S, R_replicas=R, tiempo_sim=TIEMPO_SIM, outdir=OUTPUT_DIR):
    os.makedirs(outdir, exist_ok=True)
    filas = []
    for lf in SENS_LAMBDAS:
        for sf in SENS_SERVICE:
            lam = lambda_base * lf
            mu = mu_base * sf
            df, resumen = correr_experimento(lam, mu, valores_s=valores_s, R_replicas=R_replicas, tiempo_sim=tiempo_sim, outdir=outdir)
            # tomar CT medio por s
            for _, row in resumen.iterrows():
                filas.append({
                    "lambda_factor": lf,
                    "service_factor": sf,
                    "s": int(row['s']),
                    "CT_mean": row['CT_mean'],
                    "SLA_mean": row['pct_sla_mean'],
                    "rho_mean": row['rho_mean']
                })
    df_sens = pd.DataFrame(filas)
    path = os.path.join(outdir, "sensibilidad.csv")
    df_sens.to_csv(path, index=False)
    print("Sensibilidad guardada en:", path)
    return df_sens

def proponer_regla(resumen_df, rho_umbral=0.85, ventana_min=5):
  
    # encontrar el s más pequeño con CT medio mínimo
    mejor = resumen_df.loc[resumen_df['CT_mean'].idxmin()]
    regla = {
        "regla_text": f"Abrir nueva caja cuando la utilización promedio por caja (ρ) supere {rho_umbral:.2f} en la ventana de {ventana_min} minutos.",
        "s_optimo": int(mejor['s']),
        "CT_optimo": float(mejor['CT_mean'])
    }
    return regla

def main():
    # Valores base de tasa de llegadas y servicio (ajusta según tus datos)
    lambda_base = 0.45   # clientes / min
    mu_base = 1.0 / 4.2  # servicio (clientes / min) si tiempo medio servicio = 4.2 min => mu=1/4.2

    print("Ejecutando experimento con s:", VALORES_S, "R:", R)
    df, resumen = correr_experimento(lambda_base, mu_base)
    print("Resumen:\n", resumen)

    regla = proponer_regla(resumen)
    print("Regla propuesta:", regla["regla_text"])
    print("s_optimo:", regla["s_optimo"], "CT_optimo:", regla["CT_optimo"])

    # análisis de sensibilidad (opcional, comentar si quieres acelerar)
    print("Iniciando análisis de sensibilidad (esto repetirá experimentos para cada factor)...")
    df_sens = analisis_sensibilidad(lambda_base, mu_base)
    print("Análisis de sensibilidad finalizado.")

if __name__ == "__main__":
    main()
