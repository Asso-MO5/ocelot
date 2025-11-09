import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Parse un scénario Gherkin pour extraire les informations
 */
interface ParsedScenario {
  name: string;
  steps: Array<{ type: 'given' | 'when' | 'then' | 'and'; text: string }>;
  path?: string;
  method?: string;
  statusCode?: number;
}

interface ParsedFeature {
  title: string;
  description: string;
  scenarios: ParsedScenario[];
}

/**
 * Parse le contenu Gherkin d'un fichier feature
 */
function parseGherkinFeature(content: string): ParsedFeature | null {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l);

  let inFeature = false;
  let inScenario = false;
  let currentFeature: ParsedFeature | null = null;
  let currentScenario: ParsedScenario | null = null;

  for (const line of lines) {
    if (line.startsWith('Feature:')) {
      inFeature = true;
      const title = line.replace('Feature:', '').trim();
      currentFeature = {
        title,
        description: '',
        scenarios: [],
      };
    } else if (line.startsWith('Scenario:')) {
      if (currentScenario) {
        currentFeature?.scenarios.push(currentScenario);
      }
      inScenario = true;
      const name = line.replace('Scenario:', '').trim();
      currentScenario = {
        name,
        steps: [],
      };
    } else if (inFeature && !inScenario && line && !line.startsWith('Background:')) {
      if (currentFeature) {
        currentFeature.description += (currentFeature.description ? ' ' : '') + line;
      }
    } else if (inScenario && currentScenario) {
      const stepMatch = line.match(/^(Étant donné|Quand|Alors|Et)\s+(.+)$/i);
      if (stepMatch) {
        const [, keyword, text] = stepMatch;
        let type: 'given' | 'when' | 'then' | 'and' = 'given';

        if (keyword.toLowerCase().includes('quand')) type = 'when';
        else if (keyword.toLowerCase().includes('alors')) type = 'then';
        else if (keyword.toLowerCase().includes('et')) type = 'and';

        currentScenario.steps.push({ type, text });

        // Extraire le path et method des steps "Quand"
        if (type === 'when') {
          const pathMatch = text.match(/["']([^"']+)["']/);
          const methodMatch = text.match(/(GET|POST|PUT|DELETE|PATCH)/i);
          if (pathMatch) currentScenario.path = pathMatch[1];
          if (methodMatch) currentScenario.method = methodMatch[1].toUpperCase();
        }

        // Extraire le status code des steps "Alors"
        if (type === 'then' || type === 'and') {
          const statusMatch = text.match(/(\d{3})/);
          if (statusMatch) currentScenario.statusCode = parseInt(statusMatch[1], 10);
        }
      }
    }
  }

  if (currentScenario && currentFeature) {
    currentFeature.scenarios.push(currentScenario);
  }

  return currentFeature;
}

/**
 * Trouve les scénarios pour un endpoint donné
 */
function findScenariosForEndpoint(
  features: ParsedFeature[],
  method: string,
  path: string
): ParsedScenario[] {
  const scenarios: ParsedScenario[] = [];

  for (const feature of features) {
    for (const scenario of feature.scenarios) {
      if (scenario.path === path && scenario.method === method) {
        scenarios.push(scenario);
      }
    }
  }

  return scenarios;
}

/**
 * Convertit un schéma JSON Schema en schéma OpenAPI
 */
function jsonSchemaToOpenAPI(schema: any): any {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  const openApiSchema: any = { ...schema };

  // Gérer les types nullables
  if (Array.isArray(openApiSchema.type) && openApiSchema.type.includes('null')) {
    openApiSchema.type = openApiSchema.type.filter((t: string) => t !== 'null');
    openApiSchema.nullable = true;
  }

  // Convertir les propriétés récursivement
  if (openApiSchema.properties) {
    for (const key in openApiSchema.properties) {
      openApiSchema.properties[key] = jsonSchemaToOpenAPI(openApiSchema.properties[key]);
    }
  }

  if (openApiSchema.items) {
    openApiSchema.items = jsonSchemaToOpenAPI(openApiSchema.items);
  }

  return openApiSchema;
}

