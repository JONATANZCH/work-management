import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

describe('App E2E Tests (Reto GEEST)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    // Configurar la URL de la base de datos de pruebas (MySQL en localhost:3307)
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ||
      'mysql://root:test_password@localhost:3307/geest_test_db';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  // Limpieza estricta de tablas antes de cada test respetando foreign keys
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`DELETE FROM TaskAssignment`);
    await prisma.$executeRawUnsafe(`DELETE FROM NotificationLog`);
    await prisma.$executeRawUnsafe(`DELETE FROM DeadLetterQueue`);
    await prisma.$executeRawUnsafe(`DELETE FROM IdempotencyKey`);
    await prisma.$executeRawUnsafe(`DELETE FROM Task`);
    await prisma.$executeRawUnsafe(`DELETE FROM User`);
  });

  /**
   * 1. POST /users -> 201 con body { id, name, lastName, email }
   * Regla: Registra un usuario en la base de datos con un ID único y retorna la información creada.
   */
  it('1. POST /users -> 201 con body { id, name, lastName, email }', async () => {
    const response = await request(app.getHttpServer())
      .post('/users')
      .set('Idempotency-Key', 'test-create-user-1')
      .send({
        name: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: expect.any(Number),
      name: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
    });
  });

  /**
   * 2. POST /users sin name -> 400 con formato estricto { error: { code: "VALIDATION_ERROR", message: "..." } }
   * Regla: Debe devolver un error si falta información obligatoria en el formato estricto del reto.
   */
  it('2. POST /users sin name -> 400 con formato estricto { error: { code: "VALIDATION_ERROR", message: "..." } }', async () => {
    const response = await request(app.getHttpServer())
      .post('/users')
      .set('Idempotency-Key', 'test-create-user-invalid')
      .send({
        lastName: 'Doe',
        email: 'john.doe@example.com',
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('name'),
      },
    });
  });

  /**
   * 3. POST /users sin Idempotency-Key header -> 400 con code "MISSING_IDEMPOTENCY_KEY"
   * Regla: Todos los endpoints POST deben validar la presencia del header Idempotency-Key.
   */
  it('3. POST /users sin Idempotency-Key header -> 400 con code "MISSING_IDEMPOTENCY_KEY"', async () => {
    const response = await request(app.getHttpServer())
      .post('/users')
      .send({
        name: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'MISSING_IDEMPOTENCY_KEY',
        message: 'The Idempotency-Key header is required',
      },
    });
  });

  /**
   * 4. POST /users con la misma Idempotency-Key dos veces -> ambas retornan 201 idéntico, solo 1 usuario en DB
   * Regla: Peticiones repetidas con la misma Idempotency-Key deben retornar respuestas idénticas y no duplicar registros.
   */
  it('4. POST /users con la misma Idempotency-Key dos veces -> ambas retornan 201 idéntico, solo 1 usuario en DB', async () => {
    const key = 'test-idempotent-user-key';
    const payload = {
      name: 'Alice',
      lastName: 'Smith',
      email: 'alice.smith@example.com',
    };

    const firstResponse = await request(app.getHttpServer())
      .post('/users')
      .set('Idempotency-Key', key)
      .send(payload);

    expect(firstResponse.status).toBe(201);

    const secondResponse = await request(app.getHttpServer())
      .post('/users')
      .set('Idempotency-Key', key)
      .send(payload);

    expect(secondResponse.status).toBe(201);
    expect(secondResponse.body).toEqual(firstResponse.body);

    const usersCount = await prisma.user.count({
      where: { email: payload.email },
    });
    expect(usersCount).toBe(1);
  });

  /**
   * 5. POST /tasks -> 201 con status "open"
   * Regla: Registra una tarea en la base de datos con un ID único y status por defecto "open".
   */
  it('5. POST /tasks -> 201 con status "open"', async () => {
    const response = await request(app.getHttpServer())
      .post('/tasks')
      .set('Idempotency-Key', 'test-create-task-1')
      .send({
        title: 'Nueva Tarea E2E',
        description: 'Descripción para test E2E',
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: expect.any(Number),
      title: 'Nueva Tarea E2E',
      description: 'Descripción para test E2E',
      status: 'open',
    });
  });

  /**
   * 6. POST /tasks/:id/assign con userIds válidos -> 200 con { taskId, assignedUserIds }
   * Regla: Asigna un arreglo de usuarios a una tarea existente sin duplicaciones.
   */
  it('6. POST /tasks/:id/assign con userIds válidos -> 200 con { taskId, assignedUserIds }', async () => {
    const user1 = await prisma.user.create({
      data: { name: 'User1', lastName: 'L1', email: 'u1@example.com' },
    });
    const user2 = await prisma.user.create({
      data: { name: 'User2', lastName: 'L2', email: 'u2@example.com' },
    });
    const task = await prisma.task.create({
      data: { title: 'Task Assign Test', status: 'open' },
    });

    const response = await request(app.getHttpServer())
      .post(`/tasks/${task.id}/assign`)
      .set('Idempotency-Key', 'test-assign-users-1')
      .send({ userIds: [user1.id, user2.id] });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      taskId: task.id,
      assignedUserIds: [user1.id, user2.id],
    });

    const assignments = await prisma.taskAssignment.findMany({
      where: { taskId: task.id },
    });
    expect(assignments).toHaveLength(2);
  });

  /**
   * 7. POST /tasks/:id/assign con userId inexistente -> 404 con code "USER_NOT_FOUND"
   * Regla: Si algún usuario no existe, devuelve error indicando que el usuario no fue encontrado.
   */
  it('7. POST /tasks/:id/assign con userId inexistente -> 404 con code "USER_NOT_FOUND"', async () => {
    const task = await prisma.task.create({
      data: { title: 'Task with invalid user', status: 'open' },
    });

    const response = await request(app.getHttpServer())
      .post(`/tasks/${task.id}/assign`)
      .set('Idempotency-Key', 'test-assign-invalid-user')
      .send({ userIds: [99999] });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: 'USER_NOT_FOUND',
        message: 'User with id 99999 not found',
      },
    });
  });

  /**
   * 8. GET /tasks -> 200 con array de tareas y assignedUsers
   * Regla: Lista todas las tareas creadas indicando qué usuarios ya completaron su parte.
   */
  it('8. GET /tasks -> 200 con array de tareas y assignedUsers', async () => {
    const user = await prisma.user.create({
      data: { name: 'Assigned', lastName: 'User', email: 'assigned@example.com' },
    });
    const task = await prisma.task.create({
      data: { title: 'Task for List', status: 'open' },
    });
    await prisma.taskAssignment.create({
      data: { taskId: task.id, userId: user.id, isCompleted: false },
    });

    const response = await request(app.getHttpServer()).get('/tasks');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    const found = response.body.find((t: any) => t.id === task.id);
    expect(found).toBeDefined();
    expect(found.assignedUsers).toEqual([
      {
        id: user.id,
        name: user.name,
        lastName: user.lastName,
        isCompleted: false,
      },
    ]);
  });

  /**
   * 9. GET /tasks?status=open -> filtra correctamente
   * Regla: El parámetro ?status filtra las tareas retornando exclusivamente aquellas en dicho estado.
   */
  it('9. GET /tasks?status=open -> filtra correctamente', async () => {
    await prisma.task.create({
      data: { title: 'Open Task', status: 'open' },
    });
    await prisma.task.create({
      data: { title: 'Archived Task', status: 'archived' },
    });

    const response = await request(app.getHttpServer()).get('/tasks?status=open');

    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThanOrEqual(1);
    for (const task of response.body) {
      expect(task.status).toBe('open');
    }
  });

  /**
   * 10. GET /tasks/:id -> 200 con detail de la tarea y assignedUsers con isCompleted
   * Regla: Retorna información completa de la tarea y el estado de completado de cada usuario asignado.
   */
  it('10. GET /tasks/:id -> 200 con detail de la tarea y assignedUsers con isCompleted', async () => {
    const user = await prisma.user.create({
      data: { name: 'Detail', lastName: 'User', email: 'detail@example.com' },
    });
    const task = await prisma.task.create({
      data: { title: 'Detail Task', description: 'Detail desc', status: 'open' },
    });
    await prisma.taskAssignment.create({
      data: { taskId: task.id, userId: user.id, isCompleted: false },
    });

    const response = await request(app.getHttpServer()).get(`/tasks/${task.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: task.id,
      title: 'Detail Task',
      description: 'Detail desc',
      status: 'open',
      assignedUsers: [
        {
          id: user.id,
          name: 'Detail',
          lastName: 'User',
          email: 'detail@example.com',
          isCompleted: false,
        },
      ],
    });
  });

  /**
   * 11. POST /tasks/:id/complete (primer usuario de 2) -> 200 con taskStatus: "open"
   * Regla: Cuando un usuario asignado completa su parte pero aún quedan otros pendientes, la tarea permanece en "open".
   */
  it('11. POST /tasks/:id/complete (primer usuario de 2) -> 200 con taskStatus: "open"', async () => {
    const user1 = await prisma.user.create({
      data: { name: 'User 1', lastName: 'L', email: 'u1-comp@example.com' },
    });
    const user2 = await prisma.user.create({
      data: { name: 'User 2', lastName: 'L', email: 'u2-comp@example.com' },
    });
    const task = await prisma.task.create({
      data: { title: 'Complete partial test', status: 'open' },
    });

    await prisma.taskAssignment.createMany({
      data: [
        { taskId: task.id, userId: user1.id, isCompleted: false },
        { taskId: task.id, userId: user2.id, isCompleted: false },
      ],
    });

    const response = await request(app.getHttpServer())
      .post(`/tasks/${task.id}/complete`)
      .set('Idempotency-Key', 'test-complete-user-1')
      .send({ userId: user1.id });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      taskId: task.id,
      userId: user1.id,
      isCompleted: true,
      taskStatus: 'open',
    });

    const taskInDb = await prisma.task.findUnique({ where: { id: task.id } });
    expect(taskInDb?.status).toBe('open');
  });

  /**
   * 12. POST /tasks/:id/complete (segundo usuario) -> 200 con taskStatus: "archived"
   * Regla: Cuando el último usuario completa su parte, la tarea cambia a "archived" y se genera el registro Outbox.
   */
  it('12. POST /tasks/:id/complete (segundo usuario) -> 200 con taskStatus: "archived"', async () => {
    const user1 = await prisma.user.create({
      data: { name: 'User 1', lastName: 'L', email: 'u1-arch@example.com' },
    });
    const user2 = await prisma.user.create({
      data: { name: 'User 2', lastName: 'L', email: 'u2-arch@example.com' },
    });
    const task = await prisma.task.create({
      data: { title: 'Complete and archive test', status: 'open' },
    });

    await prisma.taskAssignment.createMany({
      data: [
        { taskId: task.id, userId: user1.id, isCompleted: true }, // Ya completó
        { taskId: task.id, userId: user2.id, isCompleted: false }, // Falta este
      ],
    });

    const response = await request(app.getHttpServer())
      .post(`/tasks/${task.id}/complete`)
      .set('Idempotency-Key', 'test-complete-user-2-archived')
      .send({ userId: user2.id });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      taskId: task.id,
      userId: user2.id,
      isCompleted: true,
      taskStatus: 'archived',
    });

    const taskInDb = await prisma.task.findUnique({ where: { id: task.id } });
    expect(taskInDb?.status).toBe('archived');

    const notificationLog = await prisma.notificationLog.findFirst({
      where: { taskId: task.id },
    });
    expect(notificationLog).toBeDefined();
    expect(notificationLog?.status).toBe('PENDING');
  });

  /**
   * 13. CONCURRENCIA: crear tarea, asignar 2 usuarios, completar el primero.
   * Luego lanzar simultáneamente (Promise.all) el complete del segundo usuario dos veces con distinta Idempotency-Key.
   * Regla: Evitar doble archivado y asegurar que solo se genera exactamente 1 NotificationLog PENDING en DB.
   */
  it('13. CONCURRENCIA: lanzar simultáneamente complete con distinta Idempotency-Key -> exactamente 1 NotificationLog PENDING', async () => {
    const user1 = await prisma.user.create({
      data: { name: 'User 1', lastName: 'L', email: 'u1-conc@example.com' },
    });
    const user2 = await prisma.user.create({
      data: { name: 'User 2', lastName: 'L', email: 'u2-conc@example.com' },
    });
    const task = await prisma.task.create({
      data: { title: 'Concurrency Task', status: 'open' },
    });

    await prisma.taskAssignment.createMany({
      data: [
        { taskId: task.id, userId: user1.id, isCompleted: true },
        { taskId: task.id, userId: user2.id, isCompleted: false },
      ],
    });

    // Peticiones concurrentes en paralelo para el segundo usuario con keys diferentes
    const [res1, res2] = await Promise.all([
      request(app.getHttpServer())
        .post(`/tasks/${task.id}/complete`)
        .set('Idempotency-Key', 'conc-key-1')
        .send({ userId: user2.id }),
      request(app.getHttpServer())
        .post(`/tasks/${task.id}/complete`)
        .set('Idempotency-Key', 'conc-key-2')
        .send({ userId: user2.id }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    // Uno debe ser 200 (éxito en completar) y el otro 409 ConflictException (ya completado o archivado)
    expect(statuses).toEqual([200, 409]);

    // La tarea debe estar archivada
    const taskInDb = await prisma.task.findUnique({ where: { id: task.id } });
    expect(taskInDb?.status).toBe('archived');

    // Verificar que existe EXACTAMENTE 1 NotificationLog
    const logs = await prisma.notificationLog.findMany({
      where: { taskId: task.id, status: 'PENDING' },
    });
    expect(logs).toHaveLength(1);
  });

  /**
   * 14. GET /tasks/:id/notifications -> 200 con lista de intentos
   * Regla: Permite auditar y consultar todos los intentos de notificación registrados para la tarea.
   */
  it('14. GET /tasks/:id/notifications -> 200 con lista de intentos', async () => {
    const task = await prisma.task.create({
      data: { title: 'Notification Audit Task', status: 'archived' },
    });

    await prisma.notificationLog.create({
      data: { taskId: task.id, attemptNumber: 1, status: 'FAILED' },
    });
    await prisma.notificationLog.create({
      data: { taskId: task.id, attemptNumber: 2, status: 'SUCCESS' },
    });

    const response = await request(app.getHttpServer()).get(
      `/tasks/${task.id}/notifications`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body[0].attemptNumber).toBe(1);
    expect(response.body[0].status).toBe('FAILED');
    expect(response.body[1].attemptNumber).toBe(2);
    expect(response.body[1].status).toBe('SUCCESS');
  });
});
