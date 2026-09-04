# Plan de Construcción — Backend GEEST
> **Stack:** NestJS · TypeScript · Prisma · MySQL  
> **Convención de orden:** Cada tarea depende únicamente de las anteriores. Ejecutarlas en orden.

---

## FASE 0 — Scaffolding & Configuración base

### TASK-01 · Inicializar proyecto NestJS
**Qué hace:** Crea el proyecto NestJS con TypeScript, instala dependencias base (`@nestjs/cli`, `class-validator`, `class-transformer`) y configura `tsconfig.json` con paths estrictos.

**Prompt exacto:**
```
Inicializa un proyecto NestJS con TypeScript en el directorio actual (./). 
Usa `npx @nestjs/cli new . --package-manager npm --skip-git` en modo no interactivo.
Luego instala: class-validator, class-transformer, @nestjs/config, dotenv.
Configura tsconfig.json con strict: true y experimentalDecorators: true.
Crea un archivo .env.example con las variables: DATABASE_URL, NOTIFY_URL, PORT.
No toques app.module.ts aún.
```

---

### TASK-02 · Configurar Prisma y schema de base de datos
**Qué hace:** Instala Prisma, inicializa el cliente y define el schema completo con los 6 modelos del dominio.

**Prompt exacto:**
```
Configura Prisma en este proyecto NestJS con MySQL.
1. Instala: prisma, @prisma/client
2. Ejecuta `npx prisma init` y configura el provider como "mysql" usando la variable DATABASE_URL del .env.
3. Define el schema.prisma con los siguientes modelos exactos:

- User: id (autoincrement PK), name (String), lastName (String), email (String @unique), createdAt (DateTime @default(now()))
- Task: id (autoincrement PK), title (String), description (String?), status (enum: open | archived, default: open), createdAt (DateTime @default(now()))
- TaskAssignment: taskId (Int), userId (Int), isCompleted (Boolean @default(false)), @@id([taskId, userId]) como PK compuesta, relaciones a Task y User
- NotificationLog: id (autoincrement PK), taskId (Int), attemptNumber (Int), status (String), timestamp (DateTime @default(now())), relación a Task
- IdempotencyKey: key (String @id), responseBody (String @db.Text), createdAt (DateTime @default(now()))
- DeadLetterQueue: id (autoincrement PK), taskId (Int), payload (String @db.Text), reason (String), failedAt (DateTime @default(now())), relación a Task

4. Genera la primera migración con: `npx prisma migrate dev --name init`
5. Genera el cliente con: `npx prisma generate`
```

---

### TASK-03 · Módulo PrismaService (singleton)
**Qué hace:** Crea un `PrismaModule` global que expone `PrismaService` como singleton inyectable en toda la app.

**Prompt exacto:**
```
Crea un PrismaModule global en src/prisma/ con arquitectura Hexagonal.
- src/prisma/prisma.service.ts: extiende PrismaClient, implementa OnModuleInit (this.$connect()) y OnModuleDestroy (this.$disconnect()). Debe ser @Injectable().
- src/prisma/prisma.module.ts: @Global() @Module que exporta PrismaService.
- Registra PrismaModule en AppModule.
No uses imports circulares. El módulo debe ser importado una sola vez desde AppModule.
```

---

### TASK-04 · Filtro de excepciones global (formato de error estricto)
**Qué hace:** Implementa un `GlobalExceptionFilter` que intercepta TODAS las excepciones y formatea la respuesta con el formato estricto `{ "error": { "code": "STRING", "message": "STRING" } }`.

