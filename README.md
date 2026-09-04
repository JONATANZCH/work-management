# Sistema de Gestión de Trabajo GEEST - API REST

API REST robusta, escalable y tolerante a fallos para la gestión colaborativa de tareas, asignación de usuarios y archivado automático con notificaciones asíncronas seguras ante concurrencia.

---

## 1. 🚀 Ejecución Local

### Prerrequisitos
- **Node.js**: v18 o superior
- **Docker** y **Docker Compose**
- **npm** v9 o superior

### Pasos para iniciar

1. **Clonar el repositorio:**
   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd work-management-geest
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno:**
   Copia el archivo de ejemplo o verifica `.env`:
   ```env
   DATABASE_URL="mysql://root:root_password@localhost:3306/geest_db"
   NOTIFY_URL="http://localhost:3000/mock-notify"
   PORT=3000
   ```

4. **Levantar las bases de datos en Docker:**
   ```bash
   docker compose up -d
   ```
   *Esto iniciará:*
   * `geest_mysql_db` (puerto `3306`): Base de datos principal de la aplicación.
   * `geest_mysql_test_db` (puerto `3307`): Base de datos aislada en memoria RAM para ejecutar tests E2E ultra rápidos sin alterar datos de desarrollo.

5. **Aplicar migraciones de base de datos:**
   ```bash
   npx prisma migrate dev
   ```

6. **Iniciar el servidor en modo desarrollo:**
   ```bash
   npm run start:dev
   ```
   La API estará lista escuchando en: `http://localhost:3000`.

---

## 2. 🧪 Ejecución de Tests

El proyecto cuenta con una suite completa de pruebas unitarias y de integración end-to-end (E2E), cubriendo casos normales, validaciones, idempotencia y carreras de concurrencia:

* **Ejecutar tests unitarios:**
  ```bash
  npm run test
  ```

* **Ejecutar tests E2E (concurrencia, idempotencia e integración completa):**
  ```bash
  npm run test:e2e
  ```

* **Ejecutar cobertura de código:**
  ```bash
  npm run test:cov
  ```

---

## 3. 📊 Diagrama UML de la Base de Datos

```mermaid
erDiagram
    User {
        int id PK "autoincrement"
        string name
        string lastName
        string email UK "unique"
        datetime createdAt
    }

    Task {
        int id PK "autoincrement"
        string title
        string description "nullable"
        enum status "open | archived"
        datetime createdAt
    }

    TaskAssignment {
        int taskId PK,FK
        int userId PK,FK
        boolean isCompleted "default: false"
    }

    NotificationLog {
        int id PK "autoincrement"
        int taskId FK
        int attemptNumber
        string status "PENDING | SUCCESS | FAILED"
        datetime timestamp
    }

    DeadLetterQueue {
        int id PK "autoincrement"
        int taskId FK
        string payload "TEXT"
        string reason
        datetime failedAt
    }

    IdempotencyKey {
        string key PK "UUID o custom string"
        string responseBody "TEXT JSON serializado"
        datetime createdAt
    }

    User ||--o{ TaskAssignment : "participa en"
    Task ||--o{ TaskAssignment : "asigna a"
    Task ||--o{ NotificationLog : "genera"
    Task ||--o{ DeadLetterQueue : "falla en"
```

*Nota: La tabla `IdempotencyKey` funciona como un almacén atómico de idempotencia para solicitudes HTTP POST concurrentes.*

---

## 4. 📐 Decisiones Técnicas y Justificación

* **NestJS con Arquitectura Hexagonal / Clean Architecture:**
  Se estructuró cada módulo (`Users`, `Tasks`, `Notifications`, `Common`) desacoplando la capa de dominio (entidades, interfaces de repositorios), aplicación (casos de uso y DTOs) e infraestructura (controladores, adaptadores Prisma). Esto permite mockear dependencias fácilmente y garantizar alta mantenibilidad.
* **Prisma ORM sobre MySQL 8.0:**
  Provee esquemas fuertemente tipados, migraciones declarativas y trazables en Git (`prisma/migrations`), y control transaccional robusto mediante `$transaction`.
* **Idempotencia Estricta en POST:**
  Se implementó un `IdempotencyInterceptor` que exige el header `Idempotency-Key` en todas las rutas `POST`. Si se recibe una clave repetida, se recupera el snapshot exacto de la respuesta sin volver a ejecutar lógica de negocio ni crear registros duplicados, incluso bajo peticiones paralelas.
* **Concurrencia Crítica con `SELECT FOR UPDATE`:**
  En el caso de uso `CompleteTaskUseCase`, si dos usuarios completan la tarea simultáneamente, se bloquea la fila de la tarea a nivel de base de datos (`SELECT id, status FROM Task WHERE id = ? FOR UPDATE`). Esto evita race conditions (Lost Updates) garantizando que la transición a `archived` y la emisión del evento ocurran **exactamente una vez**.
* **Patrón Transactional Outbox:**
  Al cambiar el estado a `archived`, no se hace una llamada HTTP externa síncrona (lo que haría la transacción vulnerable a caídas de red o latencia). En su lugar, se inserta un `NotificationLog` con estado `PENDING` dentro de la **misma transacción de base de datos**, garantizando consistencia eventual atómica.
