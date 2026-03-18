import { spinner } from "@clack/prompts";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import type { ExpressCustomizations } from "../prompts/customizations.js";
import { promptExpressCustomizations } from "../prompts/customizations.js";
import type { CreateOptions, StackAdapter } from "../types/stack.js";
import { exec } from "../utils/exec.js";
import { logger } from "../utils/logger.js";
import {
  detectPackageManager,
  getDevCommand,
} from "../utils/package-manager.js";
import { validateDirectory, validateProjectName } from "../utils/validate.js";

function getDependencyInstallArgs(
  packageManager: string,
  packages: string[],
  dev = false,
): string[] {
  if (packageManager === "bun") {
    return dev ? ["add", "-d", ...packages] : ["add", ...packages];
  }

  if (packageManager === "pnpm" || packageManager === "yarn") {
    return dev ? ["add", "-D", ...packages] : ["add", ...packages];
  }

  return dev
    ? ["install", "--save-dev", ...packages]
    : ["install", "--save", ...packages];
}

async function generatePatternStructure(
  projectPath: string,
  pattern: ExpressCustomizations["pattern"],
  customizations: ExpressCustomizations,
): Promise<void> {
  const ext = customizations.typescript ? "ts" : "js";
  const srcPath = join(projectPath, "src");

  switch (pattern) {
    case "mvc":
      await generateMVCStructure(srcPath, ext, customizations);
      break;
    case "rest":
      await generateRESTStructure(srcPath, ext, customizations);
      break;
    case "layered":
      await generateLayeredStructure(srcPath, ext, customizations);
      break;
    case "simple":
      await generateSimpleStructure(srcPath, ext, customizations);
      break;
  }
}

async function generateMVCStructure(
  srcPath: string,
  ext: string,
  customizations: ExpressCustomizations,
): Promise<void> {
  // Create directories
  await mkdir(join(srcPath, "models"), { recursive: true });
  await mkdir(join(srcPath, "views"), { recursive: true });
  await mkdir(join(srcPath, "controllers"), { recursive: true });
  await mkdir(join(srcPath, "routes"), { recursive: true });
  await mkdir(join(srcPath, "middleware"), { recursive: true });

  // Generate index.ts/js
  let indexContent = `import express from 'express'`;
  if (customizations.dotenv) indexContent += `\nimport 'dotenv/config'`;
  if (customizations.cors) indexContent += `\nimport cors from 'cors'`;
  if (customizations.helmet) indexContent += `\nimport helmet from 'helmet'`;
  indexContent += `\nimport routes from './routes/index'`;

  indexContent += `\n\nconst app = express()
const port = process.env.PORT || 3000

app.use(express.json())`;

  if (customizations.cors) indexContent += `\napp.use(cors())`;
  if (customizations.helmet) indexContent += `\napp.use(helmet())`;

  indexContent += `\n\napp.use('/api', routes)

app.listen(port, () => {
  console.log(\`Server running at http://localhost:\${port}\`)
})
`;

  await writeFile(join(srcPath, `index.${ext}`), indexContent);

  // Generate routes/index
  const routesContent = `import { Router } from 'express'
import exampleRoutes from './example'

const router = Router()

router.use('/example', exampleRoutes)

export default router
`;
  await writeFile(join(srcPath, "routes", `index.${ext}`), routesContent);

  // Generate example route
  const exampleRouteContent = `import { Router } from 'express'
import * as exampleController from '../controllers/example'

const router = Router()

router.get('/', exampleController.getAll)
router.get('/:id', exampleController.getById)
router.post('/', exampleController.create)
router.put('/:id', exampleController.update)
router.delete('/:id', exampleController.remove)

export default router
`;
  await writeFile(
    join(srcPath, "routes", `example.${ext}`),
    exampleRouteContent,
  );

  // Generate controller
  const controllerContent = `import { Request, Response } from 'express'
import * as exampleModel from '../models/example'

export const getAll = async (req: Request, res: Response) => {
  try {
    const data = await exampleModel.findAll()
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const data = await exampleModel.findById(id)
    if (!data) {
      return res.status(404).json({ error: 'Not found' })
    }
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const create = async (req: Request, res: Response) => {
  try {
    const data = await exampleModel.create(req.body)
    res.status(201).json(data)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const update = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const data = await exampleModel.update(id, req.body)
    if (!data) {
      return res.status(404).json({ error: 'Not found' })
    }
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const remove = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const deleted = await exampleModel.remove(id)
    if (!deleted) {
      return res.status(404).json({ error: 'Not found' })
    }
    res.status(204).send()
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
}
`;
  const finalControllerContent = customizations.typescript
    ? controllerContent
    : controllerContent
        .replace(/:\s*Request/g, "")
        .replace(/:\s*Response/g, "")
        .replace(/:\s*string/g, "")
        .replace(/:\s*any/g, "");
  await writeFile(
    join(srcPath, "controllers", `example.${ext}`),
    finalControllerContent,
  );

  // Generate model
  const modelContent = `export const findAll = async () => {
  // TODO: Implement database query
  return []
}

export const findById = async (id: string) => {
  // TODO: Implement database query
  return null
}

export const create = async (data: any) => {
  // TODO: Implement database insert
  return { id: '1', ...data }
}

export const update = async (id: string, data: any) => {
  // TODO: Implement database update
  return { id, ...data }
}

export const remove = async (id: string) => {
  // TODO: Implement database delete
  return true
}
`;
  const finalModelContent = customizations.typescript
    ? modelContent
    : modelContent.replace(/:\s*string/g, "").replace(/:\s*any/g, "");
  await writeFile(join(srcPath, "models", `example.${ext}`), finalModelContent);
}