**Prompt exacto:**
```
Crea un ExceptionFilter global en src/common/filters/http-exception.filter.ts que:
1. Capture todas las excepciones (implementa ExceptionFilter con el decorador @Catch()).
2. Para HttpException: extrae el status y construye la respuesta con formato ESTRICTO:
   { "error": { "code": "NOMBRE_EXCEPCION_EN_SNAKE_UPPER", "message": "descripción legible" } }
3. Para errores no-HTTP (Error genérico): responde con status 500 y code "INTERNAL_ERROR".
4. Para errores de validación de class-validator (ValidationPipe): el code debe ser "VALIDATION_ERROR" y el message debe concatenar todos los errores de validación.
5. Registra el filtro globalmente en main.ts usando app.useGlobalFilters().
6. También registra globalmente el ValidationPipe en main.ts con whitelist: true y forbidNonWhitelisted: true.
Escribe un test unitario para el filtro cubriendo los 3 casos (HttpException, genérico, validación).
```

---

### TASK-05 · Guard de Idempotencia (Idempotency-Key header)
**Qué hace:** Implementa un `IdempotencyGuard` que valida el header `Idempotency-Key` en todos los endpoints POST, consulta la tabla `idempotency_keys` y retorna la respuesta cacheada si la clave ya existe.

**Prompt exacto:**
```
Crea src/common/guards/idempotency.guard.ts como un NestJS Guard (@Injectable, implements CanActivate).
Lógica:
1. Leer el header "Idempotency-Key" del request. Si no existe, lanzar BadRequestException con code "MISSING_IDEMPOTENCY_KEY".
2. Consultar en la tabla IdempotencyKey de Prisma si la key ya existe.
3. Si existe: parsear responseBody como JSON y escribirlo directamente en el response con el mismo status code que tenga guardado. Retornar false (cortar ejecución).
4. Si no existe: guardar la key en el contexto del request (request['idempotencyKey'] = key) y retornar true.
5. Después de que el handler ejecute (usa un interceptor complementario IdempotencyInterceptor en src/common/interceptors/idempotency.interceptor.ts), guardar el response body en la tabla IdempotencyKey.
Aplica el guard con @UseGuards(IdempotencyGuard) como decorador personalizado @Idempotent() en src/common/decorators/idempotent.decorator.ts.
Escribe tests unitarios para: key ausente, key existente (retorna cache), key nueva (pasa y guarda).
```

---

## FASE 1 — Módulo Users

### TASK-06 · Módulo Users — estructura y repositorio
**Qué hace:** Crea el módulo `UsersModule` con arquitectura hexagonal: entidad de dominio, repositorio Prisma, casos de uso vacíos.

**Prompt exacto:**
```
Crea el módulo Users en src/users/ con esta estructura hexagonal:
- src/users/domain/user.entity.ts: clase User con propiedades: id, name, lastName, email, createdAt
- src/users/domain/user.repository.interface.ts: interfaz IUserRepository con métodos: create(data), findAll(), findById(id)
- src/users/infrastructure/prisma-user.repository.ts: implementa IUserRepository usando PrismaService. El método findAll() debe incluir las TaskAssignments del usuario con su Task.
- src/users/application/use-cases/: directorio vacío por ahora
- src/users/users.module.ts: declara el repositorio con token 'USER_REPOSITORY' usando { provide: 'USER_REPOSITORY', useClass: PrismaUserRepository }
No crees el controller ni los use-cases aún. Solo la estructura y el módulo.
```

---

### TASK-07 · POST /users — caso de uso y endpoint
**Qué hace:** Implementa `CreateUserUseCase`, el DTO de request con validaciones, y el endpoint `POST /users`.

**Prompt exacto:**
```
Implementa el endpoint POST /users en el módulo Users ya existente:

1. src/users/application/dto/create-user.dto.ts:
   - name: string, @IsNotEmpty()
   - lastName: string, @IsNotEmpty()
   - email: string, @IsEmail()

2. src/users/application/use-cases/create-user.use-case.ts:
   - Inyecta IUserRepository con token 'USER_REPOSITORY'
   - Si el email ya existe, lanza ConflictException con code "EMAIL_ALREADY_EXISTS"
   - Crea el usuario y retorna la entidad

3. src/users/users.controller.ts:
   - POST /users con @Idempotent() y el ValidationPipe
   - Retorna HTTP 201 con { id, name, lastName, email }

4. Registra CreateUserUseCase en UsersModule.providers y agrega UsersController.

Escribe tests unitarios para CreateUserUseCase cubriendo: éxito, email duplicado.
```

