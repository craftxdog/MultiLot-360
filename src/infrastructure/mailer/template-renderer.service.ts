import { Injectable } from '@nestjs/common';
import { join } from 'node:path';
import { Environment, FileSystemLoader } from 'nunjucks';

export type RenderedEmailTemplate = {
  html: string;
  text: string;
};

@Injectable()
export class TemplateRendererService {
  private readonly htmlEnvironment: Environment;
  private readonly textEnvironment: Environment;

  constructor() {
    const templatesPath = join(__dirname, 'templates');
    const loader = new FileSystemLoader(templatesPath);
    const noCache = process.env.NODE_ENV !== 'production';

    this.htmlEnvironment = new Environment(loader, {
      autoescape: true,
      noCache,
    });
    this.textEnvironment = new Environment(loader, {
      autoescape: false,
      noCache,
    });
  }

  render(
    templateName: string,
    context: Record<string, unknown>,
  ): RenderedEmailTemplate {
    return {
      html: this.htmlEnvironment.render(`${templateName}/html.njk`, context),
      text: this.textEnvironment.render(`${templateName}/text.njk`, context),
    };
  }
}