async function generateRESTStructure(
  srcPath: string,
  ext: string,
  customizations: ExpressCustomizations,
): Promise<void> {
  await mkdir(join(srcPath, "routes"), { recursive: true });
  await mkdir(join(srcPath, "controllers"), { recursive: true });
  await mkdir(join(srcPath, "services"), { recursive: true });
  await mkdir(join(srcPath, "middleware"), { recursive: true });

  let indexContent = `import express from 'express'`;
  if (customizations.dotenv) indexContent += `\nimport 'dotenv/config'`;
  if (customizations.cors) indexContent += `\nimport cors from 'cors'`;
  if (customizations.helmet) indexContent += `\nimport helmet from 'helmet'`;
  indexContent += `\nimport apiRoutes from './routes/api'`;

  indexContent += `\n\nconst app = express()
const port = process.env.PORT || 3000

app.use(express.json())`;

  if (customizations.cors) indexContent += `\napp.use(cors())`;
  if (customizations.helmet) indexContent += `\napp.use(helmet())`;

  indexContent += `\n\napp.use('/api/v1', apiRoutes)

app.listen(port, () => {
  console.log(\`Server running at http://localhost:\${port}\`)
})
`;

  await writeFile(join(srcPath, `index.${ext}`), indexContent);

  // Generate API routes
  const apiRoutesContent = `import { Router } from 'express'
import userRoutes from './users'

const router = Router()

router.use('/users', userRoutes)

export default router
`;
  await writeFile(join(srcPath, "routes", `api.${ext}`), apiRoutesContent);

  // Generate user routes
  const userRoutesContent = `import { Router } from 'express'
import * as userController from '../controllers/user'

const router = Router()

router.get('/', userController.getUsers)
router.get('/:id', userController.getUser)
router.post('/', userController.createUser)
router.put('/:id', userController.updateUser)
router.delete('/:id', userController.deleteUser)

export default router
`;
  await writeFile(join(srcPath, "routes", `users.${ext}`), userRoutesContent);

  // Generate controller
  const controllerContent = `import { Request, Response } from 'express'
import * as userService from '../services/user'

export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await userService.getAllUsers()
    res.json(users)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getUser = async (req: Request, res: Response) => {
  try {
    const user = await userService.getUserById(req.params.id)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    res.json(user)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const createUser = async (req: Request, res: Response) => {
  try {
    const user = await userService.createUser(req.body)
    res.status(201).json(user)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const updateUser = async (req: Request, res: Response) => {
  try {
    const user = await userService.updateUser(req.params.id, req.body)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    res.json(user)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const deleted = await userService.deleteUser(req.params.id)
    if (!deleted) {
      return res.status(404).json({ error: 'User not found' })
    }
    res.status(204).send()
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
}
`;
  const finalUserControllerContent = customizations.typescript
    ? controllerContent
    : controllerContent
        .replace(/:\s*Request/g, "")
        .replace(/:\s*Response/g, "")
        .replace(/:\s*string/g, "")
        .replace(/:\s*any/g, "");
  await writeFile(
    join(srcPath, "controllers", `user.${ext}`),
    finalUserControllerContent,
  );

  // Generate service
  const serviceContent = `export const getAllUsers = async () => {
  // TODO: Implement business logic and data access
  return []
}

export const getUserById = async (id: string) => {
  // TODO: Implement business logic and data access
  return null
}

export const createUser = async (userData: any) => {
  // TODO: Implement business logic and data access
  return { id: '1', ...userData }
}

export const updateUser = async (id: string, userData: any) => {
  // TODO: Implement business logic and data access
  return { id, ...userData }
}

export const deleteUser = async (id: string) => {
  // TODO: Implement business logic and data access
  return true
}
`;
  const finalServiceContent = customizations.typescript
    ? serviceContent
    : serviceContent.replace(/:\s*string/g, "").replace(/:\s*any/g, "");
  await writeFile(
    join(srcPath, "services", `user.${ext}`),
    finalServiceContent,
  );
}