/**
 * Génère la documentation OpenAPI
 */
async function generateOpenAPIDoc(): Promise<void> {
  const featuresDir = join(__dirname, '../features');
  const features: ParsedFeature[] = [];

  // Lire tous les fichiers .feature.ts
  function findFeatureFiles(dir: string): string[] {
    const files: string[] = [];
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...findFeatureFiles(fullPath));
      } else if (entry.endsWith('.feature.ts')) {
        files.push(fullPath);
      }
    }

    return files;
  }

  const featureFiles = findFeatureFiles(featuresDir);

  // Parser tous les fichiers feature
  for (const filePath of featureFiles) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      // Extraire le contenu de la constante exportée
      const match = content.match(/export\s+const\s+\w+\s*=\s*`([\s\S]*?)`/);
      if (match) {
        const feature = parseGherkinFeature(match[1]);
        if (feature) {
          features.push(feature);
        }
      }
    } catch (err) {
      console.warn(`Erreur lors de la lecture de ${filePath}:`, err);
    }
  }

  // Importer les schémas
  const {
    callbackSchema,
    sessionSchema,
    meSchema,
    signinSchema
  } = await import('../features/auth/auth.schemas.ts');

  // Définir les routes avec leurs schémas
  const routes = [
    {
      method: 'GET',
      path: '/auth/signin',
      schema: signinSchema,
      description: 'Redirige vers Discord OAuth2 pour l\'authentification',
    },
    {
      method: 'GET',
      path: '/auth/login',
      schema: signinSchema,
      description: 'Alias de /auth/signin - Redirige vers Discord OAuth2',
    },
    {
      method: 'GET',
      path: '/auth/callback',
      schema: callbackSchema,
      description: 'Callback OAuth2 de Discord - Échange le code d\'autorisation contre des tokens',
    },
    {
      method: 'GET',
      path: '/auth/session',
      schema: sessionSchema,
      description: 'Vérifie l\'état de la session utilisateur',
    },
    {
      method: 'GET',
      path: '/auth/me',
      schema: meSchema,
      description: 'Récupère les informations de l\'utilisateur authentifié (gère automatiquement le refresh du token)',
    },
  ];

  // Générer le document OpenAPI
  const openApiDoc: any = {
    openapi: '3.1.0',
    info: {
      title: 'Ocelot API - Museum Back End',
      description: 'API backend Fastify avec authentification Discord OAuth2.\n\n' +
        'Cette documentation est générée à partir des scénarios Gherkin/Cucumber et des schémas Fastify.',
      version: '1.0.0',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Serveur de développement',
      },
    ],
    tags: [
      {
        name: 'Authentification',
        description: 'Endpoints d\'authentification Discord OAuth2',
      },
    ],
    paths: {} as Record<string, any>,
  };

  // Générer les paths à partir des routes
  for (const route of routes) {
    const scenarios = findScenariosForEndpoint(features, route.method, route.path);
    const pathItem: any = {
      [route.method.toLowerCase()]: {
        tags: ['Authentification'],
        summary: route.description,
        description: generateDescriptionFromScenarios(scenarios),
        operationId: `${route.method.toLowerCase()}_${route.path.replace(/\//g, '_').replace(/^_|_$/g, '')}`,
        parameters: [],
        responses: {},
      },
    };

    // Ajouter les paramètres de query
    if (route.schema.querystring) {
      const querySchema = route.schema.querystring as any;
      if (querySchema.properties) {
        for (const [key, prop] of Object.entries(querySchema.properties as Record<string, any>)) {
          pathItem[route.method.toLowerCase()].parameters.push({
            name: key,
            in: 'query',
            description: prop.description || '',
            required: querySchema.required?.includes(key) || false,
            schema: jsonSchemaToOpenAPI(prop),
          });
        }
      }
    }

    // Ajouter les réponses
    if (route.schema.response) {
      for (const [statusCode, responseSchema] of Object.entries(route.schema.response)) {
        const status = parseInt(statusCode, 10);
        const scenario = scenarios.find(s => s.statusCode === status);

        pathItem[route.method.toLowerCase()].responses[statusCode] = {
          description: getResponseDescription(status, scenario),
          content: status !== 302 ? {
            'application/json': {
              schema: jsonSchemaToOpenAPI(responseSchema as any),
              example: generateExampleFromScenario(scenario, responseSchema as any),
            },
          } : undefined,
          headers: status === 302 ? {
            Location: {
              schema: { type: 'string' },
              description: 'URL de redirection',
            },
          } : undefined,
        };
      }
    }

    // Ajouter les exemples de scénarios
    if (scenarios.length > 0) {
      pathItem[route.method.toLowerCase()].description += '\n\n### Scénarios de test\n\n';
      for (const scenario of scenarios) {
        pathItem[route.method.toLowerCase()].description += `**${scenario.name}**\n\n`;
        for (const step of scenario.steps) {
          const emoji = step.type === 'given' ? '📋' : step.type === 'when' ? '⚡' : '✅';
          pathItem[route.method.toLowerCase()].description += `${emoji} ${step.text}\n\n`;
        }
      }
    }

    if (!openApiDoc.paths[route.path]) {
      openApiDoc.paths[route.path] = {};
    }
    Object.assign(openApiDoc.paths[route.path], pathItem);
  }

  // Ajouter les composants de sécurité (cookies)
  openApiDoc.components = {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'discord_access_token',
        description: 'Token d\'accès Discord stocké dans un cookie HTTP-only',
      },
    },
  };

  // Ajouter la sécurité aux endpoints protégés
  for (const path in openApiDoc.paths) {
    if (path === '/auth/me' || path === '/auth/session') {
      const methods = Object.keys(openApiDoc.paths[path]);
      for (const method of methods) {
        if (openApiDoc.paths[path][method]) {
          openApiDoc.paths[path][method].security = [{ cookieAuth: [] }];
        }
      }
    }
  }

  // Écrire le fichier OpenAPI
  const outputPath = join(__dirname, '../../docs/openapi.json');
  const outputDir = dirname(outputPath);

  try {
    // Créer le dossier docs s'il n'existe pas
    const { mkdirSync } = await import('node:fs');
    mkdirSync(outputDir, { recursive: true });
  } catch (err) {
    // Le dossier existe peut-être déjà
  }

  writeFileSync(outputPath, JSON.stringify(openApiDoc, null, 2), 'utf-8');

  // Générer aussi un fichier YAML si possible
  try {
    const yamlContent = jsonToYaml(openApiDoc);
    const yamlPath = join(__dirname, '../../docs/openapi.yaml');
    writeFileSync(yamlPath, yamlContent, 'utf-8');
    console.log(`✅ Documentation générée : ${yamlPath}`);
  } catch (err) {
    console.warn('⚠️  Impossible de générer le YAML, seul le JSON est disponible');
  }

  // Générer la version HTML avec Swagger UI
  const htmlPath = join(__dirname, '../../docs/index.html');
  const htmlContent = generateSwaggerUIHTML();
  writeFileSync(htmlPath, htmlContent, 'utf-8');
  console.log(`✅ Documentation HTML générée : ${htmlPath}`);

  console.log(`✅ Documentation OpenAPI générée : ${outputPath}`);
  console.log(`📊 ${features.length} feature(s) parsée(s)`);
  console.log(`📝 ${routes.length} route(s) documentée(s)`);
}

