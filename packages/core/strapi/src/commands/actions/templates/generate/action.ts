import { resolve, join, basename } from 'path';
import fse from 'fs-extra';
import chalk from 'chalk';
import inquirer from 'inquirer';

// All directories that a template could need
const TEMPLATE_CONTENT = ['src', 'data'];

async function copyContent(templatePath: string, rootBase: string) {
  for (const item of TEMPLATE_CONTENT) {
    try {
      const pathToCopy = join(process.cwd(), item);

      if (!(await fse.pathExists(pathToCopy))) {
        continue;
      }

      await fse.copy(pathToCopy, join(templatePath, item));
      const currentProjectBase = basename(process.cwd());
      console.log(
        `${chalk.green(
          'success'
        )}: copy ${currentProjectBase}/${item} => ${rootBase}/template/${item}`
      );
    } catch (error) {
      if (error instanceof Error) {
        console.error(`${chalk.red('error')}: ${error.message}`);
      }
    }
  }
}

/**
 *
 * @param {string} rootPath Absolute path to the root directory
 */
async function writeTemplateJson(rootPath: string) {
  try {
    await fse.writeJSON(join(rootPath, 'template.json'), {});
    console.log(`${chalk.green('success')}: create JSON config file`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`${chalk.red('error')}: ${error.message}`);
    }
  }
}

/**
 *
 * @param {string} rootPath Absolute path to the root directory
 * @returns boolean
 */
async function templateConfigExists(rootPath: string) {
  const configExists = await fse.pathExists(join(rootPath, 'template.json'));
  console.log(`checking: ${join(rootPath, 'template.json')}. result ${configExists}`);
  return configExists;
}

export default async function generateTemplate(directory: string) {
  const rootPath = resolve(directory);

  // Get path to template directory: <rootPath>/template
  const templatePath = join(rootPath, 'template');

  // Check if the template directory exists
  const exists = await fse.pathExists(templatePath);
  const rootBase = basename(rootPath);

  if (exists) {
    // Confirm the user wants to replace the existing template
    const inquiry = await inquirer.prompt({
      type: 'confirm',
      name: 'confirm',
      message: `${chalk.yellow(rootBase)} already exists.  Do you want to replace it?`,
    });

    if (!inquiry.confirm) {
      process.exit(0);
    }
  }

  // Create or replace root directory with <roothPath>/template
  await fse.ensureDir(templatePath);
  // Copy content to /template
  await copyContent(templatePath, rootBase);
  // Create config file if it doesn't exist
  const configExists = await templateConfigExists(rootPath);
  if (!configExists) {
    await writeTemplateJson(rootPath);
  }

  console.log(`${chalk.green('success')}: generated template at ${chalk.yellow(rootPath)}`);
}
