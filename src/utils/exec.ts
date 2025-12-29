import { spawn } from 'child_process'
import { logger } from './logger.js'

export interface ExecOptions {
  cwd?: string
  stdio?: 'inherit' | 'pipe' | 'ignore'
  env?: NodeJS.ProcessEnv
}

export async function exec(
  command: string,
  args: string[],
  options: ExecOptions = {}
): Promise<void> {
  const { cwd = process.cwd(), stdio = 'inherit', env = process.env } = options

  logger.debug(`Executing: ${command} ${args.join(' ')}`)

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio,
      env: { ...env, ...process.env },
      shell: process.platform === 'win32',
    })

    child.on('error', (error) => {
      logger.error(`Failed to execute ${command}: ${error.message}`)
      reject(error)
    })

    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Command failed with exit code ${code}`))
      }
    })
  })
}
