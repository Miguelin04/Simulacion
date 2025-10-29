class Cajero:
    def __init__(self, id, experiencia, tipo="normal"):
        self.id = id
        self.experiencia = experiencia
        self.cola_clientes = []
        self.tipo = tipo   # Express o normal
    
    def __str__(self):
        #return f"Cajero {self.id} ({self.tipo}) - Clientes en cola: {len(self.cola_clientes)} - Experiencia: {self.experiencia}"
        return f"Cajero   {self.id} >> Experiencia: {self.experiencia}"
    
    
    
    
    def agregar_cliente(self, cliente):
        self.cola_clientes.append(cliente)
        #print(f"Cliente {cliente.id} => Caja {self.id}")
    
    def puede_atender(self, cliente):
        """Verifica si este cajero puede atender al cliente"""
        if self.tipo == "express":
            return len(cliente.articulos) <= 10
        return True  # Cajeros normales no tienen restricciones