* **Manejo Estricto de Errores:**
  Se implementó un `GlobalExceptionFilter` para estandarizar todas las respuestas de error (4xx y 5xx) bajo el formato contractualmente requerido:
  ```json
  {
    "error": {
      "code": "STRING",
      "message": "STRING"
    }
  }
  ```

---

## 5. 💡 Mejora Implementada: Dead Letter Queue (DLQ)

Se diseñó e implementó una **Dead Letter Queue (DLQ)** nativa para el motor de notificaciones asíncronas (`NotificationWorker`).

* **Qué problema resuelve:**
  Evita la pérdida irreversible de notificaciones críticas de negocio. Si el webhook externo (`NOTIFY_URL`) experimenta una falla prolongada, caídas de DNS o errores 5xx sostenidos tras agotar los 3 reintentos con backoff exponencial, el evento no se descarta ni se pierde en logs volátiles.
* **Por qué es necesaria:**
  En ecosistemas distribuidos y arquitecturas orientadas a eventos, asumir disponibilidad del 100% de servicios externos es un antipatrón. La DLQ desacopla la falla externa del ciclo de vida del sistema local y permite auditar eventos no entregados.
* **Por qué se eligió sobre alternativas:**
  * Frente a *reintentos infinitos*: Los reintentos infinitos saturan la cola de procesamiento, consumen CPU/conexiones innecesarias y provocan efecto avalancha (thundering herd).
  * Frente a *logs de texto en consola*: Los logs en consola requieren parsing manual y son difíciles de reprocesar de forma estructurada. La tabla `DeadLetterQueue` almacena el payload exacto y la causa de falla para permitir auditoría y reprocesamiento controlado.

---

## 6. 🌐 Publicación y Despliegue de la API

* **URL Pública:** `<AQUI_TU_URL_DE_ELASTIC_BEANSTALK>` *(Ejemplo: http://work-management-geest.us-east-1.elasticbeanstalk.com)*
* **Proveedor de Hosting (Cómputo):** **AWS Elastic Beanstalk** (Entorno administrado Node.js sobre Amazon Linux).
* **Base de Datos en Producción:** **Amazon RDS (MySQL 8.0)**.
* **Justificación de la elección:**
  Se seleccionó la arquitectura completa en la nube de AWS con **Elastic Beanstalk + Amazon RDS** por las siguientes razones de ingeniería:
  1. **Ecosistema Nativo AWS:** Tanto la capa de cómputo como la base de datos conviven en la misma región (`us-east-1`), minimizando la latencia de red en las transacciones de base de datos.
  2. **Compatibilidad nativa con procesos continuos:** A diferencia de arquitecturas serverless efímeras como AWS Lambda (donde los procesos se congelan al terminar la solicitud HTTP), Elastic Beanstalk ejecuta la aplicación como un servicio continuo Node.js, garantizando que el worker asíncrono `@Cron('*/10 * * * * *')` procese la tabla Outbox puntualmente cada 10 segundos.
  3. **Base de Datos Relacional Robusta:** **Amazon RDS (MySQL 8.0)** con almacenamiento persistente, transacciones ACID estrictas y aislamiento de concurrencia mediante `SELECT FOR UPDATE`.
  4. **Gestión de Salud y Recuperación:** Elastic Beanstalk monitoriza la salud de la instancia, reiniciando el servicio automáticamente si ocurre algún fallo no controlado.
  5. **Costo Cero / Free Tier:** Elegible dentro de la capa gratuita de AWS (instancia `t3.micro` o `t4g.micro` + RDS `db.t4g.micro` Free Tier) para cumplir el requerimiento de disponibilidad durante los 7 días de evaluación.
* **Cómo acceder a la API desplegada:**
  Consumir los endpoints mediante cliente HTTP (Postman, Apidog, cURL) usando la URL base provista por Elastic Beanstalk.
  * *Requisito estricto:* Enviar el header `Idempotency-Key: <UUID>` en todas las peticiones `POST`.

---

## 7. 🧩 Supuestos Realizados ante Ambigüedades

1. **Autenticación en `NOTIFY_URL`:** El reto no especifica firmas criptográficas (HMAC) ni tokens Bearer para el webhook saliente; por tanto, se asume un endpoint accesible vía `POST` estándar enviando el payload JSON estipulado.
2. **Ciclo de Vida de Tareas:** Una vez que una tarea pasa a estado `archived`, se considera un estado final terminal; cualquier intento posterior de completar o asignar usuarios arroja error `TASK_ALREADY_ARCHIVED`.
3. **Persistencia de Idempotencia:** Las respuestas cacheadas en `IdempotencyKey` se persisten con su payload completo para responder fielmente con los mismos códigos de estado y cuerpo JSON original.

---

## 8. ⏱️ Recortes por Falta de Tiempo

* **Alcance Cumplido:** Se implementó el **100% de los requerimientos funcionales, de confiabilidad, concurrencia, idempotencia y entrega solicitados en la especificación del reto**, sin recortes de alcance funcional.