async function generateLayeredStructure(
  srcPath: string,
  ext: string,
  customizations: ExpressCustomizations,
): Promise<void> {
  await mkdir(join(srcPath, "presentation"), { recursive: true });
  await mkdir(join(srcPath, "business"), { recursive: true });
  await mkdir(join(srcPath, "data"), { recursive: true });

  let indexContent = `import express from 'express'`;
  if (customizations.dotenv) indexContent += `\nimport 'dotenv/config'`;
  if (customizations.cors) indexContent += `\nimport cors from 'cors'`;
  if (customizations.helmet) indexContent += `\nimport helmet from 'helmet'`;
  indexContent += `\nimport routes from './presentation/routes'`;

  indexContent += `\n\nconst app = express()
const port = process.env.PORT || 3000

app.use(express.json())`;

  if (customizations.cors) indexContent += `\napp.use(cors())`;
  if (customizations.helmet) indexContent += `\napp.use(helmet())`;

  indexContent += `\n\napp.use('/api', routes)

app.listen(port, () => {
  console.log(\`Server running at http://localhost:\${port}\`)
})
`;

  await writeFile(join(srcPath, `index.${ext}`), indexContent);

  // Generate presentation layer (routes)
  const routesContent = `import { Router } from 'express'
import * as productController from './controllers/product'

const router = Router()

router.get('/products', productController.getProducts)
router.get('/products/:id', productController.getProduct)
router.post('/products', productController.createProduct)
router.put('/products/:id', productController.updateProduct)
router.delete('/products/:id', productController.deleteProduct)

export default router
`;
  await writeFile(
    join(srcPath, "presentation", `routes.${ext}`),
    routesContent,
  );

  // Generate controller
  const controllerContent = `import { Request, Response } from 'express'
import * as productService from '../business/product'

export const getProducts = async (req: Request, res: Response) => {
  try {
    const products = await productService.getAllProducts()
    res.json(products)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getProduct = async (req: Request, res: Response) => {
  try {
    const product = await productService.getProductById(req.params.id)
    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }
    res.json(product)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const createProduct = async (req: Request, res: Response) => {
  try {
    const product = await productService.createProduct(req.body)
    res.status(201).json(product)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const updateProduct = async (req: Request, res: Response) => {
  try {
    const product = await productService.updateProduct(req.params.id, req.body)
    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }
    res.json(product)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const deleted = await productService.deleteProduct(req.params.id)
    if (!deleted) {
      return res.status(404).json({ error: 'Product not found' })
    }
    res.status(204).send()
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
}
`;
  await mkdir(join(srcPath, "presentation", "controllers"), {
    recursive: true,
  });
  const finalProductControllerContent = customizations.typescript
    ? controllerContent
    : controllerContent
        .replace(/:\s*Request/g, "")
        .replace(/:\s*Response/g, "")
        .replace(/:\s*string/g, "")
        .replace(/:\s*any/g, "");
  await writeFile(
    join(srcPath, "presentation", "controllers", `product.${ext}`),
    finalProductControllerContent,
  );

  // Generate business layer
  const businessContent = `import * as productRepository from '../data/product'

export const getAllProducts = async () => {
  return await productRepository.findAll()
}

export const getProductById = async (id: string) => {
  return await productRepository.findById(id)
}

export const createProduct = async (productData: any) => {
  // Add business logic here
  return await productRepository.create(productData)
}

export const updateProduct = async (id: string, productData: any) => {
  // Add business logic here
  return await productRepository.update(id, productData)
}

export const deleteProduct = async (id: string) => {
  return await productRepository.remove(id)
}
`;
  const finalBusinessContent = customizations.typescript
    ? businessContent
    : businessContent.replace(/:\s*string/g, "").replace(/:\s*any/g, "");
  await writeFile(
    join(srcPath, "business", `product.${ext}`),
    finalBusinessContent,
  );

  // Generate data layer
  const dataContent = `export const findAll = async () => {
  // TODO: Implement database query
  return []
}

export const findById = async (id: string) => {
  // TODO: Implement database query
  return null
}

export const create = async (data: any) => {
  // TODO: Implement database insert
  return { id: '1', ...data }
}

export const update = async (id: string, data: any) => {
  // TODO: Implement database update
  return { id, ...data }
}

export const remove = async (id: string) => {
  // TODO: Implement database delete
  return true
}
`;
  const finalDataContent = customizations.typescript
    ? dataContent
    : dataContent.replace(/:\s*string/g, "").replace(/:\s*any/g, "");
  await writeFile(join(srcPath, "data", `product.${ext}`), finalDataContent);
}

