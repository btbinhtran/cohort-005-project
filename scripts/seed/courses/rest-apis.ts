import { db, type Category, type User } from "../db";
import { daysAgo } from "../helpers";
import { insertCourseContent } from "../course-content";
import * as schema from "../../../app/db/schema";
import { CourseStatus } from "../../../app/db/schema";
import { markdown } from "../../../app/lib/text";

export function seedRestApisCourse({
  instructor2,
  catBySlug,
}: {
  instructor2: User;
  catBySlug: Record<string, Category>;
}) {
  // ─── Course 2: Building REST APIs with Node.js (Marcus Johnson) ───

  const [course2] = db
    .insert(schema.courses)
    .values({
      title: "Building REST APIs with Node.js",
      slug: "building-rest-apis-with-nodejs",
      description:
        "Learn to build production-ready REST APIs using Node.js and Express. Covers routing, middleware, authentication, database integration, error handling, testing, and deployment best practices.",
      salesCopy: markdown(`## Build APIs That Actually Work in Production

Most API tutorials teach you how to return JSON from an endpoint. This course teaches you how to build APIs that handle real traffic, real users, and real problems — the kind you'll face on the job.

From your first Express route to deploying a production-ready API, you'll learn every layer of the stack: routing, middleware, validation, authentication, database integration, testing, and deployment.

## What You'll Build

Throughout this course, you'll build a complete REST API from scratch. Not a toy project — a properly structured API with authentication, input validation, error handling, pagination, and tests.

### Topics Covered

- **Express fundamentals** — routing, middleware chains, request/response lifecycle
- **Input validation with Zod** — never trust user input, validate everything
- **Database integration** — Drizzle ORM with SQLite, CRUD operations, transactions
- **JWT authentication** — secure your endpoints with industry-standard tokens
- **Security hardening** — rate limiting, CORS, security headers with Helmet
- **Testing** — unit tests with Vitest, integration tests with Supertest
- **Deployment** — environment config, process management, CI/CD basics

## Who Should Take This Course?

This course is designed for developers who know JavaScript and want to build backend services. If you've built frontends but never created your own API, this is the perfect next step.

You should be comfortable with JavaScript basics — functions, async/await, and working with objects. No backend experience required.

## Why Node.js for APIs?

Node.js lets you use the same language on both frontend and backend. Its non-blocking I/O model handles concurrent requests efficiently, and the npm ecosystem gives you battle-tested libraries for every common backend task.

Express is the most widely-used Node.js web framework for a reason — it's minimal, flexible, and has a massive community. The patterns you learn here will transfer to any Node.js framework.

## 20 Lessons, 5 Modules, Zero Fluff

Every lesson is focused and practical. No 45-minute lectures where 40 minutes are filler. Each lesson teaches one concept, shows you how to implement it, and moves on.`),
      instructorId: instructor2.id,
      categoryId: catBySlug["programming"].id,
      status: CourseStatus.Published,
      coverImageUrl: "/images/course-nodejs.svg",
      price: 5999,
      createdAt: daysAgo(305),
      updatedAt: daysAgo(5),
    })
    .returning()
    .all();

  const c2Modules = [
    {
      title: "API Fundamentals",
      lessons: [
        {
          title: "What is a REST API?",
          duration: 10,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## REST API Fundamentals

REST (Representational State Transfer) is an architectural style for designing networked applications. RESTful APIs use HTTP methods to perform CRUD operations on resources.

### Key Principles

- Stateless communication
- Resource-based URLs
- Standard HTTP methods (GET, POST, PUT, DELETE)
- JSON as the data format`,
        },
        {
          title: "Setting Up Express",
          duration: 15,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          githubRepoUrl:
            "https://github.com/total-typescript/rest-api-express-setup",
          content: `## Express.js Setup

Express is the most popular Node.js web framework for building APIs.

\`\`\`javascript
import express from 'express';

const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(3000, () => console.log('Server running on port 3000'));
\`\`\``,
        },
        {
          title: "HTTP Methods and Status Codes",
          duration: 12,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## HTTP Methods

- **GET** — Retrieve resources (200 OK)
- **POST** — Create resources (201 Created)
- **PUT** — Update resources (200 OK)
- **DELETE** — Remove resources (204 No Content)

### Common Status Codes

- 200 OK, 201 Created, 204 No Content
- 400 Bad Request, 401 Unauthorized, 404 Not Found
- 500 Internal Server Error`,
        },
        {
          title: "Request and Response Objects",
          duration: 14,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## Working with Request & Response

Express provides rich request and response objects for handling HTTP communication.

\`\`\`javascript
app.post('/api/users', (req, res) => {
  const { name, email } = req.body;
  // ... create user
  res.status(201).json({ id: 1, name, email });
});
\`\`\``,
        },
      ],
    },
    {
      title: "Routing and Middleware",
      lessons: [
        {
          title: "Express Router",
          duration: 13,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## Organizing Routes

Use Express Router to organize your API endpoints into logical groups.

\`\`\`javascript
import { Router } from 'express';

const userRouter = Router();
userRouter.get('/', getUsers);
userRouter.get('/:id', getUserById);
userRouter.post('/', createUser);

app.use('/api/users', userRouter);
\`\`\``,
        },
        {
          title: "Custom Middleware",
          duration: 16,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## Middleware in Express

Middleware functions have access to the request, response, and next function in the request-response cycle.

\`\`\`javascript
function logger(req, res, next) {
  console.log(\\\`\\\${req.method} \\\${req.url}\\\`);
  next();
}

function authenticate(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  next();
}
\`\`\``,
        },
        {
          title: "Error Handling Middleware",
          duration: 11,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## Centralized Error Handling

Express supports error-handling middleware with four parameters.

\`\`\`javascript
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});
\`\`\``,
        },
        {
          title: "Validation with Zod",
          duration: 18,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## Request Validation

Use Zod to validate request bodies, query parameters, and URL parameters.

\`\`\`javascript
import { z } from 'zod';

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().positive().optional()
});

app.post('/api/users', (req, res) => {
  const result = CreateUserSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json(result.error);
  // ... create user with result.data
});
\`\`\``,
        },
      ],
    },
    {
      title: "Database Integration",
      lessons: [
        {
          title: "Connecting to a Database",
          duration: 14,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## Database Setup

Learn how to connect your API to a database using an ORM.

\`\`\`javascript
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';

const sqlite = new Database('app.db');
const db = drizzle(sqlite);
\`\`\``,
        },
        {
          title: "CRUD Operations",
          duration: 20,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          githubRepoUrl:
            "https://github.com/total-typescript/rest-api-crud-operations",
          content: `## Building CRUD Endpoints

Implement Create, Read, Update, Delete operations for your API resources.

\`\`\`javascript
// Create
app.post('/api/posts', async (req, res) => {
  const post = await db.insert(posts).values(req.body).returning();
  res.status(201).json(post);
});

// Read
app.get('/api/posts/:id', async (req, res) => {
  const post = await db.select().from(posts).where(eq(posts.id, req.params.id));
  if (!post) return res.status(404).json({ error: 'Not found' });
  res.json(post);
});
\`\`\``,
        },
        {
          title: "Pagination and Filtering",
          duration: 15,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## Pagination

Implement cursor-based and offset-based pagination for list endpoints.

\`\`\`javascript
app.get('/api/posts', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  const results = await db.select().from(posts)
    .limit(limit).offset(offset);
  res.json({ data: results, page, limit });
});
\`\`\``,
        },
        {
          title: "Transactions",
          duration: 12,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## Database Transactions

Use transactions to ensure data consistency when multiple operations must succeed or fail together.

\`\`\`javascript
await db.transaction(async (tx) => {
  const [order] = await tx.insert(orders).values({ userId, total }).returning();
  for (const item of items) {
    await tx.insert(orderItems).values({ orderId: order.id, ...item });
  }
});
\`\`\``,
        },
      ],
    },
    {
      title: "Authentication and Security",
      lessons: [
        {
          title: "JWT Authentication",
          duration: 22,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## JSON Web Tokens

Implement JWT-based authentication for your API.

\`\`\`javascript
import jwt from 'jsonwebtoken';

app.post('/api/login', async (req, res) => {
  const user = await findUser(req.body.email);
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
  res.json({ token });
});
\`\`\``,
        },
        {
          title: "Rate Limiting",
          duration: 10,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## Rate Limiting

Protect your API from abuse by limiting the number of requests per client.

\`\`\`javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per window
});

app.use('/api/', limiter);
\`\`\``,
        },
        {
          title: "CORS and Security Headers",
          duration: 11,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## CORS Configuration

Configure Cross-Origin Resource Sharing for your API.

\`\`\`javascript
import cors from 'cors';
import helmet from 'helmet';

app.use(cors({ origin: 'https://yourapp.com' }));
app.use(helmet());
\`\`\``,
        },
      ],
    },
    {
      title: "Testing and Deployment",
      lessons: [
        {
          title: "Unit Testing API Routes",
          duration: 18,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## Testing with Vitest and Supertest

Write tests for your API endpoints using Vitest and Supertest.

\`\`\`javascript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

describe('GET /api/users', () => {
  it('returns a list of users', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
  });
});
\`\`\``,
        },
        {
          title: "Integration Testing",
          duration: 16,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## Integration Tests

Test complete request flows including database interactions.

\`\`\`javascript
describe('User CRUD', () => {
  it('creates and retrieves a user', async () => {
    const createRes = await request(app)
      .post('/api/users')
      .send({ name: 'Test', email: 'test@test.com' });
    expect(createRes.status).toBe(201);

    const getRes = await request(app)
      .get(\\\`/api/users/\\\${createRes.body.id}\\\`);
    expect(getRes.body.name).toBe('Test');
  });
});
\`\`\``,
        },
        {
          title: "Environment Variables and Config",
          duration: 9,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## Configuration Management

Manage environment-specific settings with environment variables.

\`\`\`javascript
const config = {
  port: process.env.PORT || 3000,
  dbUrl: process.env.DATABASE_URL || 'sqlite:app.db',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret'
};
\`\`\``,
        },
        {
          title: "Deploying Your API",
          duration: 14,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## Deployment

Deploy your Node.js API to production. We'll cover various hosting options and best practices.

### Deployment Checklist

- Set NODE_ENV=production
- Use a process manager (PM2)
- Set up logging and monitoring
- Configure HTTPS
- Set up CI/CD pipeline`,
        },
        {
          title: "Course Wrap-Up",
          duration: 7,
          content: `## Congratulations!

You've completed the Building REST APIs course. You now have the skills to build, test, and deploy production-ready APIs with Node.js.

### Key Takeaways

- RESTful design principles
- Express routing and middleware
- Database integration and transactions
- Authentication and security
- Testing and deployment`,
        },
      ],
    },
  ];

  const course2LessonIds = insertCourseContent(course2.id, c2Modules, 300);

  console.log(
    `Created course "${course2.title}" with ${c2Modules.length} modules and ${course2LessonIds.length} lessons.`
  );

  return { course2, course2LessonIds };
}
