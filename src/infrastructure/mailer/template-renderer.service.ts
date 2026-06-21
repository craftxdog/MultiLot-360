import { Injectable } from '@nestjs/common';
import { join } from 'node:path';
import { Environment, FileSystemLoader } from 'nunjucks';

export type RenderedEmailTemplate = {
  html: string;
  text: string;
};

@Injectable()
export class TemplateRendererService {
  private readonly environment: Environment;

  constructor() {
    const templatesPath = join(__dirname, 'templates');
    this.environment = new Environment(new FileSystemLoader(templatesPath), {
      autoescape: true,
      noCache: process.env.NODE_ENV !== 'production',
    });
  }

  render(
    templateName: string,
    context: Record<string, unknown>,
  ): RenderedEmailTemplate {
    return {
      html: this.environment.render(`${templateName}/html.njk`, context),
      text: this.environment.render(`${templateName}/text.njk`, context),
    };
  }
}