async function generateSimpleStructure(
  srcPath: string,
  ext: string,
  customizations: ExpressCustomizations,
): Promise<void> {
  await mkdir(join(srcPath, "routes"), { recursive: true });
  await mkdir(join(srcPath, "middleware"), { recursive: true });

  let indexContent = `import express from 'express'`;
  if (customizations.dotenv) indexContent += `\nimport 'dotenv/config'`;
  if (customizations.cors) indexContent += `\nimport cors from 'cors'`;
  if (customizations.helmet) indexContent += `\nimport helmet from 'helmet'`;
  indexContent += `\nimport routes from './routes/index'`;

  indexContent += `\n\nconst app = express()
const port = process.env.PORT || 3000

app.use(express.json())`;

  if (customizations.cors) indexContent += `\napp.use(cors())`;
  if (customizations.helmet) indexContent += `\napp.use(helmet())`;

  indexContent += `\n\napp.use('/', routes)

app.listen(port, () => {
  console.log(\`Server running at http://localhost:\${port}\`)
})
`;

  await writeFile(join(srcPath, `index.${ext}`), indexContent);

  // Generate simple routes
  const routesContent = `import { Router } from 'express'

const router = Router()

router.get('/', (req, res) => {
  res.json({ message: 'Hello from Express!' })
})

router.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

export default router
`;
  await writeFile(join(srcPath, "routes", `index.${ext}`), routesContent);
}

