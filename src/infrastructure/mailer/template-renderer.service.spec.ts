import { TemplateRendererService } from './template-renderer.service';

describe('TemplateRendererService', () => {
  let service: TemplateRendererService;

  beforeEach(() => {
    service = new TemplateRendererService();
  });

  it('renders seller access code templates', () => {
    const rendered = service.render('seller-access-code', {
      appName: 'MultiLot 360 API',
      sellerName: 'Ana',
      accessCode: '123456',
      expiresInMinutes: 10,
    });

    expect(rendered.html).toContain('123456');
    expect(rendered.text).toContain('Ana');
  });
});