---

### TASK-08 · GET /users — endpoint con tareas pendientes
**Qué hace:** Implementa `GetUsersUseCase` y el endpoint `GET /users` que lista usuarios con sus tareas donde `isCompleted = false` y `status = open`.

**Prompt exacto:**
```
Implementa el endpoint GET /users en el módulo Users:

1. src/users/application/use-cases/get-users.use-case.ts:
   - Llama a userRepository.findAll()
   - Mapea el resultado: por cada usuario, filtra sus TaskAssignments donde isCompleted=false Y task.status='open'
   - Retorna: [{ id, name, lastName, email, pendingTasks: [{ id, title, status }] }]

2. Agrega GET /users al UsersController, retorna HTTP 200.

3. Agrega GetUsersUseCase a UsersModule.providers.

Escribe test unitario para GetUsersUseCase cubriendo: lista vacía, usuario sin tareas pendientes, usuario con tareas pendientes mixtas.
```

---

### TASK-09 · GET /users/:idUser/tasks — tareas de un usuario
**Qué hace:** Implementa `GetUserTasksUseCase` y el endpoint `GET /users/:idUser/tasks`.

**Prompt exacto:**
```
Implementa el endpoint GET /users/:idUser/tasks en el módulo Users:

1. Agrega findByIdWithTasks(id) a IUserRepository y su implementación en PrismaUserRepository.
   - Include: TaskAssignment con Task incluida

2. src/users/application/use-cases/get-user-tasks.use-case.ts:
   - Si el usuario no existe, lanza NotFoundException con code "USER_NOT_FOUND"
   - Retorna: [{ taskId, title, status, isCompleted }]

3. Agrega GET /users/:idUser/tasks al UsersController, retorna HTTP 200.

Escribe tests unitarios cubriendo: usuario no encontrado, usuario con tareas (mix de completadas y pendientes).
```

---

## FASE 2 — Módulo Tasks

### TASK-10 · Módulo Tasks — estructura y repositorio
**Qué hace:** Crea el módulo `TasksModule` con arquitectura hexagonal: entidad, repositorio Prisma, módulo.

**Prompt exacto:**
```
Crea el módulo Tasks en src/tasks/ con esta estructura hexagonal:
- src/tasks/domain/task.entity.ts: clase Task con propiedades: id, title, description, status ('open' | 'archived'), createdAt
- src/tasks/domain/task.repository.interface.ts: interfaz ITaskRepository con métodos:
  create(data), findAll(status?: string), findById(id), findByIdWithAssignments(id), updateStatus(id, status)
- src/tasks/infrastructure/prisma-task.repository.ts: implementa ITaskRepository con PrismaService.
  findByIdWithAssignments debe incluir TaskAssignment con User.
  findAll debe filtrar por status si se provee.
- src/tasks/tasks.module.ts: registra repositorio con token 'TASK_REPOSITORY'
No crees controller ni use-cases aún.
```

---

### TASK-11 · POST /tasks — crear tarea
**Qué hace:** Implementa `CreateTaskUseCase`, DTO y endpoint `POST /tasks`.

**Prompt exacto:**
```
Implementa el endpoint POST /tasks en el módulo Tasks:

1. src/tasks/application/dto/create-task.dto.ts:
   - title: string, @IsNotEmpty()
   - description: string, @IsOptional(), @IsString()

2. src/tasks/application/use-cases/create-task.use-case.ts:
   - Inyecta ITaskRepository con token 'TASK_REPOSITORY'
   - Crea la tarea con status 'open' por defecto
   - Retorna: { id, title, description, status }

3. src/tasks/tasks.controller.ts:
   - POST /tasks con @Idempotent()
   - Retorna HTTP 201

Escribe test unitario para CreateTaskUseCase: caso exitoso, falta título (manejo por ValidationPipe).
```

