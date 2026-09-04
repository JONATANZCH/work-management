# Especificación - Sistema de Gestión de Trabajo GEEST

## 1. Arquitectura y Stack Técnico
- Plataforma: Node.js con TypeScript.
- Framework: NestJS.
- Base de datos: MySQL.
- ORM: Prisma.
- Mejora técnica (Extra): Implementación del patrón Transactional Outbox y una Dead Letter Queue (DLQ) para resiliencia en notificaciones.

## 2. Modelo de Datos (MySQL)
- **User:** id, name, lastName, email.
- **Task:** id, title, description, status (open | archived).
- **TaskAssignment:** taskId, userId, isCompleted.
- **NotificationLog:** id, taskId, attemptNumber, status, timestamp.
- **IdempotencyKey:** key, responseBody.
- **DeadLetterQueue:** id, taskId, payload, reason, failedAt (Para almacenar notificaciones que fallaron sus 3 intentos).

## 3. Endpoints a Implementar
- **Regla Global POST:** Todo endpoint POST debe requerir el header `Idempotency-Key` y garantizar su validación[cite: 3]. Todos los errores deben usar el formato `{ "error": { "code": "...", "message": "..." } }`[cite: 3].

- `POST /users`: Recibe { "name", "lastName", "email" }. Registra usuario con ID único y retorna la info. **Debe devolver error si falta información obligatoria o si el email no es válido**[cite: 3].
- `POST /tasks`: Recibe { "title" (obligatorio), "description" (opcional) }. Registra tarea con ID único y estado "open" por defecto. **Debe devolver error si falta el título**[cite: 3].
- `POST /tasks/:idTask/assign`: Recibe { "userIds": [...] }. Asigna usuarios a la tarea. **Debe devolver error si algún usuario o la tarea no existen**[cite: 3]. Si ya está asignado, no duplicar la relación. Retorna mensaje de éxito[cite: 3].
- `POST /tasks/:idTask/complete`: Recibe { "userId" }. **Debe devolver error si usuario/tarea no existen, o si el usuario no está asignado a esa tarea**[cite: 3]. Marca la parte del usuario como completada. Si todos los asignados terminaron, la tarea cambia a "archived"[cite: 3] y registra la intención de notificación en la misma transacción (Outbox).
- `GET /tasks`: Lista todas las tareas indicando qué usuarios ya completaron su parte[cite: 3]. Acepta query opcional `?status=open|archived` para filtrar[cite: 3].
- `GET /users`: Lista usuarios registrados mostrando su información básica y sus tareas pendientes[cite: 3].
- `GET /users/:idUser/tasks`: Lista todas las tareas asignadas al usuario indicando si ya completó su parte en cada una[cite: 3].
- `GET /tasks/:idTask`: Retorna la info completa de la tarea (título, descripción, estado) y los usuarios asignados, indicando quiénes ya completaron su parte[cite: 3].
- `GET /tasks/:idTask/notifications`: Lista los intentos de envío de notificación (número, timestamp, status HTTP) de esa tarea[cite: 3].

## 4. Workers Asíncronos
- **Notification Worker:** Lee eventos Outbox y hace POST a la URL de la variable `NOTIFY_URL` enviando `{ "taskId": 123, "title": "...", "archivedAt": "..." }`. Si falla (5xx), reintenta hasta 3 veces con espera creciente. Si agota los 3 intentos, mueve el registro a la tabla `DeadLetterQueue`.