/**
 * Génère une page HTML avec Swagger UI
 * Charge la spécification OpenAPI depuis l'endpoint /docs/openapi.json
 */
function generateSwaggerUIHTML(): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ocelot API - Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui.css" />
  <style>
    html {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    *, *:before, *:after {
      box-sizing: inherit;
    }
    body {
      margin:0;
      background: #fafafa;
    }
    .swagger-ui .topbar {
      background-color: #1f2937;
    }
    .swagger-ui .topbar .download-url-wrapper {
      display: none;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      // Charger la spécification OpenAPI depuis l'endpoint
      const url = '/docs/openapi.json';
      
      SwaggerUIBundle({
        url: url,
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        docExpansion: "list",
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: true,
        supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
        validatorUrl: null,
        oauth2RedirectUrl: window.location.href
      });
    };
  </script>
</body>
</html>`;
}

/**
 * Génère une description à partir des scénarios
 */
function generateDescriptionFromScenarios(scenarios: ParsedScenario[]): string {
  if (scenarios.length === 0) return '';

  const descriptions: string[] = [];
  for (const scenario of scenarios) {
    const whenStep = scenario.steps.find(s => s.type === 'when');
    const thenSteps = scenario.steps.filter(s => s.type === 'then' || s.type === 'and');

    if (whenStep && thenSteps.length > 0) {
      descriptions.push(`**${scenario.name}** : ${thenSteps.map(s => s.text).join(' ')}`);
    }
  }

  return descriptions.join('\n\n');
}

/**
 * Génère une description de réponse
 */
function getResponseDescription(status: number, scenario?: ParsedScenario): string {
  const statusDescriptions: Record<number, string> = {
    200: 'Succès',
    302: 'Redirection',
    401: 'Non authentifié',
    500: 'Erreur serveur',
  };

  let description = statusDescriptions[status] || `Code ${status}`;

  if (scenario) {
    const thenSteps = scenario.steps.filter(s => s.type === 'then' || s.type === 'and');
    if (thenSteps.length > 0) {
      description += ' - ' + thenSteps.map(s => s.text).join(', ');
    }
  }

  return description;
}

/**
 * Génère un exemple à partir d'un scénario
 */
function generateExampleFromScenario(scenario: ParsedScenario | undefined, schema: any): any {
  if (!scenario || !schema || !schema.properties) return undefined;

  const example: any = {};
  for (const [key, prop] of Object.entries(schema.properties as Record<string, any>)) {
    if (prop.type === 'string') {
      example[key] = `exemple_${key}`;
    } else if (prop.type === 'boolean') {
      example[key] = true;
    } else if (prop.type === 'number') {
      example[key] = 123;
    } else if (Array.isArray(prop.type) && prop.type.includes('null')) {
      example[key] = null;
    }
  }

  return example;
}

/**
 * Convertit JSON en YAML (version simple)
 */
function jsonToYaml(obj: any, indent = 0): string {
  const spaces = '  '.repeat(indent);
  let yaml = '';

  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (typeof item === 'object' && item !== null) {
        yaml += `${spaces}- ${jsonToYaml(item, indent + 1).trim()}\n`;
      } else {
        yaml += `${spaces}- ${item}\n`;
      }
    }
  } else if (typeof obj === 'object' && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        yaml += `${spaces}${key}: null\n`;
      } else if (typeof value === 'string') {
        // Échapper les caractères spéciaux YAML
        const escaped = value.replace(/"/g, '\\"');
        yaml += `${spaces}${key}: "${escaped}"\n`;
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        yaml += `${spaces}${key}: ${value}\n`;
      } else if (Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        yaml += jsonToYaml(value, indent + 1);
      } else if (typeof value === 'object') {
        yaml += `${spaces}${key}:\n`;
        yaml += jsonToYaml(value, indent + 1);
      }
    }
  } else {
    yaml += `${spaces}${obj}\n`;
  }

  return yaml;
}

// Exécuter le script
generateOpenAPIDoc().catch(err => {
  console.error('❌ Erreur lors de la génération de la documentation:', err);
  process.exit(1);
});