---

### TASK-12 · GET /tasks — listar tareas con filtro de estado
**Qué hace:** Implementa `GetTasksUseCase` y el endpoint `GET /tasks?status=open|archived`. Cada tarea incluye los usuarios asignados con su `isCompleted`.

**Prompt exacto:**
```
Implementa el endpoint GET /tasks en el módulo Tasks:

1. src/tasks/application/use-cases/get-tasks.use-case.ts:
   - Acepta status?: 'open' | 'archived'
   - Llama a taskRepository.findAll(status)
   - Retorna: [{ id, title, description, status, assignedUsers: [{ id, name, lastName, isCompleted }] }]
   - El repositorio debe hacer include de TaskAssignment con User

2. src/tasks/application/dto/get-tasks-query.dto.ts:
   - status: @IsOptional(), @IsEnum(['open', 'archived'])

3. Agrega GET /tasks al TasksController con @Query() del DTO.
   Retorna HTTP 200.

Escribe tests unitarios: sin filtro, filtrado por open, filtrado por archived, lista vacía.
```

---

### TASK-13 · GET /tasks/:idTask — detalle de tarea
**Qué hace:** Implementa `GetTaskDetailUseCase` y el endpoint `GET /tasks/:idTask`.

**Prompt exacto:**
```
Implementa el endpoint GET /tasks/:idTask en el módulo Tasks:

1. src/tasks/application/use-cases/get-task-detail.use-case.ts:
   - Llama a taskRepository.findByIdWithAssignments(id)
   - Si no existe, lanza NotFoundException con code "TASK_NOT_FOUND"
   - Retorna: { id, title, description, status, assignedUsers: [{ id, name, lastName, email, isCompleted }] }

2. Agrega GET /tasks/:idTask al TasksController. Retorna HTTP 200.

Escribe tests unitarios: tarea no encontrada, tarea con usuarios (completados y no completados).
```

---

## FASE 3 — Assignments

### TASK-14 · POST /tasks/:idTask/assign — asignar usuarios a tarea
**Qué hace:** Implementa `AssignUsersUseCase` y el endpoint `POST /tasks/:idTask/assign`. Ignora duplicados silenciosamente.

**Prompt exacto:**
```
Crea src/tasks/application/use-cases/assign-users.use-case.ts:

1. src/tasks/application/dto/assign-users.dto.ts:
   - userIds: number[], @IsArray(), @ArrayNotEmpty(), @IsInt({ each: true })

2. AssignUsersUseCase (inyecta ITaskRepository y IUserRepository):
   - Verifica que la tarea existe → NotFoundException "TASK_NOT_FOUND" si no
   - Verifica que TODOS los userIds existen en la tabla User → NotFoundException "USER_NOT_FOUND" indicando el id faltante
   - Para cada userId, hace upsert en TaskAssignment (crea si no existe, ignora si ya existe) usando Prisma createMany con skipDuplicates: true
   - Retorna: { taskId, assignedUserIds: [...] }

3. Agrega POST /tasks/:idTask/assign al TasksController con @Idempotent(). Retorna HTTP 200.

Escribe tests unitarios: tarea no encontrada, usuario no encontrado, asignación nueva exitosa, asignación duplicada ignorada.
```

---

## FASE 4 — Lógica de Completado + Outbox (núcleo del sistema)

### TASK-15 · Repositorio de NotificationLog y DeadLetterQueue
**Qué hace:** Crea las interfaces y repositorios Prisma para `NotificationLog` y `DeadLetterQueue`.

