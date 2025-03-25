# Instrucciones

## Uso de Baileys Modificado

Este proyecto no utiliza la versión original de Baileys. En su lugar, se utiliza una versión modificada por el equipo de Nazi Team. Todos los comandos y funcionalidades han sido implementados de acuerdo a la solicitud del comprador.

## Configuración de Mensajes Personalizados

Para modificar los mensajes de Bienvenida, Despedida, Promover, Degradar y Modificar del grupo, se utilizan los siguientes comandos:

- `setWelcome`
- `setBye`
- `setDemote`
- `setPromote`
- `setModify`

Estos mensajes deben contener ciertas características que luego serán reemplazadas automáticamente. Los marcadores que se pueden utilizar son:

- `@group`: Será reemplazado por el ID del grupo.
- `@action`: Será reemplazado por la acción realizada (añadido, eliminado, promovido, degradado, modificado).
- `@user`: Será reemplazado por el usuario afectado.
- `@time`: Será reemplazado por la fecha y hora actuales.
- `@desc`: Será reemplazado por la descripción del grupo.

Asegúrese de incluir estos marcadores en los mensajes personalizados para que se reemplacen correctamente.

## Ejemplo de Mensaje Personalizado

```text
Bienvenido a @group!
@action
Usuario: @user
Hora: @time
Descripción: @desc
```

Este mensaje se personalizará automáticamente con la información correspondiente cuando se realice una acción en el grupo.