export const expressAdapter: StackAdapter = {
  id: "express",
  name: "Node.js + Express + TypeScript",
  description: "Express server with TypeScript",
  backend: true,

  async create(options: CreateOptions): Promise<void> {
    const {
      projectName,
      directory = projectName,
      packageManager = "npm",
      yes = false,
    } = options;

    if (!validateProjectName(projectName)) {
      throw new Error("Invalid project name");
    }

    const projectPath = join(process.cwd(), directory);
    const dirInfo = validateDirectory(directory);

    if (dirInfo.exists) {
      throw new Error(`Directory ${directory} already exists`);
    }

    logger.info(`Creating Express project: ${projectName}`);

    // Prompt for customizations
    const customizations = await promptExpressCustomizations({
      yes: Boolean(options.yes),
    });

    try {
      // Create project directory
      await mkdir(projectPath, { recursive: true });

      // Create package.json
      const packageJson = {
        name: projectName,
        version: "0.0.1",
        description: "",
        main: customizations.typescript ? "dist/index.js" : "src/index.js",
        type: "module",
        scripts: {
          dev: customizations.typescript
            ? "tsx watch src/index.ts"
            : "node --watch src/index.js",
          build: customizations.typescript
            ? "tsc"
            : 'echo "No build step needed"',
          start: customizations.typescript
            ? "node dist/index.js"
            : "node src/index.js",
        },
        keywords: [],
        author: "",
        license: "MIT",
      };

      await writeFile(
        join(projectPath, "package.json"),
        JSON.stringify(packageJson, null, 2),
      );

      // Create tsconfig.json if TypeScript is enabled
      if (customizations.typescript) {
        const tsconfig = {
          compilerOptions: {
            target: "ES2022",
            module: "ES2022",
            lib: ["ES2022"],
            moduleResolution: "node",
            outDir: "./dist",
            rootDir: "./src",
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
            resolveJsonModule: true,
          },
          include: ["src/**/*"],
          exclude: ["node_modules", "dist"],
        };

        await writeFile(
          join(projectPath, "tsconfig.json"),
          JSON.stringify(tsconfig, null, 2),
        );
      }

      // Create src directory structure based on pattern
      await mkdir(join(projectPath, "src"), { recursive: true });

      // Generate pattern-specific structure
      await generatePatternStructure(
        projectPath,
        customizations.pattern,
        customizations,
      );

      // Create .gitignore
      const gitignore = `node_modules
dist
.env
*.log
.DS_Store
`;
      await writeFile(join(projectPath, ".gitignore"), gitignore);

      // Install dependencies
      const installSpinner = spinner();
      installSpinner.start("Installing dependencies...");
      const installCommand =
        packageManager === "bun"
          ? "bun"
          : packageManager === "pnpm"
            ? "pnpm"
            : packageManager === "yarn"
              ? "yarn"
              : "npm";

      const dependencies: string[] = ["express"];
      const devDependencies: string[] = [];

      if (customizations.typescript) {
        devDependencies.push("tsx", "@types/express", "@types/node", "typescript");
      }

      if (customizations.dotenv) {
        dependencies.push("dotenv");
      }

      if (customizations.cors) {
        dependencies.push("cors");
        if (customizations.typescript) {
          devDependencies.push("@types/cors");
        }
      }

      if (customizations.helmet) {
        dependencies.push("helmet");
      }

      try {
        if (dependencies.length > 0) {
          await exec(
            installCommand,
            getDependencyInstallArgs(packageManager, dependencies),
            {
              cwd: projectPath,
              stdio: "inherit",
            },
          );
        }

        if (devDependencies.length > 0) {
          await exec(
            installCommand,
            getDependencyInstallArgs(packageManager, devDependencies, true),
            {
              cwd: projectPath,
              stdio: "inherit",
            },
          );
        }

        installSpinner.stop("Dependencies installed");
      } catch (error) {
        installSpinner.stop("Failed to install dependencies");
        throw error;
      }

      // Setup ESLint if requested
      if (customizations.eslint) {
        const eslintSpinner = spinner();
        eslintSpinner.start("Setting up ESLint...");
        try {
          const eslintPackages = customizations.typescript
            ? [
                "eslint",
                "@typescript-eslint/parser",
                "@typescript-eslint/eslint-plugin",
                "eslint-plugin-node",
              ]
            : ["eslint", "eslint-plugin-node"];
          const eslintArgs = getDependencyInstallArgs(
            packageManager,
            eslintPackages,
            true,
          );
          await exec(installCommand, eslintArgs, {
            cwd: projectPath,
            stdio: "inherit",
          });

          const eslintConfig = customizations.typescript
            ? `module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:node/recommended',
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  env: {
    node: true,
    es2022: true,
  },
  rules: {},
};`
            : `module.exports = {
  extends: ['eslint:recommended', 'plugin:node/recommended'],
  env: {
    node: true,
    es2022: true,
  },
  rules: {},
};`;

          await writeFile(join(projectPath, ".eslintrc.cjs"), eslintConfig);
          eslintSpinner.stop("ESLint configured");
        } catch (error) {
          eslintSpinner.stop("Failed to setup ESLint");
          throw error;
        }
      }

      // Setup Prettier if requested
      if (customizations.prettier) {
        const prettierSpinner = spinner();
        prettierSpinner.start("Setting up Prettier...");
        try {
          const prettierArgs =
            packageManager === "bun"
              ? ["add", "-d", "prettier"]
              : packageManager === "pnpm" || packageManager === "yarn"
                ? ["add", "-D", "prettier"]
                : ["install", "--save-dev", "prettier"];
          await exec(installCommand, prettierArgs, {
            cwd: projectPath,
            stdio: "inherit",
          });

          const prettierConfig = `{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5"
}`;
          await writeFile(join(projectPath, ".prettierrc"), prettierConfig);

          const prettierIgnore = `node_modules
dist
build
.coverage`;
          await writeFile(join(projectPath, ".prettierignore"), prettierIgnore);
          prettierSpinner.stop("Prettier configured");
        } catch (error) {
          prettierSpinner.stop("Failed to setup Prettier");
          throw error;
        }
      }

      // Detect package manager from created project (after install creates lock file)
      const detectedPm = detectPackageManager(projectPath);

      logger.success(`Project ${projectName} created successfully!`);
      logger.info(`Next steps:`);
      logger.info(`  cd ${directory}`);
      logger.info(`  ${getDevCommand(detectedPm)}`);
    } catch (error) {
      logger.error(
        `Failed to create project: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  },
};