**Prompt exacto:**
```
Crea los repositorios de infraestructura para las tablas de notificación:

1. src/notifications/domain/notification-log.repository.interface.ts:
   Interfaz INotificationLogRepository con métodos:
   - create(data: { taskId, attemptNumber, status }): Promise<NotificationLog>
   - findByTaskId(taskId): Promise<NotificationLog[]>
   - findPending(): Promise<NotificationLog[]>
   - updateStatus(id, status): Promise<void>

2. src/notifications/domain/dead-letter-queue.repository.interface.ts:
   Interfaz IDeadLetterQueueRepository con métodos:
   - create(data: { taskId, payload, reason }): Promise<DeadLetterQueue>

3. src/notifications/infrastructure/prisma-notification-log.repository.ts: implementación con PrismaService
   findPending() busca registros con status='PENDING'
4. src/notifications/infrastructure/prisma-dlq.repository.ts: implementación con PrismaService

5. src/notifications/notifications.module.ts: registra ambos repositorios con tokens
   'NOTIFICATION_LOG_REPOSITORY' y 'DLQ_REPOSITORY'. Exporta ambos providers y PrismaService (si necesario).

No crees el worker aún.
```

---

### TASK-16 · POST /tasks/:idTask/complete — completado con archivado atómico (CRÍTICO)
**Qué hace:** Implementa `CompleteTaskUseCase` con transacción atómica usando `SELECT FOR UPDATE` para evitar race conditions.

**Prompt exacto:**
```
Implementa el endpoint POST /tasks/:idTask/complete. Esta es la lógica más crítica del sistema.

1. src/tasks/application/dto/complete-task.dto.ts:
   - userId: number, @IsInt(), @IsNotEmpty()

2. src/tasks/application/use-cases/complete-task.use-case.ts:
   Inyecta: ITaskRepository, PrismaService (para la transacción raw).
   
   Lógica DENTRO de una transacción Prisma ($transaction con función callback):
   a. Ejecutar SELECT FOR UPDATE sobre la tarea:
      await prisma.$queryRaw`SELECT id, status FROM Task WHERE id = ${taskId} FOR UPDATE`
   b. Si la tarea no existe → NotFoundException "TASK_NOT_FOUND"
   c. Si la tarea ya está "archived" → ConflictException "TASK_ALREADY_ARCHIVED"
   d. Verificar que el usuario existe en User → NotFoundException "USER_NOT_FOUND"
   e. Verificar que existe TaskAssignment para (taskId, userId) → NotFoundException "USER_NOT_ASSIGNED"
   f. Si TaskAssignment.isCompleted ya es true → ConflictException "ALREADY_COMPLETED"
   g. Actualizar TaskAssignment: isCompleted = true
   h. Contar TaskAssignments de la tarea con isCompleted=false (ya actualizada la del usuario actual)
   i. Si count === 0 (todos completaron):
      - Actualizar Task.status = 'archived'
      - Insertar NotificationLog con attemptNumber=1, status='PENDING' (evento Outbox)
   j. Retornar: { taskId, userId, isCompleted: true, taskStatus: 'open' | 'archived' }

3. Agrega POST /tasks/:idTask/complete al TasksController con @Idempotent(). Retorna HTTP 200.
   Importa NotificationsModule en TasksModule.

Escribe tests unitarios exhaustivos cubriendo TODOS los edge cases:
tarea no encontrada, ya archivada, usuario no encontrado, no asignado, ya completó,
completado sin archivar (quedan usuarios), completado CON archivado (último usuario).
Mockea PrismaService.$transaction y $queryRaw.
```

---

## FASE 5 — Notificaciones asíncronas (Worker + DLQ)

### TASK-17 · GET /tasks/:idTask/notifications — historial
**Qué hace:** Implementa `GetTaskNotificationsUseCase` y el endpoint `GET /tasks/:idTask/notifications`.

