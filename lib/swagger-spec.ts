export const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Teader Platform REST API Specification',
    version: '1.0.0',
    description: 'API documentation for Teader Project Management Platform. Backed by MySQL (`teader_db`).',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local Development Server',
    },
  ],
  paths: {
    '/api/issues': {
      get: {
        summary: 'Retrieve all tasks/issues',
        description: 'Fetches list of all task issues along with subtasks and user metadata from MySQL database.',
        responses: {
          '200': {
            description: 'Array of task issues',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Issue' },
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create a new task/issue',
        description: 'Inserts a new task issue record into MySQL database.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title'],
                properties: {
                  title: { type: 'string', example: 'Build WebSocket telemetry' },
                  description: { type: 'string', example: 'Optimize live data pipeline.' },
                  status: { type: 'string', enum: ['todo', 'in_progress', 'needs_review', 'done'], default: 'todo' },
                  priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'], default: 'medium' },
                  labels: { type: 'array', items: { type: 'string' }, example: ['Backend', 'Performance'] },
                  subtasks: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string', example: 'Setup connection ping' },
                        completed: { type: 'boolean', default: false },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Created issue object',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Issue' },
              },
            },
          },
        },
      },
    },
    '/api/issues/{id}': {
      patch: {
        summary: 'Update task status',
        description: 'Updates task status in MySQL database.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'issue_2703',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['todo', 'in_progress', 'needs_review', 'done'] },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Updated status confirmation',
          },
        },
      },
    },
    '/api/subtasks': {
      post: {
        summary: 'Add sub-work checklist item',
        description: 'Creates a sub-work item for a task in MySQL database.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['issueId', 'title'],
                properties: {
                  issueId: { type: 'string', example: 'issue_2703' },
                  title: { type: 'string', example: 'Verify token expiration' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Created subtask object',
          },
        },
      },
      patch: {
        summary: 'Toggle sub-work completion',
        description: 'Updates sub-work completion state in MySQL database.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['subId'],
                properties: {
                  subId: { type: 'string', example: 'sub_1' },
                  completed: { type: 'boolean', example: true },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Updated completion confirmation',
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Issue: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'issue_2703' },
          key: { type: 'string', example: 'TDR-2703' },
          title: { type: 'string', example: 'Faster app launch' },
          description: { type: 'string', example: 'Render UI before vehicle_state sync' },
          status: { type: 'string', example: 'in_progress' },
          priority: { type: 'string', example: 'high' },
          labels: { type: 'array', items: { type: 'string' } },
          subtasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                completed: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  },
};
