


class Cliente:
    def __init__(self, id, dificultad_atencion):

        self.id = id
        #falta la lista de los artículos que están en su otra clase.
        self.dificultad_atencion = dificultad_atencion


    def __str__(self):
            return f"Cliente ID: {self.id}"
        

    def observar_cajas(self, cajas):
        # necesito el método para poder observar otras cajas y elegir la que esté más vacía.
        pass