**Prompt exacto:**
```
Implementa el endpoint GET /tasks/:idTask/notifications en el módulo Tasks:

1. src/tasks/application/use-cases/get-task-notifications.use-case.ts:
   - Inyecta ITaskRepository y INotificationLogRepository (token 'NOTIFICATION_LOG_REPOSITORY')
   - Verifica que la tarea existe → NotFoundException "TASK_NOT_FOUND"
   - Llama a notificationLogRepository.findByTaskId(taskId)
   - Retorna: [{ id, taskId, attemptNumber, status, timestamp }] ordenado por attemptNumber ASC

2. Agrega GET /tasks/:idTask/notifications al TasksController. Retorna HTTP 200.
   Importa NotificationsModule en TasksModule si aún no está importado.

Escribe tests unitarios: tarea no encontrada, tarea sin notificaciones, tarea con historial de reintentos.
```

---

### TASK-18 · Notification Worker — envío webhook con reintentos y DLQ
**Qué hace:** Worker asíncrono con cron que procesa el Outbox, reintenta hasta 3 veces con backoff exponencial y mueve a DLQ al agotar intentos.

**Prompt exacto:**
```
Crea el Notification Worker en src/notifications/application/notification.worker.ts:

Instala @nestjs/schedule y axios. Registra ScheduleModule.forRoot() en AppModule.

Implementa un @Injectable() service con un método anotado con @Cron('*/10 * * * * *') (cada 10 segundos):

Lógica del worker:
1. Buscar todos los NotificationLog con status='PENDING' usando notificationLogRepository.findPending()
2. Por cada registro pendiente, obtener la Task asociada (title, createdAt como archivedAt)
3. Hacer POST a process.env.NOTIFY_URL con payload: { taskId, title, archivedAt }
   Timeout: 5000ms usando axios con { timeout: 5000 }
4. Si respuesta 2xx:
   - Actualizar el NotificationLog: status='SUCCESS'
5. Si respuesta 5xx o timeout (catch de error):
   - Actualizar el NotificationLog actual: status='FAILED'
   - Si registro.attemptNumber < 3:
     Crear nuevo NotificationLog con { taskId, attemptNumber: registro.attemptNumber + 1, status: 'PENDING' }
     (backoff: esperar 2^attemptNumber * 1000 ms antes de crear el nuevo registro usando setTimeout)
   - Si registro.attemptNumber === 3:
     Crear entrada en DeadLetterQueue con { taskId, payload: JSON.stringify(payload), reason: 'MAX_RETRIES_EXCEEDED' }
     Actualizar el NotificationLog: status='DEAD_LETTERED'

Registra NotificationWorker como provider en NotificationsModule.

Escribe tests unitarios para el worker cubriendo:
éxito en primer intento, fallo → reintento (attemptNumber < 3), fallo en intento 3 → DLQ.
Mockea axios y los repositorios.
```

---

## FASE 6 — Integración y verificación final

### TASK-19 · Conectar todos los módulos en AppModule
**Qué hace:** Registra todos los módulos, configura `ConfigModule` global y verifica que el servidor levanta sin errores TypeScript.

**Prompt exacto:**
```
Actualiza src/app.module.ts para registrar todos los módulos:
- ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' })
- PrismaModule (ya global)
- UsersModule
- TasksModule
- NotificationsModule
- ScheduleModule.forRoot()

Verifica que no haya imports circulares. TasksModule debe importar NotificationsModule.

Actualiza src/main.ts para:
- Leer PORT del proceso (process.env.PORT || 3000)
- Habilitar CORS con app.enableCors()
- Registrar GlobalExceptionFilter con app.useGlobalFilters()
- Registrar ValidationPipe con whitelist:true, forbidNonWhitelisted:true, transform:true

Ejecuta `npm run build` para verificar que compila sin errores TypeScript.
Luego ejecuta `npm run test` para verificar que todos los tests unitarios pasan.
```

---

### TASK-20 · Tests de integración E2E
**Qué hace:** Tests E2E con Supertest sobre la DB de prueba, cubriendo el flujo completo y el caso de concurrencia.

**Prompt exacto:**
```
Escribe tests E2E en test/app.e2e-spec.ts usando @nestjs/testing y supertest.
Configura un jest.config.e2e.js separado.
Usa la variable TEST_DATABASE_URL que apunta al puerto 3307 (test-db del docker-compose).

Antes de cada test limpia las tablas en este orden (por foreign keys):
TaskAssignment → NotificationLog → DeadLetterQueue → IdempotencyKey → Task → User
Usa prisma.$executeRaw para los DELETE.

Casos a cubrir:
1. POST /users → 201 con body { id, name, lastName, email }
2. POST /users sin name → 400 con formato estricto { error: { code: "VALIDATION_ERROR", message: "..." } }
3. POST /users sin Idempotency-Key header → 400 con code "MISSING_IDEMPOTENCY_KEY"
4. POST /users con la misma Idempotency-Key dos veces → ambas retornan 201 idéntico, solo 1 usuario en DB
5. POST /tasks → 201 con status "open"
6. POST /tasks/:id/assign con userIds válidos → 200 con { taskId, assignedUserIds }
7. POST /tasks/:id/assign con userId inexistente → 404 con code "USER_NOT_FOUND"
8. GET /tasks → 200 con array de tareas y assignedUsers
9. GET /tasks?status=open → filtra correctamente
10. GET /tasks/:id → 200 con detail de la tarea y assignedUsers con isCompleted
11. POST /tasks/:id/complete (primer usuario de 2) → 200 con taskStatus: "open"
12. POST /tasks/:id/complete (segundo usuario) → 200 con taskStatus: "archived"
13. CONCURRENCIA: crear tarea, asignar 2 usuarios, completar el primero. 
    Luego lanzar simultáneamente (Promise.all) el complete del segundo usuario dos veces con distinta Idempotency-Key.
    Verificar: solo 1 NotificationLog con status PENDING en DB, la tarea está archived.
14. GET /tasks/:id/notifications → 200 con lista de intentos

Documenta cada test con un comentario indicando qué regla de negocio verifica.
```

---

## Resumen de orden de ejecución

```
TASK-01 → TASK-02 → TASK-03 → TASK-04 → TASK-05
    ↓
TASK-06 → TASK-07 → TASK-08 → TASK-09
    ↓
TASK-10 → TASK-11 → TASK-12 → TASK-13
    ↓
TASK-14
    ↓
TASK-15 → TASK-16 → TASK-17
    ↓
TASK-18
    ↓
TASK-19 → TASK-20
```

| # | Tarea | Fase | Dependencias |
|---|-------|------|-------------|
| 01 | Scaffolding NestJS | 0 | — |
| 02 | Prisma schema + migración | 0 | 01 |
| 03 | PrismaService global | 0 | 02 |
| 04 | GlobalExceptionFilter | 0 | 03 |
| 05 | IdempotencyGuard + Interceptor | 0 | 03, 04 |
| 06 | UsersModule estructura | 1 | 03 |
| 07 | POST /users | 1 | 05, 06 |
| 08 | GET /users | 1 | 06, 07 |
| 09 | GET /users/:id/tasks | 1 | 06 |
| 10 | TasksModule estructura | 2 | 03 |
| 11 | POST /tasks | 2 | 05, 10 |
| 12 | GET /tasks | 2 | 10 |
| 13 | GET /tasks/:id | 2 | 10 |
| 14 | POST /tasks/:id/assign | 3 | 05, 06, 10 |
| 15 | NotificationsModule repos | 4 | 03 |
| 16 | POST /tasks/:id/complete | 4 | 05, 10, 06, 15 |
| 17 | GET /tasks/:id/notifications | 5 | 10, 15 |
| 18 | Notification Worker + DLQ | 5 | 15 |
| 19 | AppModule + main.ts final | 6 | todos |
| 20 | Tests E2E | 6 | 19 |
